alter table public.health_programs
  add column if not exists workflow_status text not null default 'active',
  add column if not exists target_audience text[] not null
    default array['student', 'faculty', 'staff']::text[],
  add column if not exists proposed_by uuid references public.users(id),
  add column if not exists approved_by uuid references public.users(id),
  add column if not exists approved_at timestamptz;

alter table public.health_programs
  drop constraint if exists health_programs_workflow_status_check;

alter table public.health_programs
  add constraint health_programs_workflow_status_check
  check (workflow_status in ('pending', 'active', 'rejected'));

alter table public.health_programs
  drop constraint if exists health_programs_target_audience_check;

alter table public.health_programs
  add constraint health_programs_target_audience_check
  check (
    cardinality(target_audience) > 0
    and target_audience <@ array['student', 'faculty', 'staff']::text[]
  );

alter table public.announcements
  add column if not exists target_audience text[] not null
    default array['student', 'faculty', 'staff']::text[];

create index if not exists idx_health_programs_pending_created
  on public.health_programs (created_at desc)
  where workflow_status = 'pending';

-- Atomically publishes a proposed program, its announcement, and notifications.
create or replace function public.approve_health_program(
  p_program_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_program public.health_programs%rowtype;
  v_announcement_id uuid;
begin
  select role.name
  into v_actor_role
  from public.user_roles user_role
  join public.roles role
    on role.id = user_role.role_id
  where user_role.user_id = v_actor_id
  limit 1;

  if v_actor_id is null or v_actor_role <> 'admin' then
    raise exception 'Admin access is required';
  end if;

  select *
  into v_program
  from public.health_programs
  where id = p_program_id
  for update;

  if v_program.id is null then
    raise exception 'Health program not found';
  end if;

  if v_program.workflow_status <> 'pending' then
    raise exception 'Only pending proposals may be published';
  end if;

  update public.health_programs
  set
    workflow_status = 'active',
    is_active = true,
    approved_by = v_actor_id,
    approved_at = now(),
    managed_by = v_actor_id,
    updated_at = now()
  where id = v_program.id;

  insert into public.announcements (
    title,
    content,
    posted_by,
    target_audience
  )
  values (
    v_program.name,
    coalesce(v_program.description, 'A new clinic health program is available.'),
    v_actor_id,
    v_program.target_audience
  )
  returning id into v_announcement_id;

  insert into public.notifications (
    sender_id,
    receiver_id,
    title,
    message,
    type,
    entity_type,
    entity_id
  )
  select distinct
    v_actor_id,
    audience.user_id,
    'New health program',
    v_program.name,
    'system',
    'health_program',
    v_program.id
  from (
    select student.user_id, 'student'::text as patient_role
    from public.students student
    where student.user_id is not null
    union all
    select faculty.user_id, 'faculty'::text
    from public.faculty faculty
    where faculty.user_id is not null
    union all
    select staff.user_id, 'staff'::text
    from public.staff staff
    where staff.user_id is not null
  ) audience
  where audience.patient_role = any(v_program.target_audience);

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'health_program.approved_and_published',
    'health_program',
    v_program.id,
    jsonb_build_object('announcement_id', v_announcement_id)
  );

  return v_announcement_id;
end;
$$;

revoke all on function public.approve_health_program(uuid) from public;
revoke all on function public.approve_health_program(uuid) from anon;
revoke all on function public.approve_health_program(uuid) from service_role;
grant execute on function public.approve_health_program(uuid) to authenticated;
