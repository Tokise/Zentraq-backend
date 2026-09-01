set statement_timeout = '30s';

create schema if not exists private;
grant usage on schema private to service_role;

-- Stores normalized portal identifiers without exposing Auth emails to clients.
create table if not exists public.portal_login_identities (
  login_id text primary key,
  user_id uuid not null unique
    references public.users(id) on delete cascade,
  profile_role text not null
    check (profile_role in ('student', 'faculty', 'staff')),
  profile_id uuid not null,
  login_role text not null
    check (
      login_role in (
        'admin',
        'doctor',
        'nurse',
        'student',
        'faculty',
        'staff'
      )
    ),
  temporary_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_login_identities_login_id_check
    check (login_id ~ '^[se][0-9]{9}$')
);

alter table public.portal_login_identities enable row level security;

revoke all on table public.portal_login_identities
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.portal_login_identities
  to service_role;

create unique index if not exists portal_login_identities_profile_idx
  on public.portal_login_identities (profile_role, profile_id);

create index if not exists portal_login_identities_active_user_idx
  on public.portal_login_identities (user_id)
  where is_active;

-- Reports profiles that cannot be safely mapped to an institutional login ID.
create or replace view private.portal_identity_backfill_issues
with (security_invoker = true)
as
with profiles as (
  select
    'student'::text as profile_role,
    student.id as profile_id,
    student.user_id,
    student.student_number as official_number
  from public.students student
  where student.user_id is not null
  union all
  select
    'faculty'::text,
    faculty.id,
    faculty.user_id,
    faculty.employee_number
  from public.faculty faculty
  where faculty.user_id is not null
  union all
  select
    'staff'::text,
    staff.id,
    staff.user_id,
    staff.employee_number
  from public.staff staff
  where staff.user_id is not null
), normalized as (
  select
    profile_role,
    profile_id,
    user_id,
    official_number,
    case
      when profile_role = 'student' then 's' || official_number
      else 'e' || official_number
    end as login_id
  from profiles
), counted as (
  select
    normalized.*,
    count(*) over (partition by login_id) as login_id_count,
    count(*) over (partition by user_id) as user_id_count
  from normalized
)
select
  profile_role,
  profile_id,
  user_id,
  official_number,
  login_id,
  case
    when official_number is null or btrim(official_number) = ''
      then 'missing_official_number'
    when official_number !~ '^[0-9]{9}$'
      then 'invalid_official_number'
    when login_id_count > 1
      then 'duplicate_login_id'
    when user_id_count > 1
      then 'user_linked_to_multiple_profiles'
    else null
  end as issue
from counted
where official_number is null
  or official_number !~ '^[0-9]{9}$'
  or login_id_count > 1
  or user_id_count > 1;

revoke all on table private.portal_identity_backfill_issues
  from public, anon, authenticated;
grant select on table private.portal_identity_backfill_issues
  to service_role;

-- Backfills only unambiguous existing profile-to-user mappings.
with profiles as (
  select
    'student'::text as profile_role,
    student.id as profile_id,
    student.user_id,
    student.student_number as official_number
  from public.students student
  where student.user_id is not null
  union all
  select
    'faculty'::text,
    faculty.id,
    faculty.user_id,
    faculty.employee_number
  from public.faculty faculty
  where faculty.user_id is not null
  union all
  select
    'staff'::text,
    staff.id,
    staff.user_id,
    staff.employee_number
  from public.staff staff
  where staff.user_id is not null
), candidates as (
  select
    profile_role,
    profile_id,
    user_id,
    case
      when profile_role = 'student' then 's' || official_number
      else 'e' || official_number
    end as login_id,
    count(*) over (
      partition by case
        when profile_role = 'student' then 's' || official_number
        else 'e' || official_number
      end
    ) as login_id_count,
    count(*) over (partition by user_id) as user_id_count
  from profiles
  where official_number ~ '^[0-9]{9}$'
), role_assignments as (
  select distinct on (user_role.user_id)
    user_role.user_id,
    role.name as login_role
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  where role.name in (
    'admin',
    'doctor',
    'nurse',
    'student',
    'faculty',
    'staff'
  )
  order by user_role.user_id, user_role.assigned_at desc
)
insert into public.portal_login_identities (
  login_id,
  user_id,
  profile_role,
  profile_id,
  login_role,
  temporary_password,
  is_active
)
select
  candidate.login_id,
  candidate.user_id,
  candidate.profile_role,
  candidate.profile_id,
  role_assignment.login_role,
  false,
  true
from candidates candidate
join role_assignments role_assignment
  on role_assignment.user_id = candidate.user_id
where candidate.login_id_count = 1
  and candidate.user_id_count = 1
on conflict do nothing;

alter table public.consultations
  drop constraint if exists consultations_status_check;

alter table public.consultations
  add constraint consultations_status_check check (
    status in (
      'queued',
      'claimed',
      'in-progress',
      'awaiting_doctor_review',
      'completed'
    )
  );

-- Claims eligible work without starting the clinical encounter.
create or replace function public.claim_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_account_id uuid;
  v_consultation public.consultations%rowtype;
  v_queue public.clinic_queue_entries%rowtype;
  v_visit public.clinic_visits%rowtype;
  v_patient_user_id uuid;
begin
  select role.name, account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  join public.clinic_accounts account
    on account.user_id = user_role.user_id
   and account.role = role.name
   and account.is_active
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'doctor', 'nurse')
  limit 1;

  if v_actor_id is null or v_account_id is null then
    raise exception 'Active clinical account is required';
  end if;

  select * into v_consultation
  from public.consultations
  where id = p_consultation_id
  for update;

  select * into v_visit
  from public.clinic_visits
  where id = v_consultation.visit_id
  for update;

  select * into v_queue
  from public.clinic_queue_entries
  where visit_id = v_visit.id
  for update;

  if v_consultation.status = 'in-progress'
    and v_queue.status = 'claimed'
    and v_consultation.claimed_by_user_id = v_actor_id
    and v_consultation.claimed_by_clinic_account_id = v_account_id
    and v_queue.claimed_by = v_actor_id then
    return v_queue.id;
  end if;

  if v_consultation.id is null
    or v_queue.id is null
    or v_queue.status not in (
      'waiting',
      'claimed',
      'awaiting_doctor_review'
    )
    or v_consultation.status not in (
      'queued',
      'claimed',
      'awaiting_doctor_review'
    ) then
    raise exception 'This consultation is no longer available';
  end if;

  if v_queue.status = 'claimed' then
    if v_queue.claimed_by = v_actor_id
      and v_consultation.claimed_by_user_id = v_actor_id then
      return v_queue.id;
    end if;
    raise exception 'This patient is already being handled';
  end if;

  if v_queue.status = 'awaiting_doctor_review' then
    if v_actor_role <> 'doctor' then
      raise exception 'Only an eligible Doctor may claim this review';
    end if;

    if v_consultation.review_doctor_id is not null
      and v_consultation.review_doctor_id <> v_account_id then
      raise exception 'This review is assigned to another Doctor';
    end if;

    if v_consultation.review_doctor_id is null
      and not private.is_review_doctor_available(v_account_id, now()) then
      raise exception 'Doctor must be on duty to claim an unassigned review';
    end if;
  end if;

  select case v_visit.patient_type
    when 'student' then student.user_id
    when 'faculty' then faculty.user_id
    when 'staff' then staff.user_id
  end
  into v_patient_user_id
  from (select 1) seed
  left join public.students student on student.id = v_visit.student_id
  left join public.faculty faculty on faculty.id = v_visit.faculty_id
  left join public.staff staff on staff.id = v_visit.staff_id;

  if v_patient_user_id = v_actor_id then
    raise exception 'Clinicians cannot claim their own consultation';
  end if;

  update public.clinic_queue_entries
  set
    status = 'claimed',
    claimed_by = v_actor_id,
    claimed_at = now(),
    updated_at = now()
  where id = v_queue.id;

  update public.consultations
  set
    status = 'claimed',
    review_doctor_id = case
      when v_queue.status = 'awaiting_doctor_review' then v_account_id
      else review_doctor_id
    end,
    doctor_id = case
      when v_actor_role in ('admin', 'doctor') then v_account_id
      else doctor_id
    end,
    nurse_id = case
      when v_actor_role = 'nurse' then v_account_id
      else nurse_id
    end,
    claimed_by_user_id = v_actor_id,
    claimed_by_clinic_account_id = v_account_id,
    claimed_at = now(),
    updated_at = now()
  where id = v_consultation.id;

  update public.clinic_visits
  set status = 'claimed', updated_at = now()
  where id = v_visit.id;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'consultation.claimed',
    'consultation',
    v_consultation.id,
    jsonb_build_object(
      'clinic_account_id', v_account_id,
      'clinician_role', v_actor_role,
      'patient_role', v_visit.patient_type,
      'previous_status', v_queue.status,
      'new_status', 'claimed'
    )
  );

  return v_queue.id;
end;
$$;

-- Starts only work already claimed by the current clinician.
create or replace function public.start_claimed_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_account_id uuid;
  v_consultation public.consultations%rowtype;
  v_queue public.clinic_queue_entries%rowtype;
  v_visit public.clinic_visits%rowtype;
begin
  select role.name, account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  join public.clinic_accounts account
    on account.user_id = user_role.user_id
   and account.role = role.name
   and account.is_active
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'doctor', 'nurse')
  limit 1;

  if v_actor_id is null or v_account_id is null then
    raise exception 'Active clinical account is required';
  end if;

  select * into v_consultation
  from public.consultations
  where id = p_consultation_id
  for update;

  select * into v_visit
  from public.clinic_visits
  where id = v_consultation.visit_id
  for update;

  select * into v_queue
  from public.clinic_queue_entries
  where visit_id = v_visit.id
  for update;

  if v_consultation.status = 'in-progress'
    and v_queue.status = 'claimed'
    and v_consultation.claimed_by_user_id = v_actor_id
    and v_consultation.claimed_by_clinic_account_id = v_account_id
    and v_queue.claimed_by = v_actor_id then
    return v_queue.id;
  end if;

  if v_consultation.id is null
    or v_queue.id is null
    or v_consultation.status <> 'claimed'
    or v_queue.status <> 'claimed'
    or v_consultation.claimed_by_user_id <> v_actor_id
    or v_consultation.claimed_by_clinic_account_id <> v_account_id
    or v_queue.claimed_by <> v_actor_id then
    raise exception 'Only the clinician who claimed this patient may start';
  end if;

  update public.consultations
  set status = 'in-progress', updated_at = now()
  where id = v_consultation.id;

  update public.clinic_visits
  set status = 'in-progress', updated_at = now()
  where id = v_visit.id;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'consultation.started',
    'consultation',
    v_consultation.id,
    jsonb_build_object(
      'clinic_account_id', v_account_id,
      'clinician_role', v_actor_role,
      'previous_status', 'claimed',
      'new_status', 'in-progress'
    )
  );

  return v_queue.id;
end;
$$;

-- Releases unstarted work back to its appropriate queue.
create or replace function public.release_claimed_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_account_id uuid;
  v_consultation public.consultations%rowtype;
  v_queue public.clinic_queue_entries%rowtype;
  v_visit public.clinic_visits%rowtype;
  v_return_status text;
begin
  select role.name, account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  join public.clinic_accounts account
    on account.user_id = user_role.user_id
   and account.role = role.name
   and account.is_active
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'doctor', 'nurse')
  limit 1;

  if v_actor_id is null or v_account_id is null then
    raise exception 'Active clinical account is required';
  end if;

  select * into v_consultation
  from public.consultations
  where id = p_consultation_id
  for update;

  select * into v_visit
  from public.clinic_visits
  where id = v_consultation.visit_id
  for update;

  select * into v_queue
  from public.clinic_queue_entries
  where visit_id = v_visit.id
  for update;

  if v_consultation.id is null
    or v_queue.id is null
    or v_consultation.status <> 'claimed'
    or v_queue.status <> 'claimed'
    or (
      v_actor_role <> 'admin'
      and v_consultation.claimed_by_user_id <> v_actor_id
    ) then
    raise exception 'Only the claimant or an Admin may release this patient';
  end if;

  v_return_status := case
    when v_consultation.review_requested_at is not null
      then 'awaiting_doctor_review'
    else 'queued'
  end;

  update public.clinic_queue_entries
  set
    status = case
      when v_return_status = 'awaiting_doctor_review'
        then 'awaiting_doctor_review'
      else 'waiting'
    end,
    claimed_by = null,
    claimed_at = null,
    updated_at = now()
  where id = v_queue.id;

  update public.consultations
  set
    status = v_return_status,
    doctor_id = case
      when doctor_id = v_consultation.claimed_by_clinic_account_id
        then null
      else doctor_id
    end,
    nurse_id = case
      when nurse_id = v_consultation.claimed_by_clinic_account_id
        then null
      else nurse_id
    end,
    claimed_by_user_id = null,
    claimed_by_clinic_account_id = null,
    claimed_at = null,
    updated_at = now()
  where id = v_consultation.id;

  update public.clinic_visits
  set status = 'waiting', updated_at = now()
  where id = v_visit.id;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'consultation.released',
    'consultation',
    v_consultation.id,
    jsonb_build_object(
      'clinic_account_id', v_account_id,
      'clinician_role', v_actor_role,
      'previous_status', 'claimed',
      'new_status', v_return_status
    )
  );

  return v_queue.id;
end;
$$;

revoke all on function public.claim_consultation(uuid)
  from public, anon, service_role;
revoke all on function public.start_claimed_consultation(uuid)
  from public, anon, service_role;
revoke all on function public.release_claimed_consultation(uuid)
  from public, anon, service_role;

grant execute on function public.claim_consultation(uuid)
  to authenticated;
grant execute on function public.start_claimed_consultation(uuid)
  to authenticated;
grant execute on function public.release_claimed_consultation(uuid)
  to authenticated;
