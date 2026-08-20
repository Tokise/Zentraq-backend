set statement_timeout = '30s';

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Invokes one allowlisted worker using secrets stored only in Supabase Vault.
create or replace function private.invoke_zentraq_worker(
  requested_worker text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_automations_secret text;
  v_request_id bigint;
begin
  if requested_worker not in ('notifications-worker', 'reports-worker') then
    raise exception 'WORKER_NOT_ALLOWED';
  end if;

  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'zentraq_project_url'
  limit 1;

  select decrypted_secret into v_automations_secret
  from vault.decrypted_secrets
  where name = 'zentraq_automations_secret'
  limit 1;

  if v_project_url is null
    or v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
    or v_automations_secret is null then
    raise exception 'WORKER_VAULT_SECRETS_MISSING';
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/' || requested_worker,
    headers := jsonb_build_object(
      'apikey', v_automations_secret,
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('batchSize', 10),
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_zentraq_worker(text)
  from public, anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'zentraq_project_url'
  ) or not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'zentraq_automations_secret'
  ) then
    raise exception 'WORKER_VAULT_SECRETS_MISSING';
  end if;

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
    $command$select private.invoke_zentraq_worker('notifications-worker');$command$
  );

  perform cron.schedule(
    'zentraq-reports-worker',
    '* * * * *',
    $command$select private.invoke_zentraq_worker('reports-worker');$command$
  );
end;
$$;
