set statement_timeout = '30s';

create extension if not exists pgmq;

do $$
begin
  if to_regclass('private.report_requests') is null
    or to_regclass('public.users') is null
    or to_regclass('public.user_roles') is null
    or to_regclass('public.roles') is null
    or to_regclass('public.clinic_accounts') is null then
    raise exception 'REPORT_DELIVERY_READINESS_CHECK_FAILED';
  end if;
end;
$$;

-- Validates a bounded array of normalized email addresses.
create or replace function private.report_delivery_emails_valid(
  requested_emails text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(
    email = lower(btrim(email))
    and email ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    and char_length(email) <= 254
  ), true)
  from unnest(requested_emails) as recipient(email);
$$;

create table if not exists private.report_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references private.report_requests(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  upload_to_drive boolean not null,
  publish_to_sheets boolean not null,
  email_recipients text[] not null default '{}',
  idempotency_key text not null,
  correlation_id uuid not null,
  status text not null default 'queued',
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  drive_status text not null,
  drive_file_id text,
  drive_web_view_link text,
  sheets_status text not null,
  sheets_snapshot_id uuid,
  sheets_published_at timestamptz,
  gmail_status text not null,
  gmail_deliveries jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint report_delivery_destination_check check (
    upload_to_drive
    or publish_to_sheets
    or cardinality(email_recipients) > 0
  ),
  constraint report_delivery_email_drive_check check (
    cardinality(email_recipients) = 0 or upload_to_drive
  ),
  constraint report_delivery_recipient_count_check check (
    cardinality(email_recipients) between 0 and 10
  ),
  constraint report_delivery_recipient_format_check check (
    private.report_delivery_emails_valid(email_recipients)
  ),
  constraint report_delivery_idempotency_check check (
    idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'
  ),
  constraint report_delivery_status_check check (
    status in ('queued', 'processing', 'completed', 'dead_letter')
  ),
  constraint report_delivery_attempts_check check (
    attempts between 0 and max_attempts
  ),
  constraint report_delivery_drive_status_check check (
    drive_status in ('pending', 'completed', 'skipped')
  ),
  constraint report_delivery_sheets_status_check check (
    sheets_status in ('pending', 'completed', 'skipped')
  ),
  constraint report_delivery_gmail_status_check check (
    gmail_status in ('pending', 'completed', 'skipped')
  ),
  constraint report_delivery_error_code_check check (
    error_code is null or error_code ~ '^[A-Z0-9_]{3,64}$'
  ),
  constraint report_delivery_owner_idempotency_unique unique (
    requested_by,
    idempotency_key
  )
);

alter table private.report_delivery_jobs enable row level security;
revoke all on table private.report_delivery_jobs
  from public, anon, authenticated, service_role;

create index if not exists report_delivery_status_created_idx
  on private.report_delivery_jobs (status, created_at);
create index if not exists report_delivery_report_idx
  on private.report_delivery_jobs (report_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues() as queue
    where queue.queue_name = 'zentraq_report_delivery_jobs'
  ) then
    perform pgmq.create('zentraq_report_delivery_jobs');
  end if;
end;
$$;

alter table pgmq.q_zentraq_report_delivery_jobs enable row level security;
alter table pgmq.a_zentraq_report_delivery_jobs enable row level security;
revoke all on table pgmq.q_zentraq_report_delivery_jobs
  from public, anon, authenticated, service_role;
revoke all on table pgmq.a_zentraq_report_delivery_jobs
  from public, anon, authenticated, service_role;

-- Enqueues one idempotent Admin-owned external report delivery.
create or replace function public.enqueue_report_delivery_job(
  requested_report_id uuid,
  requested_by uuid,
  requested_upload_to_drive boolean,
  requested_publish_to_sheets boolean,
  requested_email_recipients text[],
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.report_delivery_jobs%rowtype;
  v_recipients text[];
begin
  select coalesce(array_agg(distinct lower(btrim(email))), '{}')
  into v_recipients
  from unnest(coalesce(requested_email_recipients, '{}')) as recipient(email);

  if requested_report_id is null
    or requested_by is null
    or requested_correlation_id is null
    or requested_idempotency_key !~ '^[A-Za-z0-9._:-]{8,128}$'
    or cardinality(v_recipients) > 10
    or not private.report_delivery_emails_valid(v_recipients)
    or not (
      requested_upload_to_drive
      or requested_publish_to_sheets
      or cardinality(v_recipients) > 0
    )
    or (cardinality(v_recipients) > 0 and not requested_upload_to_drive) then
    raise exception 'INVALID_REPORT_DELIVERY_REQUEST';
  end if;

  if not exists (
    select 1
    from private.report_requests report
    join public.user_roles user_role
      on user_role.user_id = report.requested_by
    join public.roles role
      on role.id = user_role.role_id
    join public.clinic_accounts account
      on account.user_id = report.requested_by
      and account.role = role.name
      and account.is_active = true
    where report.id = requested_report_id
      and report.requested_by = enqueue_report_delivery_job.requested_by
      and report.status = 'completed'
      and report.artifact_path is not null
      and report.artifact_expires_at > now()
      and role.name = 'admin'
  ) then
    raise exception 'COMPLETED_ADMIN_REPORT_REQUIRED';
  end if;

  insert into private.report_delivery_jobs (
    report_id,
    requested_by,
    upload_to_drive,
    publish_to_sheets,
    email_recipients,
    idempotency_key,
    correlation_id,
    drive_status,
    sheets_status,
    gmail_status
  )
  values (
    requested_report_id,
    requested_by,
    requested_upload_to_drive,
    requested_publish_to_sheets,
    v_recipients,
    requested_idempotency_key,
    requested_correlation_id,
    case when requested_upload_to_drive then 'pending' else 'skipped' end,
    case when requested_publish_to_sheets then 'pending' else 'skipped' end,
    case when cardinality(v_recipients) > 0 then 'pending' else 'skipped' end
  )
  on conflict (requested_by, idempotency_key)
  do update set updated_at = excluded.updated_at
  returning * into v_job;

  if v_job.report_id <> requested_report_id
    or v_job.upload_to_drive <> requested_upload_to_drive
    or v_job.publish_to_sheets <> requested_publish_to_sheets
    or v_job.email_recipients <> v_recipients then
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;

  if v_job.status = 'queued'
    and not exists (
      select 1
      from pgmq.q_zentraq_report_delivery_jobs as message
      where message.message->>'jobId' = v_job.id::text
    ) then
    perform pgmq.send(
      'zentraq_report_delivery_jobs',
      jsonb_build_object(
        'version', 1,
        'jobId', v_job.id,
        'jobType', 'report.deliver'
      )
    );
  end if;

  return v_job.id;
end;
$$;

-- Claims a bounded delivery batch without exposing recipient data.
create or replace function public.claim_report_delivery_jobs(
  requested_batch_size integer default 2,
  requested_visibility_timeout integer default 180
)
returns table (
  message_id bigint,
  delivery_job_id uuid,
  correlation_id uuid
)
language sql
security definer
set search_path = ''
as $$
  with messages as (
    select *
    from pgmq.read(
      'zentraq_report_delivery_jobs',
      greatest(30, least(requested_visibility_timeout, 300)),
      greatest(1, least(requested_batch_size, 2))
    )
  ),
  claimed as (
    update private.report_delivery_jobs as job
    set
      status = 'processing',
      attempts = least(job.max_attempts, greatest(job.attempts + 1, messages.read_ct)),
      started_at = coalesce(job.started_at, now()),
      updated_at = now()
    from messages
    where job.id = (messages.message->>'jobId')::uuid
      and messages.message->>'jobType' = 'report.deliver'
      and job.status in ('queued', 'processing')
    returning messages.msg_id, job.id, job.correlation_id
  )
  select claimed.msg_id, claimed.id, claimed.correlation_id
  from claimed;
$$;

-- Returns one private delivery payload with sanitized aggregate rows.
create or replace function public.get_report_delivery_payload(
  requested_delivery_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.report_delivery_jobs%rowtype;
  v_report private.report_requests%rowtype;
  v_clearances jsonb;
  v_complaints jsonb;
  v_daily jsonb;
  v_dispensing jsonb;
begin
  select * into v_job
  from private.report_delivery_jobs
  where id = requested_delivery_job_id
    and status = 'processing';

  if v_job.id is null then
    return null;
  end if;

  select * into v_report
  from private.report_requests
  where id = v_job.report_id
    and status = 'completed'
    and artifact_path is not null
    and artifact_expires_at > now();

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
      medicine.generic_name,
      medicine.brand_name,
      medicine.category
    order by sum(log.quantity) desc
    limit 20
  ) as row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into v_clearances
  from (
    select
      clearance.requester_type,
      count(*)::integer as total_requests,
      count(*) filter (where clearance.status = 'approved')::integer as approved,
      count(*) filter (where clearance.status = 'rejected')::integer as rejected,
      count(*) filter (where clearance.status = 'pending')::integer as pending,
      count(*) filter (where clearance.status = 'evaluating')::integer as evaluating
    from public.health_clearances clearance
    where clearance.created_at::date
      between v_report.period_start and v_report.period_end
    group by clearance.requester_type
    order by clearance.requester_type
  ) as row_data;

  return jsonb_build_object(
    'artifactPath', v_report.artifact_path,
    'clearances', v_clearances,
    'complaints', v_complaints,
    'completedEmails', v_job.gmail_deliveries,
    'daily', v_daily,
    'dispensing', v_dispensing,
    'driveFileId', v_job.drive_file_id,
    'driveWebViewLink', v_job.drive_web_view_link,
    'emailRecipients', to_jsonb(v_job.email_recipients),
    'idempotencyKey', v_job.idempotency_key,
    'periodEnd', v_report.period_end,
    'periodStart', v_report.period_start,
    'publishToSheets', v_job.publish_to_sheets,
    'reportId', v_report.id,
    'reportName', 'Zentraq Clinic Aggregate Report',
    'requestedBy', v_job.requested_by,
    'sheetsPublishedAt', v_job.sheets_published_at,
    'sheetsSnapshotId', v_job.sheets_snapshot_id,
    'uploadToDrive', v_job.upload_to_drive
  );
end;
$$;

-- Records one restricted Drive upload after provider confirmation.
create or replace function public.record_report_delivery_drive(
  requested_delivery_job_id uuid,
  requested_drive_file_id text,
  requested_drive_web_view_link text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update private.report_delivery_jobs
  set
    drive_status = 'completed',
    drive_file_id = left(requested_drive_file_id, 200),
    drive_web_view_link = left(requested_drive_web_view_link, 500),
    updated_at = now()
  where id = requested_delivery_job_id
    and status = 'processing'
    and upload_to_drive = true
    and requested_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'
    and requested_drive_web_view_link
      ~ '^https://(drive|docs)\.google\.com/'
  returning true;
$$;

-- Records one completed Sheets snapshot after all aggregate tabs publish.
create or replace function public.record_report_delivery_sheets(
  requested_delivery_job_id uuid,
  requested_snapshot_id uuid,
  requested_published_at timestamptz
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update private.report_delivery_jobs
  set
    sheets_status = 'completed',
    sheets_snapshot_id = requested_snapshot_id,
    sheets_published_at = requested_published_at,
    updated_at = now()
  where id = requested_delivery_job_id
    and status = 'processing'
    and publish_to_sheets = true
    and requested_snapshot_id = requested_delivery_job_id
    and requested_published_at <= now() + interval '5 minutes'
  returning true;
$$;

-- Records one accepted Gmail message without exposing recipients publicly.
create or replace function public.record_report_delivery_email(
  requested_delivery_job_id uuid,
  requested_recipient text,
  requested_gmail_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient text := lower(btrim(requested_recipient));
begin
  update private.report_delivery_jobs
  set
    gmail_deliveries = gmail_deliveries || jsonb_build_object(
      v_recipient,
      left(requested_gmail_message_id, 200)
    ),
    gmail_status = case
      when cardinality(email_recipients) <= (
        select count(*)
        from jsonb_object_keys(
          gmail_deliveries || jsonb_build_object(
            v_recipient,
            left(requested_gmail_message_id, 200)
          )
        )
      ) then 'completed'
      else 'pending'
    end,
    updated_at = now()
  where id = requested_delivery_job_id
    and status = 'processing'
    and v_recipient = any(email_recipients)
    and requested_gmail_message_id ~ '^[A-Za-z0-9_-]{5,200}$';

  return found;
end;
$$;

-- Completes a delivery only when every requested destination is confirmed.
create or replace function public.complete_report_delivery_job(
  requested_delivery_job_id uuid,
  requested_message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.report_delivery_jobs%rowtype;
  v_message jsonb;
begin
  select * into v_job
  from private.report_delivery_jobs
  where id = requested_delivery_job_id
  for update;

  select message into v_message
  from pgmq.q_zentraq_report_delivery_jobs
  where msg_id = requested_message_id;

  if v_job.id is null
    or v_job.status <> 'processing'
    or v_message->>'jobId' <> requested_delivery_job_id::text
    or v_job.drive_status = 'pending'
    or v_job.sheets_status = 'pending'
    or v_job.gmail_status = 'pending' then
    return false;
  end if;

  perform pgmq.archive(
    'zentraq_report_delivery_jobs',
    requested_message_id
  );
  update private.report_delivery_jobs
  set
    status = 'completed',
    error_code = null,
    completed_at = now(),
    updated_at = now()
  where id = requested_delivery_job_id;
  return true;
end;
$$;

-- Requeues temporary delivery failures and dead-letters exhausted attempts.
create or replace function public.fail_report_delivery_job(
  requested_delivery_job_id uuid,
  requested_message_id bigint,
  requested_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.report_delivery_jobs%rowtype;
begin
  if requested_error_code !~ '^[A-Z0-9_]{3,64}$' then
    requested_error_code := 'REPORT_DELIVERY_FAILED';
  end if;

  select * into v_job
  from private.report_delivery_jobs
  where id = requested_delivery_job_id
  for update;

  if v_job.id is null or v_job.status <> 'processing' then
    return false;
  end if;

  if v_job.attempts >= v_job.max_attempts
    or requested_error_code in (
      'GOOGLE_PERMISSION_OR_REQUEST_FAILURE',
      'GMAIL_PERMISSION_OR_REQUEST_FAILURE',
      'GMAIL_RECIPIENT_NOT_ALLOWED'
    ) then
    perform pgmq.archive(
      'zentraq_report_delivery_jobs',
      requested_message_id
    );
    update private.report_delivery_jobs
    set
      status = 'dead_letter',
      error_code = requested_error_code,
      updated_at = now()
    where id = requested_delivery_job_id;
  else
    update private.report_delivery_jobs
    set
      status = 'queued',
      error_code = requested_error_code,
      updated_at = now()
    where id = requested_delivery_job_id;
  end if;

  return true;
end;
$$;

-- Returns a public-safe status only to the Admin who requested delivery.
create or replace function public.get_report_delivery_job_status(
  requested_delivery_job_id uuid,
  requested_by uuid
)
returns table (
  id uuid,
  report_id uuid,
  status text,
  drive_status text,
  drive_file_id text,
  drive_web_view_link text,
  sheets_status text,
  sheets_snapshot_id uuid,
  sheets_published_at timestamptz,
  gmail_status text,
  retry_count smallint,
  error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    job.id,
    job.report_id,
    job.status,
    job.drive_status,
    job.drive_file_id,
    job.drive_web_view_link,
    job.sheets_status,
    job.sheets_snapshot_id,
    job.sheets_published_at,
    job.gmail_status,
    job.attempts,
    job.error_code,
    job.created_at,
    job.updated_at
  from private.report_delivery_jobs job
  where job.id = requested_delivery_job_id
    and job.requested_by = get_report_delivery_job_status.requested_by
    and exists (
      select 1
      from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      join public.clinic_accounts account
        on account.user_id = user_role.user_id
        and account.role = role.name
        and account.is_active = true
      where user_role.user_id = get_report_delivery_job_status.requested_by
        and role.name = 'admin'
    );
$$;

-- Extends the existing Render wake-up allowlist for delivery retries.
create or replace function private.invoke_zentraq_render_worker(
  requested_worker text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_size integer;
  v_queue_length bigint;
  v_queue_name text;
  v_request_id bigint;
  v_service_key text;
  v_url text;
begin
  case requested_worker
    when 'notifications' then
      v_queue_name := 'zentraq_notification_jobs';
      v_batch_size := 10;
      select decrypted_secret into v_url
      from vault.decrypted_secrets
      where name = 'zentraq_notifications_worker_url'
      limit 1;
    when 'reports' then
      v_queue_name := 'zentraq_report_jobs';
      v_batch_size := 2;
      select decrypted_secret into v_url
      from vault.decrypted_secrets
      where name = 'zentraq_reports_worker_url'
      limit 1;
    when 'report-deliveries' then
      v_queue_name := 'zentraq_report_delivery_jobs';
      v_batch_size := 2;
      select decrypted_secret into v_url
      from vault.decrypted_secrets
      where name = 'zentraq_report_deliveries_worker_url'
      limit 1;
    else
      raise exception 'WORKER_NOT_ALLOWED';
  end case;

  select metrics.queue_length into v_queue_length
  from pgmq.metrics(v_queue_name) metrics;
  if coalesce(v_queue_length, 0) = 0 then
    return null;
  end if;

  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'zentraq_worker_service_key'
  limit 1;
  if v_service_key is null or char_length(v_service_key) < 32 then
    return null;
  end if;

  if requested_worker = 'notifications'
    and v_url !~ '^https://[a-z0-9-]+\.onrender\.com/internal/workers/notifications/drain$' then
    return null;
  end if;
  if requested_worker = 'reports'
    and v_url !~ '^https://[a-z0-9-]+\.onrender\.com/internal/workers/reports/drain$' then
    return null;
  end if;
  if requested_worker = 'report-deliveries'
    and v_url !~ '^https://[a-z0-9-]+\.onrender\.com/internal/workers/report-deliveries/drain$' then
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-zentraq-service-key', v_service_key
    ),
    body := jsonb_build_object('batchSize', v_batch_size),
    timeout_milliseconds := case
      when requested_worker in ('reports', 'report-deliveries') then 55000
      else 30000
    end
  ) into v_request_id;
  return v_request_id;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'zentraq-report-deliveries-worker';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'zentraq-report-deliveries-worker',
    '* * * * *',
    $command$select private.invoke_zentraq_render_worker('report-deliveries');$command$
  );
end;
$$;

revoke all on function private.report_delivery_emails_valid(text[])
  from public, anon, authenticated, service_role;
revoke all on function public.enqueue_report_delivery_job(
  uuid, uuid, boolean, boolean, text[], text, uuid
) from public, anon, authenticated;
revoke all on function public.claim_report_delivery_jobs(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_report_delivery_payload(uuid)
  from public, anon, authenticated;
revoke all on function public.record_report_delivery_drive(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.record_report_delivery_sheets(
  uuid, uuid, timestamptz
) from public, anon, authenticated;
revoke all on function public.record_report_delivery_email(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_report_delivery_job(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.fail_report_delivery_job(uuid, bigint, text)
  from public, anon, authenticated;
revoke all on function public.get_report_delivery_job_status(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.invoke_zentraq_render_worker(text)
  from public, anon, authenticated, service_role;

grant execute on function public.enqueue_report_delivery_job(
  uuid, uuid, boolean, boolean, text[], text, uuid
) to service_role;
grant execute on function public.claim_report_delivery_jobs(integer, integer)
  to service_role;
grant execute on function public.get_report_delivery_payload(uuid)
  to service_role;
grant execute on function public.record_report_delivery_drive(uuid, text, text)
  to service_role;
grant execute on function public.record_report_delivery_sheets(
  uuid, uuid, timestamptz
) to service_role;
grant execute on function public.record_report_delivery_email(uuid, text, text)
  to service_role;
grant execute on function public.complete_report_delivery_job(uuid, bigint)
  to service_role;
grant execute on function public.fail_report_delivery_job(uuid, bigint, text)
  to service_role;
grant execute on function public.get_report_delivery_job_status(uuid, uuid)
  to service_role;
