-- Returns minimized notification job status to its active Admin requester.
create or replace function public.get_notification_job_status(
  requested_job_id uuid,
  requested_by uuid
)
returns table (
  id uuid,
  status text,
  error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    job.id,
    job.status,
    job.error_code,
    job.created_at,
    job.updated_at
  from private.notification_jobs as job
  where job.id = requested_job_id
    and job.requested_by = requested_by
    and exists (
      select 1
      from public.user_roles as user_role
      join public.roles as role
        on role.id = user_role.role_id
      join public.clinic_accounts as account
        on account.user_id = user_role.user_id
        and account.role = role.name
        and account.is_active = true
      where user_role.user_id = requested_by
        and role.name = 'admin'
    );
$$;

revoke all on function public.get_notification_job_status(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_notification_job_status(uuid, uuid)
  to service_role;
