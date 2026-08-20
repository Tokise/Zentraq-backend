set statement_timeout = '30s';

create extension if not exists pgmq;

do $$
begin
  if to_regclass('public.notifications') is null
    or to_regclass('public.user_roles') is null
    or to_regclass('public.roles') is null
    or to_regclass('public.clinic_accounts') is null then
    raise exception 'NOTIFICATION_SERVICE_READINESS_CHECK_FAILED';
  end if;
end;
$$;

alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists read_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'related_resource'
  ) then
    execute $sql$
      update public.notifications
      set entity_type = coalesce(entity_type, related_resource)
      where related_resource is not null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'related_resource_id'
  ) then
    execute $sql$
      update public.notifications
      set entity_id = coalesce(entity_id, related_resource_id)
      where related_resource_id is not null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'is_read'
  ) then
    execute $sql$
      update public.notifications
      set read_at = coalesce(read_at, updated_at, created_at)
      where is_read = true and read_at is null
    $sql$;
  end if;
end;
$$;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'appointment',
      'clearance',
      'consultation',
      'emergency',
      'incident',
      'inventory',
      'rfid',
      'service',
      'system',
      'visit_log'
    )
  );

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own non-deleted notifications"
  on public.notifications;
drop policy if exists "Users can update their own notifications"
  on public.notifications;
drop policy if exists "Users can insert notifications for themselves only"
  on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_read_state on public.notifications;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  receiver_id = (select auth.uid())
  and is_deleted = false
);

create policy notifications_update_read_state
on public.notifications
for update
to authenticated
using (receiver_id = (select auth.uid()))
with check (receiver_id = (select auth.uid()));

revoke all on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create index if not exists notifications_receiver_read_at_idx
  on public.notifications (receiver_id, read_at, created_at desc)
  where is_deleted = false;

create table if not exists private.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,
  entity_type text,
  entity_id uuid,
  idempotency_key text not null,
  correlation_id uuid not null,
  status text not null default 'queued',
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint notification_jobs_template_check check (
    template_key in (
      'appointment.updated',
      'clearance.updated',
      'inventory.attention',
      'system.notice'
    )
  ),
  constraint notification_jobs_entity_type_check check (
    entity_type is null
    or entity_type in ('appointment', 'clearance', 'inventory', 'system')
  ),
  constraint notification_jobs_entity_pair_check check (
    (entity_type is null and entity_id is null)
    or (entity_type is not null and entity_id is not null)
  ),
  constraint notification_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'dead_letter')
  ),
  constraint notification_jobs_attempts_check check (
    attempts between 0 and max_attempts
  ),
  constraint notification_jobs_idempotency_check check (
    idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'
  ),
  constraint notification_jobs_error_code_check check (
    error_code is null or error_code ~ '^[A-Z0-9_]{3,64}$'
  ),
  constraint notification_jobs_idempotency_unique unique (
    receiver_id,
    idempotency_key
  )
);

alter table private.notification_jobs enable row level security;
revoke all on table private.notification_jobs
  from public, anon, authenticated, service_role;

create index if not exists notification_jobs_status_created_idx
  on private.notification_jobs (status, created_at);

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues() as queue
    where queue.queue_name = 'zentraq_notification_jobs'
  ) then
    perform pgmq.create('zentraq_notification_jobs');
  end if;
end;
$$;

alter table pgmq.q_zentraq_notification_jobs enable row level security;
alter table pgmq.a_zentraq_notification_jobs enable row level security;
revoke all on table pgmq.q_zentraq_notification_jobs
  from public, anon, authenticated, service_role;
revoke all on table pgmq.a_zentraq_notification_jobs
  from public, anon, authenticated, service_role;

-- Enqueues one metadata-only notification job for an approved server workflow.
create or replace function public.enqueue_notification_job(
  requested_by uuid,
  requested_receiver_id uuid,
  requested_template_key text,
  requested_entity_type text,
  requested_entity_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  if requested_by is null
    or requested_receiver_id is null
    or requested_correlation_id is null then
    raise exception 'INVALID_NOTIFICATION_JOB';
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

  if not exists (
    select 1
    from auth.users auth_user
    join public.users app_user on app_user.id = auth_user.id
    join public.user_roles user_role on user_role.user_id = app_user.id
    join public.roles role on role.id = user_role.role_id
    where auth_user.id = requested_receiver_id
      and (
        (
          role.name in ('admin', 'doctor', 'nurse')
          and exists (
            select 1
            from public.clinic_accounts account
            where account.user_id = auth_user.id
              and account.role = role.name
              and account.is_active = true
          )
        )
        or (
          role.name = 'student'
          and exists (
            select 1
            from public.students student
            where student.user_id = auth_user.id
              and student.status = 'active'
          )
        )
        or (
          role.name = 'faculty'
          and exists (
            select 1
            from public.faculty faculty
            where faculty.user_id = auth_user.id
              and faculty.status = 'active'
          )
        )
        or (
          role.name = 'staff'
          and exists (
            select 1
            from public.staff staff
            where staff.user_id = auth_user.id
              and staff.status = 'active'
          )
        )
      )
  ) then
    raise exception 'RECIPIENT_UNAVAILABLE';
  end if;

  insert into private.notification_jobs (
    requested_by,
    receiver_id,
    template_key,
    entity_type,
    entity_id,
    idempotency_key,
    correlation_id
  )
  values (
    requested_by,
    requested_receiver_id,
    requested_template_key,
    requested_entity_type,
    requested_entity_id,
    requested_idempotency_key,
    requested_correlation_id
  )
  on conflict (receiver_id, idempotency_key)
  do update set updated_at = excluded.updated_at
  returning id into v_job_id;

  if not exists (
    select 1
    from pgmq.q_zentraq_notification_jobs as message
    where message.message->>'jobId' = v_job_id::text
  ) and exists (
    select 1
    from private.notification_jobs as job
    where job.id = v_job_id and job.status = 'queued'
  ) then
    perform pgmq.send(
      'zentraq_notification_jobs',
      jsonb_build_object(
        'version', 1,
        'jobId', v_job_id,
        'jobType', 'notification.deliver'
      )
    );
  end if;

  return v_job_id;
end;
$$;

-- Claims a bounded notification batch without returning notification content.
create or replace function public.claim_notification_jobs(
  requested_batch_size integer default 10,
  requested_visibility_timeout integer default 60
)
returns table (
  message_id bigint,
  read_count integer,
  job_id uuid,
  correlation_id uuid
)
language sql
security definer
set search_path = ''
as $$
  with messages as (
    select *
    from pgmq.read(
      'zentraq_notification_jobs',
      greatest(15, least(requested_visibility_timeout, 300)),
      greatest(1, least(requested_batch_size, 20))
    )
  ),
  claimed as (
    update private.notification_jobs as job
    set
      status = 'processing',
      attempts = least(job.max_attempts, greatest(job.attempts + 1, messages.read_ct)),
      started_at = coalesce(job.started_at, now()),
      updated_at = now()
    from messages
    where job.id = (messages.message->>'jobId')::uuid
      and messages.message->>'jobType' = 'notification.deliver'
      and job.status in ('queued', 'processing')
    returning messages.msg_id, messages.read_ct, job.id, job.correlation_id
  )
  select claimed.msg_id, claimed.read_ct, claimed.id, claimed.correlation_id
  from claimed;
$$;

-- Creates the allowlisted notification and archives the claimed message.
create or replace function public.complete_notification_job(
  requested_job_id uuid,
  requested_message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.notification_jobs%rowtype;
  v_message jsonb;
begin
  select * into v_job
  from private.notification_jobs
  where id = requested_job_id
  for update;

  select message into v_message
  from pgmq.q_zentraq_notification_jobs
  where msg_id = requested_message_id;

  if v_job.id is null
    or v_job.status <> 'processing'
    or v_message->>'jobId' <> requested_job_id::text then
    return false;
  end if;

  insert into public.notifications (
    sender_id,
    receiver_id,
    title,
    message,
    type,
    entity_type,
    entity_id
  )
  values (
    v_job.requested_by,
    v_job.receiver_id,
    case v_job.template_key
      when 'appointment.updated' then 'Appointment update'
      when 'clearance.updated' then 'Clearance update'
      when 'inventory.attention' then 'Inventory update'
      else 'System notice'
    end,
    case v_job.template_key
      when 'appointment.updated' then 'An appointment update is available in Zentraq.'
      when 'clearance.updated' then 'A clearance update is available in Zentraq.'
      when 'inventory.attention' then 'An inventory item requires attention in Zentraq.'
      else 'A new system notice is available in Zentraq.'
    end,
    split_part(v_job.template_key, '.', 1),
    v_job.entity_type,
    v_job.entity_id
  );

  perform pgmq.archive('zentraq_notification_jobs', requested_message_id);

  update private.notification_jobs
  set
    status = 'completed',
    error_code = null,
    completed_at = now(),
    updated_at = now()
  where id = requested_job_id;

  return true;
end;
$$;

-- Records a sanitized failure and dead-letters exhausted jobs.
create or replace function public.fail_notification_job(
  requested_job_id uuid,
  requested_message_id bigint,
  requested_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.notification_jobs%rowtype;
begin
  if requested_error_code !~ '^[A-Z0-9_]{3,64}$' then
    requested_error_code := 'WORKER_FAILURE';
  end if;

  select * into v_job
  from private.notification_jobs
  where id = requested_job_id
  for update;

  if v_job.id is null or v_job.status <> 'processing' then
    return false;
  end if;

  if v_job.attempts >= v_job.max_attempts then
    perform pgmq.archive('zentraq_notification_jobs', requested_message_id);
    update private.notification_jobs
    set status = 'dead_letter', error_code = requested_error_code, updated_at = now()
    where id = requested_job_id;
  else
    update private.notification_jobs
    set status = 'queued', error_code = requested_error_code, updated_at = now()
    where id = requested_job_id;
  end if;

  return true;
end;
$$;

revoke all on function public.enqueue_notification_job(
  uuid, uuid, text, text, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function public.claim_notification_jobs(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_notification_job(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.fail_notification_job(uuid, bigint, text)
  from public, anon, authenticated;

grant execute on function public.enqueue_notification_job(
  uuid, uuid, text, text, uuid, text, uuid
) to service_role;
grant execute on function public.claim_notification_jobs(integer, integer)
  to service_role;
grant execute on function public.complete_notification_job(uuid, bigint)
  to service_role;
grant execute on function public.fail_notification_job(uuid, bigint, text)
  to service_role;
