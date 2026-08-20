set statement_timeout = '30s';

-- Returns only authenticated identity and verified active role assignments.
create or replace function public.resolve_request_context_v1()
returns table (
  user_id uuid,
  roles text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_roles text[];
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select array_agg(distinct role.name order by role.name)
  into v_roles
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  where user_role.user_id = v_user_id
    and role.name in ('admin', 'doctor', 'nurse', 'student', 'faculty', 'staff')
    and (
      (
        role.name in ('admin', 'doctor', 'nurse')
        and exists (
          select 1
          from public.clinic_accounts account
          where account.user_id = v_user_id
            and account.role = role.name
            and account.is_active
        )
      )
      or (
        role.name = 'student'
        and exists (
          select 1
          from public.students student
          where student.user_id = v_user_id
            and student.status = 'active'
        )
      )
      or (
        role.name = 'faculty'
        and exists (
          select 1
          from public.faculty faculty
          where faculty.user_id = v_user_id
            and faculty.status = 'active'
        )
      )
      or (
        role.name = 'staff'
        and exists (
          select 1
          from public.staff staff
          where staff.user_id = v_user_id
            and staff.status = 'active'
        )
      )
    );

  if coalesce(array_length(v_roles, 1), 0) = 0 then
    return;
  end if;

  return query select v_user_id, v_roles;
end;
$$;

revoke all on function public.resolve_request_context_v1()
  from public, anon, service_role;
grant execute on function public.resolve_request_context_v1()
  to authenticated;

-- Resolves only the signed-in user's active patient reference.
create or replace function public.resolve_patient_reference_v1()
returns table (
  patient_id uuid,
  patient_type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  return query
  select student.id, 'student'::text
  from public.students student
  where student.user_id = v_user_id
    and student.status = 'active'
  union all
  select faculty.id, 'faculty'::text
  from public.faculty faculty
  where faculty.user_id = v_user_id
    and faculty.status = 'active'
  union all
  select staff.id, 'staff'::text
  from public.staff staff
  where staff.user_id = v_user_id
    and staff.status = 'active'
  limit 1;
end;
$$;

revoke all on function public.resolve_patient_reference_v1()
  from public, anon, service_role;
grant execute on function public.resolve_patient_reference_v1()
  to authenticated;

-- Wakes an allowlisted Render worker only when its fixed PGMQ queue has work.
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

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-zentraq-service-key', v_service_key
    ),
    body := jsonb_build_object('batchSize', v_batch_size),
    timeout_milliseconds := case
      when requested_worker = 'reports' then 55000
      else 30000
    end
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_zentraq_render_worker(text)
  from public, anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'zentraq-notifications-worker';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'zentraq-reports-worker';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'zentraq-notifications-worker',
    '* * * * *',
    $command$select private.invoke_zentraq_render_worker('notifications');$command$
  );

  perform cron.schedule(
    'zentraq-reports-worker',
    '* * * * *',
    $command$select private.invoke_zentraq_render_worker('reports');$command$
  );
end;
$$;
