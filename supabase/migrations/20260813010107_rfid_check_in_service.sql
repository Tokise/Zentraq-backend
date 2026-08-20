set statement_timeout = '30s';

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regclass('public.students') is null
    or to_regclass('public.faculty') is null
    or to_regclass('public.staff') is null
    or to_regclass('public.clinic_visits') is null
    or to_regclass('public.consultations') is null
    or to_regclass('public.clinic_queue_entries') is null
    or to_regclass('public.audit_logs') is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'clinic_visits'
        and column_name = 'staff_id'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'audit_logs'
        and column_name = 'metadata'
    ) then
    raise exception 'RFID_SERVICE_READINESS_CHECK_FAILED';
  end if;
end;
$$;

alter table public.consultations
  drop constraint if exists consultations_status_check;

alter table public.consultations
  add constraint consultations_status_check check (
    status in ('queued', 'in-progress', 'awaiting_doctor_review', 'completed')
  );

create unique index if not exists clinic_visits_one_active_staff_idx
  on public.clinic_visits (staff_id)
  where staff_id is not null and status in ('waiting', 'in-progress');

create table if not exists private.rfid_check_in_events (
  event_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  uid_fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  constraint rfid_check_in_events_fingerprint_check check (
    uid_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint rfid_check_in_events_response_check check (
    response ?& array[
      'queueEntryId',
      'consultationId',
      'patientType',
      'patientId',
      'firstName',
      'lastName',
      'createdNew'
    ]
  )
);

alter table private.rfid_check_in_events enable row level security;
revoke all on table private.rfid_check_in_events
  from public, anon, authenticated, service_role;

create index if not exists rfid_check_in_events_created_idx
  on private.rfid_check_in_events (created_at);

-- Checks in one RFID patient atomically while preventing replay and duplicate visits.
create or replace function public.check_in_rfid_v1(
  requested_event_id uuid,
  requested_rfid_uid text
)
returns table (
  queue_entry_id uuid,
  consultation_id uuid,
  patient_type text,
  patient_id uuid,
  first_name text,
  last_name text,
  profile_photo_path text,
  created_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_account_id uuid;
  v_uid text := btrim(requested_rfid_uid);
  v_fingerprint text;
  v_profile_count integer;
  v_patient_type text;
  v_patient_id uuid;
  v_patient_user_id uuid;
  v_first_name text;
  v_last_name text;
  v_photo_path text;
  v_visit_id uuid;
  v_queue_id uuid;
  v_consultation_id uuid;
  v_existing jsonb;
  v_response jsonb;
  v_created_new boolean := false;
begin
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select role.name, account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  join public.clinic_accounts account
    on account.user_id = user_role.user_id
    and account.role = role.name
    and account.is_active = true
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'doctor', 'nurse')
  limit 1;

  if v_actor_role is null or v_account_id is null then
    raise exception 'CLINICAL_OPERATOR_REQUIRED';
  end if;

  if requested_event_id is null
    or v_uid is null
    or length(v_uid) not between 4 and 64
    or v_uid ~ '[[:cntrl:]]' then
    raise exception 'INVALID_RFID_REQUEST';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      convert_to(requested_event_id::text || ':' || v_uid, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_event_id::text, 0)
  );

  delete from private.rfid_check_in_events event
  where event.event_id in (
    select expired.event_id
    from private.rfid_check_in_events expired
    where expired.created_at < now() - interval '24 hours'
    order by expired.created_at
    limit 100
  );

  select event.response into v_existing
  from private.rfid_check_in_events event
  where event.event_id = requested_event_id
    and event.actor_id = v_actor_id
    and event.uid_fingerprint = v_fingerprint;

  if v_existing is not null then
    return query select
      (v_existing->>'queueEntryId')::uuid,
      (v_existing->>'consultationId')::uuid,
      v_existing->>'patientType',
      (v_existing->>'patientId')::uuid,
      v_existing->>'firstName',
      v_existing->>'lastName',
      nullif(v_existing->>'profilePhotoPath', ''),
      (v_existing->>'createdNew')::boolean;
    return;
  end if;

  if exists (
    select 1
    from private.rfid_check_in_events event
    where event.event_id = requested_event_id
  ) then
    raise exception 'RFID_EVENT_REPLAY_REJECTED';
  end if;

  with profiles as (
    select
      'student'::text as patient_type,
      student.id as patient_id,
      student.user_id,
      student.first_name,
      student.last_name,
      student.profile_photo_url
    from public.students student
    where student.rfid_uid = v_uid and student.status = 'active'
    union all
    select
      'faculty',
      faculty.id,
      faculty.user_id,
      faculty.first_name,
      faculty.last_name,
      faculty.profile_photo_url
    from public.faculty faculty
    where faculty.rfid_uid = v_uid and faculty.status = 'active'
    union all
    select
      'staff',
      staff.id,
      staff.user_id,
      staff.first_name,
      staff.last_name,
      staff.profile_photo_url
    from public.staff staff
    where staff.rfid_uid = v_uid and staff.status = 'active'
  )
  select
    count(*),
    (array_agg(profiles.patient_type))[1],
    (array_agg(profiles.patient_id))[1],
    (array_agg(profiles.user_id))[1],
    (array_agg(profiles.first_name))[1],
    (array_agg(profiles.last_name))[1],
    (array_agg(profiles.profile_photo_url))[1]
  into
    v_profile_count,
    v_patient_type,
    v_patient_id,
    v_patient_user_id,
    v_first_name,
    v_last_name,
    v_photo_path
  from profiles;

  if v_profile_count = 0 then
    raise exception 'RFID_NOT_REGISTERED';
  end if;
  if v_profile_count > 1 then
    raise exception 'RFID_PROFILE_CONFLICT';
  end if;
  if v_patient_user_id = v_actor_id then
    raise exception 'SELF_CHECK_IN_REJECTED';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_patient_type || ':' || v_patient_id::text,
      0
    )
  );

  select visit.id, queue.id, consultation.id
  into v_visit_id, v_queue_id, v_consultation_id
  from public.clinic_visits visit
  join public.clinic_queue_entries queue on queue.visit_id = visit.id
  join public.consultations consultation on consultation.visit_id = visit.id
  where (
    (v_patient_type = 'student' and visit.student_id = v_patient_id)
    or (v_patient_type = 'faculty' and visit.faculty_id = v_patient_id)
    or (v_patient_type = 'staff' and visit.staff_id = v_patient_id)
  )
    and visit.status in ('waiting', 'in-progress')
    and queue.status in ('waiting', 'claimed', 'awaiting_doctor_review')
  order by visit.check_in_time
  limit 1;

  if v_visit_id is null then
    v_created_new := true;
    insert into public.clinic_visits (
      patient_type,
      student_id,
      faculty_id,
      staff_id,
      visit_type,
      status,
      created_by
    )
    values (
      v_patient_type,
      case when v_patient_type = 'student' then v_patient_id end,
      case when v_patient_type = 'faculty' then v_patient_id end,
      case when v_patient_type = 'staff' then v_patient_id end,
      'rfid',
      'waiting',
      v_actor_id
    )
    returning id into v_visit_id;

    insert into public.consultations (visit_id, status)
    values (v_visit_id, 'queued')
    returning id into v_consultation_id;

    insert into public.clinic_queue_entries (visit_id, status)
    values (v_visit_id, 'waiting')
    returning id into v_queue_id;
  end if;

  v_response := jsonb_build_object(
    'queueEntryId', v_queue_id,
    'consultationId', v_consultation_id,
    'patientType', v_patient_type,
    'patientId', v_patient_id,
    'firstName', v_first_name,
    'lastName', v_last_name,
    'profilePhotoPath', coalesce(v_photo_path, ''),
    'createdNew', v_created_new
  );

  -- The response is inserted once; it contains no RFID credential.
  insert into private.rfid_check_in_events (
    event_id,
    actor_id,
    uid_fingerprint,
    response
  )
  values (requested_event_id, v_actor_id, v_fingerprint, v_response);

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'RFID_SCAN',
    'clinic_queue_entry',
    v_queue_id,
    jsonb_build_object(
      'event_id', requested_event_id,
      'patient_type', v_patient_type
    )
  );

  return query select
    v_queue_id,
    v_consultation_id,
    v_patient_type,
    v_patient_id,
    v_first_name,
    v_last_name,
    v_photo_path,
    (v_response->>'createdNew')::boolean;
end;
$$;

revoke all on function public.check_in_rfid_v1(uuid, text)
  from public, anon;
grant execute on function public.check_in_rfid_v1(uuid, text)
  to authenticated;

-- Direct table access is unnecessary because protected RPCs and Broadcast own the queue.
revoke all on table public.clinic_queue_entries from anon, authenticated;
