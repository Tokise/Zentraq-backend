set statement_timeout = '30s';

create extension if not exists pgmq;

do $$
begin
  if to_regclass('public.v_daily_consultations') is null
    or to_regclass('public.v_medicine_stock_summary') is null
    or to_regclass('public.consultations') is null
    or to_regclass('public.dispensing_logs') is null
    or to_regclass('public.medicine_stock') is null
    or to_regclass('public.medicines') is null
    or to_regclass('public.incidents') is null
    or to_regclass('public.health_clearances') is null then
    raise exception 'REPORT_SERVICE_READINESS_CHECK_FAILED';
  end if;
end;
$$;

create table if not exists private.report_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  idempotency_key text not null,
  correlation_id uuid not null,
  status text not null default 'queued',
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  error_code text,
  artifact_path text,
  artifact_size bigint,
  artifact_sha256 text,
  artifact_expires_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint report_requests_type_check check (
    report_type = 'clinic-aggregate'
  ),
  constraint report_requests_period_check check (
    period_start <= period_end
    and period_end - period_start <= 366
  ),
  constraint report_requests_status_check check (
    status in ('queued', 'processing', 'completed', 'dead_letter', 'expired')
  ),
  constraint report_requests_attempts_check check (
    attempts between 0 and max_attempts
  ),
  constraint report_requests_idempotency_check check (
    idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'
  ),
  constraint report_requests_error_code_check check (
    error_code is null or error_code ~ '^[A-Z0-9_]{3,64}$'
  ),
  constraint report_requests_artifact_path_check check (
    artifact_path is null
    or artifact_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/report\.xlsx$'
  ),
  constraint report_requests_owner_idempotency_unique unique (
    requested_by,
    idempotency_key
  )
);

alter table private.report_requests enable row level security;
revoke all on table private.report_requests
  from public, anon, authenticated, service_role;

create index if not exists report_requests_status_created_idx
  on private.report_requests (status, created_at);
create index if not exists report_requests_expiry_idx
  on private.report_requests (artifact_expires_at)
  where status = 'completed';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'generated-reports',
  'generated-reports',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues() as queue
    where queue.queue_name = 'zentraq_report_jobs'
  ) then
    perform pgmq.create('zentraq_report_jobs');
  end if;
end;
$$;

alter table pgmq.q_zentraq_report_jobs enable row level security;
alter table pgmq.a_zentraq_report_jobs enable row level security;
revoke all on table pgmq.q_zentraq_report_jobs
  from public, anon, authenticated, service_role;
revoke all on table pgmq.a_zentraq_report_jobs
  from public, anon, authenticated, service_role;

-- Enqueues one idempotent Admin-owned aggregate report request.
create or replace function public.enqueue_report_request(
  requested_by uuid,
  requested_report_type text,
  requested_start_date date,
  requested_end_date date,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.report_requests%rowtype;
begin
  if requested_by is null
    or requested_report_type <> 'clinic-aggregate'
    or requested_start_date is null
    or requested_end_date is null
    or requested_start_date > requested_end_date
    or requested_end_date - requested_start_date > 366 then
    raise exception 'INVALID_REPORT_REQUEST';
  end if;

  if not exists (
    select 1
    from public.user_roles user_role
    join public.roles role on role.id = user_role.role_id
    join public.clinic_accounts account
      on account.user_id = user_role.user_id
      and account.role = role.name
      and account.is_active = true
    where user_role.user_id = requested_by
      and role.name = 'admin'
  ) then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select * into v_job
  from private.report_requests as report
  where report.requested_by = enqueue_report_request.requested_by
    and report.idempotency_key = requested_idempotency_key
  for update;

  if v_job.id is null then
    insert into private.report_requests (
      requested_by,
      report_type,
      period_start,
      period_end,
      idempotency_key,
      correlation_id
    )
    values (
      requested_by,
      requested_report_type,
      requested_start_date,
      requested_end_date,
      requested_idempotency_key,
      requested_correlation_id
    )
    returning * into v_job;
  elsif v_job.status in ('dead_letter', 'expired')
    or (
      v_job.status = 'completed'
      and v_job.artifact_expires_at <= now()
    ) then
    update private.report_requests
    set
      status = 'queued',
      attempts = 0,
      error_code = null,
      artifact_path = null,
      artifact_size = null,
      artifact_sha256 = null,
      artifact_expires_at = null,
      correlation_id = requested_correlation_id,
      started_at = null,
      completed_at = null,
      updated_at = now()
    where id = v_job.id
    returning * into v_job;
  end if;

  if v_job.status = 'queued'
    and not exists (
      select 1
      from pgmq.q_zentraq_report_jobs as message
      where message.message->>'jobId' = v_job.id::text
    ) then
    perform pgmq.send(
      'zentraq_report_jobs',
      jsonb_build_object(
        'version', 1,
        'jobId', v_job.id,
        'jobType', 'report.generate'
      )
    );
  end if;

  return v_job.id;
end;
$$;

-- Claims a bounded report batch without returning report data.
create or replace function public.claim_report_requests(
  requested_batch_size integer default 2,
  requested_visibility_timeout integer default 180
)
returns table (
  message_id bigint,
  read_count integer,
  report_id uuid,
  correlation_id uuid
)
language sql
security definer
set search_path = ''
as $$
  with messages as (
    select *
    from pgmq.read(
      'zentraq_report_jobs',
      greatest(60, least(requested_visibility_timeout, 600)),
      greatest(1, least(requested_batch_size, 3))
    )
  ),
  claimed as (
    update private.report_requests as report
    set
      status = 'processing',
      attempts = least(
        report.max_attempts,
        greatest(report.attempts + 1, messages.read_ct)
      ),
      started_at = coalesce(report.started_at, now()),
      updated_at = now()
    from messages
    where report.id = (messages.message->>'jobId')::uuid
      and messages.message->>'jobType' = 'report.generate'
      and report.status in ('queued', 'processing')
    returning messages.msg_id, messages.read_ct, report.id, report.correlation_id
  )
  select claimed.msg_id, claimed.read_ct, claimed.id, claimed.correlation_id
  from claimed;
$$;

-- Returns one minimized aggregate payload to the report worker.
create or replace function public.get_report_request_payload(
  requested_report_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report private.report_requests%rowtype;
  v_daily jsonb;
  v_complaints jsonb;
  v_dispensing jsonb;
  v_overview jsonb;
begin
  select * into v_report
  from private.report_requests
  where id = requested_report_id
    and status = 'processing';

  if v_report.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into v_daily
  from (
    select
      consultation_date,
      total_consultations,
      student_consultations,
      faculty_consultations,
      appointment_visits,
      rfid_visits
    from public.v_daily_consultations
    where consultation_date between v_report.period_start and v_report.period_end
    order by consultation_date
    limit 367
  ) as row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into v_complaints
  from (
    select
      left(btrim(consultation.patient_complaint), 100) as complaint,
      count(*)::integer as frequency
    from public.consultations consultation
    where consultation.created_at::date
      between v_report.period_start and v_report.period_end
      and nullif(btrim(consultation.patient_complaint), '') is not null
    group by left(btrim(consultation.patient_complaint), 100)
    having count(*) >= 3
    order by frequency desc
    limit 20
  ) as row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into v_dispensing
  from (
    select
      medicine.id as medicine_id,
      medicine.generic_name,
      medicine.brand_name,
      medicine.category,
      count(log.id)::integer as total_dispensed,
      coalesce(sum(log.quantity), 0)::integer as total_quantity_dispensed,
      min(log.dispensed_at) as first_dispensed,
      max(log.dispensed_at) as last_dispensed
    from public.dispensing_logs log
    join public.medicine_stock stock on stock.id = log.medicine_stock_id
    join public.medicines medicine on medicine.id = stock.medicine_id
    where log.dispensed_at::date
      between v_report.period_start and v_report.period_end
    group by
      medicine.id,
      medicine.generic_name,
      medicine.brand_name,
      medicine.category
    order by sum(log.quantity) desc
    limit 20
  ) as row_data;

  select jsonb_build_object(
    'active_incidents', (
      select count(*)
      from public.incidents
      where status in ('open', 'in-progress')
    ),
    'faculty_consultations', coalesce((
      select sum(faculty_consultations)
      from public.v_daily_consultations
      where consultation_date between v_report.period_start and v_report.period_end
    ), 0),
    'low_stock_medicines', (
      select count(*)
      from public.v_medicine_stock_summary
      where total_quantity <= min_stock_level
    ),
    'pending_clearances', (
      select count(*)
      from public.health_clearances
      where status in ('pending', 'evaluating')
    ),
    'period_end', v_report.period_end,
    'period_start', v_report.period_start,
    'student_consultations', coalesce((
      select sum(student_consultations)
      from public.v_daily_consultations
      where consultation_date between v_report.period_start and v_report.period_end
    ), 0),
    'total_consultations', coalesce((
      select sum(total_consultations)
      from public.v_daily_consultations
      where consultation_date between v_report.period_start and v_report.period_end
    ), 0)
  ) into v_overview;

  return jsonb_build_object(
    'complaints', v_complaints,
    'daily', v_daily,
    'dispensing', v_dispensing,
    'overview', v_overview,
    'reportId', v_report.id,
    'requestedBy', v_report.requested_by
  );
end;
$$;

-- Completes one report request after its private artifact is uploaded.
create or replace function public.complete_report_request(
  requested_report_id uuid,
  requested_message_id bigint,
  requested_artifact_path text,
  requested_artifact_size bigint,
  requested_artifact_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report private.report_requests%rowtype;
  v_message jsonb;
begin
  select * into v_report
  from private.report_requests
  where id = requested_report_id
  for update;

  select message into v_message
  from pgmq.q_zentraq_report_jobs
  where msg_id = requested_message_id;

  if v_report.id is null
    or v_report.status <> 'processing'
    or v_message->>'jobId' <> requested_report_id::text
    or requested_artifact_path <> (
      v_report.requested_by::text || '/' || v_report.id::text || '/report.xlsx'
    )
    or requested_artifact_size not between 1 and 10485760
    or requested_artifact_sha256 !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  perform pgmq.archive('zentraq_report_jobs', requested_message_id);

  update private.report_requests
  set
    status = 'completed',
    error_code = null,
    artifact_path = requested_artifact_path,
    artifact_size = requested_artifact_size,
    artifact_sha256 = requested_artifact_sha256,
    artifact_expires_at = now() + interval '24 hours',
    completed_at = now(),
    updated_at = now()
  where id = requested_report_id;

  return true;
end;
$$;

-- Records a sanitized report failure and dead-letters exhausted work.
create or replace function public.fail_report_request(
  requested_report_id uuid,
  requested_message_id bigint,
  requested_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report private.report_requests%rowtype;
begin
  if requested_error_code !~ '^[A-Z0-9_]{3,64}$' then
    requested_error_code := 'WORKER_FAILURE';
  end if;

  select * into v_report
  from private.report_requests
  where id = requested_report_id
  for update;

  if v_report.id is null or v_report.status <> 'processing' then
    return false;
  end if;

  if v_report.attempts >= v_report.max_attempts then
    perform pgmq.archive('zentraq_report_jobs', requested_message_id);
    update private.report_requests
    set status = 'dead_letter', error_code = requested_error_code, updated_at = now()
    where id = requested_report_id;
  else
    update private.report_requests
    set status = 'queued', error_code = requested_error_code, updated_at = now()
    where id = requested_report_id;
  end if;

  return true;
end;
$$;

-- Returns one report status only when the supplied Admin owns it.
create or replace function public.get_report_request_status(
  requested_report_id uuid,
  requested_by uuid
)
returns table (
  id uuid,
  status text,
  error_code text,
  artifact_path text,
  artifact_expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    report.id,
    case
      when report.status = 'completed'
        and report.artifact_expires_at <= now() then 'expired'
      else report.status
    end,
    report.error_code,
    report.artifact_path,
    report.artifact_expires_at
  from private.report_requests as report
  where report.id = requested_report_id
    and report.requested_by = get_report_request_status.requested_by
    and exists (
      select 1
      from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      join public.clinic_accounts account
        on account.user_id = user_role.user_id
        and account.role = role.name
        and account.is_active = true
      where user_role.user_id = get_report_request_status.requested_by
        and role.name = 'admin'
    );
$$;

-- Lists a bounded set of expired private artifacts for worker cleanup.
create or replace function public.list_expired_report_artifacts()
returns table (id uuid, artifact_path text)
language sql
security definer
set search_path = ''
as $$
  select report.id, report.artifact_path
  from private.report_requests as report
  where report.status = 'completed'
    and report.artifact_expires_at <= now()
    and report.artifact_path is not null
  order by report.artifact_expires_at
  limit 20;
$$;

-- Marks an artifact expired only after the worker removes it from Storage.
create or replace function public.mark_report_artifact_expired(
  requested_report_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update private.report_requests
  set
    status = 'expired',
    artifact_path = null,
    artifact_size = null,
    artifact_sha256 = null,
    updated_at = now()
  where id = requested_report_id
    and status = 'completed'
    and artifact_expires_at <= now()
  returning true;
$$;

revoke all on function public.enqueue_report_request(
  uuid, text, date, date, text, uuid
) from public, anon, authenticated;
revoke all on function public.claim_report_requests(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_report_request_payload(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_report_request(uuid, bigint, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.fail_report_request(uuid, bigint, text)
  from public, anon, authenticated;
revoke all on function public.get_report_request_status(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.list_expired_report_artifacts()
  from public, anon, authenticated;
revoke all on function public.mark_report_artifact_expired(uuid)
  from public, anon, authenticated;

grant execute on function public.enqueue_report_request(
  uuid, text, date, date, text, uuid
) to service_role;
grant execute on function public.claim_report_requests(integer, integer)
  to service_role;
grant execute on function public.get_report_request_payload(uuid)
  to service_role;
grant execute on function public.complete_report_request(uuid, bigint, text, bigint, text)
  to service_role;
grant execute on function public.fail_report_request(uuid, bigint, text)
  to service_role;
grant execute on function public.get_report_request_status(uuid, uuid)
  to service_role;
grant execute on function public.list_expired_report_artifacts()
  to service_role;
grant execute on function public.mark_report_artifact_expired(uuid)
  to service_role;
