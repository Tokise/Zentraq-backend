-- Retires the metadata-only smoke-test worker without touching domain data.

drop function if exists public.get_service_job_status(uuid, uuid);
drop function if exists public.enqueue_service_job(text, uuid, text, uuid);
drop function if exists public.claim_service_jobs(integer, integer);
drop function if exists public.complete_service_job(uuid, bigint);
drop function if exists public.fail_service_job(uuid, bigint, text);

do $$
declare
  queue_exists boolean := false;
begin
  if exists (
    select 1
    from pg_catalog.pg_extension
    where extname = 'pgmq'
  ) then
    execute $query$
      select exists (
        select 1
        from pgmq.list_queues() as queue
        where queue.queue_name = 'zentraq_service_jobs'
      )
    $query$
    into queue_exists;

    if queue_exists then
      execute 'select pgmq.drop_queue($1)'
      using 'zentraq_service_jobs';
    end if;
  end if;
end;
$$;

drop table if exists private.service_job_transitions;
drop table if exists private.service_jobs;
