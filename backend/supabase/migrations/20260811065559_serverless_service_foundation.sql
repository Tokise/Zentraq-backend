-- Establishes a private, PHI-free service-job queue for the serverless pilot.
-- This migration does not move clinical data or relax existing RLS policies.

set lock_timeout = '5s';
set statement_timeout = '30s';

create extension if not exists pgmq;

create schema if not exists private;

revoke all on schema private from public, anon, service_role;
grant usage on schema private to authenticated;

create table if not exists private.service_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  requested_by uuid references auth.users(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint service_jobs_job_type_check check (
    job_type = 'platform.smoke_test'
  ),
  constraint service_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'dead_letter')
  ),
  constraint service_jobs_attempts_check check (
    attempts >= 0 and attempts <= max_attempts
  ),
  constraint service_jobs_max_attempts_check check (
    max_attempts between 1 and 10
  ),
  constraint service_jobs_idempotency_key_check check (
    char_length(idempotency_key) between 8 and 128
  ),
  constraint service_jobs_error_code_check check (
    last_error_code is null
    or last_error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  ),
  constraint service_jobs_idempotency_unique unique (
    job_type,
    idempotency_key
  )
);

create table if not exists private.service_job_transitions (
  id bigint generated always as identity primary key,
  job_id uuid not null
    references private.service_jobs(id)
    on delete cascade,
  from_status text,
  to_status text not null,
  error_code text,
  occurred_at timestamptz not null default timezone('utc', now()),
  constraint service_job_transitions_from_status_check check (
    from_status is null
    or from_status in ('queued', 'processing', 'completed', 'dead_letter')
  ),
  constraint service_job_transitions_to_status_check check (
    to_status in ('queued', 'processing', 'completed', 'dead_letter')
  ),
  constraint service_job_transitions_error_code_check check (
    error_code is null
    or error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  )
);

alter table private.service_jobs enable row level security;
alter table private.service_job_transitions enable row level security;

revoke all on table private.service_jobs
from public, anon, authenticated, service_role;

revoke all on table private.service_job_transitions
from public, anon, authenticated, service_role;

create index if not exists service_jobs_status_created_idx
  on private.service_jobs (status, created_at);

create index if not exists service_jobs_correlation_idx
  on private.service_jobs (correlation_id);

create index if not exists service_job_transitions_job_idx
  on private.service_job_transitions (job_id, occurred_at);

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues() as queue
    where queue.queue_name = 'zentraq_service_jobs'
  ) then
    perform pgmq.create('zentraq_service_jobs');
  end if;
end;
$$;

alter table pgmq.q_zentraq_service_jobs enable row level security;
alter table pgmq.a_zentraq_service_jobs enable row level security;

revoke all on table pgmq.q_zentraq_service_jobs
from public, anon, authenticated, service_role;

revoke all on table pgmq.a_zentraq_service_jobs
from public, anon, authenticated, service_role;

-- Enqueues a metadata-only service job after application authorization succeeds.
create or replace function public.enqueue_service_job(
  requested_job_type text,
  requested_by uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued_job_id uuid;
begin
  if requested_job_type <> 'platform.smoke_test' then
    raise exception using
      errcode = '22023',
      message = 'Unsupported service job type';
  end if;

  if requested_idempotency_key is null
    or char_length(requested_idempotency_key) not between 8 and 128 then
    raise exception using
      errcode = '22023',
      message = 'Invalid idempotency key';
  end if;

  if requested_by is not null
    and not exists (
      select 1
      from auth.users
      where id = requested_by
    ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid requesting user';
  end if;

  insert into private.service_jobs (
    job_type,
    requested_by,
    correlation_id,
    idempotency_key
  )
  values (
    requested_job_type,
    requested_by,
    coalesce(requested_correlation_id, gen_random_uuid()),
    requested_idempotency_key
  )
  on conflict (job_type, idempotency_key) do nothing
  returning id into queued_job_id;

  if queued_job_id is null then
    select job.id
    into queued_job_id
    from private.service_jobs as job
    where job.job_type = requested_job_type
      and job.idempotency_key = requested_idempotency_key;

    return queued_job_id;
  end if;

  perform pgmq.send(
    'zentraq_service_jobs',
    jsonb_build_object(
      'version', 1,
      'job_id', queued_job_id,
      'job_type', requested_job_type
    )
  );

  insert into private.service_job_transitions (
    job_id,
    from_status,
    to_status
  )
  values (
    queued_job_id,
    null,
    'queued'
  );

  return queued_job_id;
end;
$$;

-- Claims a bounded batch while PGMQ supplies the retry visibility window.
create or replace function public.claim_service_jobs(
  requested_batch_size integer default 5,
  requested_visibility_timeout integer default 60
)
returns table (
  message_id bigint,
  read_count integer,
  job_id uuid,
  job_type text,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_batch_size integer;
  safe_visibility_timeout integer;
begin
  safe_batch_size := greatest(1, least(coalesce(requested_batch_size, 5), 10));
  safe_visibility_timeout := greatest(
    30,
    least(coalesce(requested_visibility_timeout, 60), 300)
  );

  return query
  with messages as (
    select queue_message.*
    from pgmq.read(
      'zentraq_service_jobs',
      safe_visibility_timeout,
      safe_batch_size
    ) as queue_message
    where queue_message.message ->> 'job_id'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  claimed as (
    update private.service_jobs as job
    set
      status = 'processing',
      attempts = least(
        job.max_attempts,
        greatest(job.attempts + 1, messages.read_ct)
      ),
      last_error_code = null,
      updated_at = timezone('utc', now())
    from messages
    where job.id = (messages.message ->> 'job_id')::uuid
      and job.job_type = messages.message ->> 'job_type'
      and job.status in ('queued', 'processing')
      and job.attempts < job.max_attempts
    returning
      messages.msg_id,
      messages.read_ct,
      job.id,
      job.job_type,
      job.correlation_id
  )
  select
    claimed.msg_id,
    claimed.read_ct,
    claimed.id,
    claimed.job_type,
    claimed.correlation_id
  from claimed;
end;
$$;

-- Completes one claimed job and archives its queue message atomically.
create or replace function public.complete_service_job(
  requested_job_id uuid,
  requested_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status text;
begin
  select job.status
  into previous_status
  from private.service_jobs as job
  where job.id = requested_job_id
  for update;

  if previous_status is null then
    raise exception using
      errcode = 'P0002',
      message = 'Service job not found';
  end if;

  if previous_status = 'completed' then
    return;
  end if;

  if previous_status <> 'processing' then
    raise exception using
      errcode = '55000',
      message = 'Service job is not processing';
  end if;

  if not exists (
    select 1
    from pgmq.q_zentraq_service_jobs as queue_message
    where queue_message.msg_id = requested_message_id
      and queue_message.message ->> 'job_id' = requested_job_id::text
  ) then
    raise exception using
      errcode = '22023',
      message = 'Queue message does not match service job';
  end if;

  perform pgmq.archive(
    'zentraq_service_jobs',
    requested_message_id
  );

  update private.service_jobs
  set
    status = 'completed',
    updated_at = timezone('utc', now()),
    completed_at = timezone('utc', now()),
    last_error_code = null
  where id = requested_job_id;

  insert into private.service_job_transitions (
    job_id,
    from_status,
    to_status
  )
  values (
    requested_job_id,
    previous_status,
    'completed'
  );
end;
$$;

-- Records a sanitized failure and dead-letters jobs at their retry limit.
create or replace function public.fail_service_job(
  requested_job_id uuid,
  requested_message_id bigint,
  requested_error_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
  current_max_attempts integer;
  next_status text;
begin
  if requested_error_code is null
    or requested_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid service error code';
  end if;

  select
    job.attempts,
    job.max_attempts
  into
    current_attempts,
    current_max_attempts
  from private.service_jobs as job
  where job.id = requested_job_id
    and job.status = 'processing'
  for update;

  if current_attempts is null then
    raise exception using
      errcode = '55000',
      message = 'Service job is not processing';
  end if;

  if not exists (
    select 1
    from pgmq.q_zentraq_service_jobs as queue_message
    where queue_message.msg_id = requested_message_id
      and queue_message.message ->> 'job_id' = requested_job_id::text
  ) then
    raise exception using
      errcode = '22023',
      message = 'Queue message does not match service job';
  end if;

  if current_attempts >= current_max_attempts then
    next_status := 'dead_letter';

    perform pgmq.archive(
      'zentraq_service_jobs',
      requested_message_id
    );
  else
    next_status := 'queued';
  end if;

  update private.service_jobs
  set
    status = next_status,
    last_error_code = requested_error_code,
    updated_at = timezone('utc', now())
  where id = requested_job_id;

  insert into private.service_job_transitions (
    job_id,
    from_status,
    to_status,
    error_code
  )
  values (
    requested_job_id,
    'processing',
    next_status,
    requested_error_code
  );

  return next_status;
end;
$$;

revoke all on function public.enqueue_service_job(
  text,
  uuid,
  text,
  uuid
) from public, anon, authenticated, service_role;

revoke all on function public.claim_service_jobs(
  integer,
  integer
) from public, anon, authenticated, service_role;

revoke all on function public.complete_service_job(
  uuid,
  bigint
) from public, anon, authenticated, service_role;

revoke all on function public.fail_service_job(
  uuid,
  bigint,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.enqueue_service_job(
  text,
  uuid,
  text,
  uuid
) to service_role;

grant execute on function public.claim_service_jobs(
  integer,
  integer
) to service_role;

grant execute on function public.complete_service_job(
  uuid,
  bigint
) to service_role;

grant execute on function public.fail_service_job(
  uuid,
  bigint,
  text
) to service_role;

comment on table private.service_jobs is
  'Metadata-only serverless pilot jobs. PHI and free-form payloads are prohibited.';

comment on table private.service_job_transitions is
  'Append-only sanitized state transitions for serverless pilot jobs.';
