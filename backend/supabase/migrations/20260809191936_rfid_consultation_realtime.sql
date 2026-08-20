-- Repairs clinician identity mapping and makes consultation transitions auditable.

create schema if not exists private;

revoke usage on schema private from public, anon;
grant usage on schema private to authenticated;

-- Backfills only missing clinic accounts without changing existing test accounts.
insert into public.clinic_accounts (
  user_id,
  role,
  display_name,
  is_active
)
select
  user_role.user_id,
  role.name,
  coalesce(
    nullif(btrim(concat_ws(' ', staff.first_name, staff.last_name)), ''),
    nullif(split_part(app_user.email, '@', 1), ''),
    'Clinic Staff'
  ),
  true
from public.user_roles user_role
join public.roles role
  on role.id = user_role.role_id
join public.users app_user
  on app_user.id = user_role.user_id
left join public.staff staff
  on staff.user_id = user_role.user_id
left join public.clinic_accounts clinic_account
  on clinic_account.user_id = user_role.user_id
where role.name in ('admin', 'doctor', 'nurse')
  and clinic_account.id is null;

alter table public.clinic_queue_entries
  drop constraint if exists clinic_queue_entries_status_check;

alter table public.clinic_queue_entries
  add constraint clinic_queue_entries_status_check check (
    status in (
      'waiting',
      'claimed',
      'awaiting_doctor_review',
      'completed',
      'cancelled'
    )
  );

alter table public.consultations
  add column if not exists claimed_by_user_id uuid
    references public.users(id) on delete set null,
  add column if not exists claimed_by_clinic_account_id uuid
    references public.clinic_accounts(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_by_user_id uuid
    references public.users(id) on delete set null,
  add column if not exists completed_by_clinic_account_id uuid
    references public.clinic_accounts(id) on delete set null;

create index if not exists clinic_accounts_active_user_idx
  on public.clinic_accounts (user_id)
  where is_active = true;

create index if not exists clinic_queue_entries_claimed_work_idx
  on public.clinic_queue_entries (claimed_by, updated_at desc)
  where status = 'claimed';

create index if not exists clinic_queue_entries_doctor_review_idx
  on public.clinic_queue_entries (priority desc, created_at asc)
  where status = 'awaiting_doctor_review';

create index if not exists consultations_claimed_actor_idx
  on public.consultations (claimed_by_user_id, status, updated_at desc)
  where status in ('in-progress', 'awaiting_doctor_review');

create unique index if not exists triage_assessments_consultation_unique_idx
  on public.triage_assessments (consultation_id);

-- Returns whether the caller has a clinical portal role.
create or replace function private.has_clinic_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_roles user_role
      join public.roles role
        on role.id = user_role.role_id
      where user_role.user_id = (select auth.uid())
        and role.name in ('admin', 'doctor', 'nurse')
    );
$$;

-- Authorizes one private clinical Realtime topic for the current user.
create or replace function private.can_receive_realtime_topic(
  requested_topic text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_patient_role text;
  v_profile_id uuid;
  v_profile_id_text text;
begin
  if v_actor_id is null then
    return false;
  end if;

  if requested_topic = 'clinic:rfid-queue' then
    return private.has_clinic_role();
  end if;

  if requested_topic like 'notifications:%' then
    v_profile_id_text := split_part(requested_topic, ':', 2);
    return v_profile_id_text ~* '^[0-9a-f-]{36}$'
      and v_profile_id_text::uuid = v_actor_id;
  end if;

  if requested_topic not like 'patient-record:%' then
    return false;
  end if;

  v_patient_role := split_part(requested_topic, ':', 2);
  v_profile_id_text := split_part(requested_topic, ':', 3);

  if v_patient_role not in ('student', 'faculty', 'staff')
    or v_profile_id_text !~* '^[0-9a-f-]{36}$' then
    return false;
  end if;

  v_profile_id := v_profile_id_text::uuid;

  if private.has_clinic_role() then
    return true;
  end if;

  return case v_patient_role
    when 'student' then exists (
      select 1
      from public.students student
      where student.id = v_profile_id
        and student.user_id = v_actor_id
    )
    when 'faculty' then exists (
      select 1
      from public.faculty faculty
      where faculty.id = v_profile_id
        and faculty.user_id = v_actor_id
    )
    when 'staff' then exists (
      select 1
      from public.staff staff
      where staff.id = v_profile_id
        and staff.user_id = v_actor_id
    )
    else false
  end;
end;
$$;

revoke all on function private.has_clinic_role() from public, anon;
revoke all on function private.can_receive_realtime_topic(text)
  from public, anon;

grant execute on function private.has_clinic_role() to authenticated;
grant execute on function private.can_receive_realtime_topic(text)
  to authenticated;

drop policy if exists "Zentraq private broadcast receive"
  on realtime.messages;

create policy "Zentraq private broadcast receive"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_receive_realtime_topic(
      (select realtime.topic())
    )
  );

-- Sends a minimal queue invalidation after a queue row changes.
create or replace function public.broadcast_rfid_queue_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('changed', true),
    'queue-changed',
    'clinic:rfid-queue',
    true
  );
  return null;
end;
$$;

revoke all on function public.broadcast_rfid_queue_change()
  from public, anon, authenticated;

drop trigger if exists broadcast_rfid_queue_change
  on public.clinic_queue_entries;

create trigger broadcast_rfid_queue_change
after insert or update or delete
on public.clinic_queue_entries
for each statement
execute function public.broadcast_rfid_queue_change();

-- Sends a private user notification invalidation without notification content.
create or replace function public.broadcast_notification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_receiver_id uuid := (v_row->>'receiver_id')::uuid;
begin
  perform realtime.send(
    jsonb_build_object('changed', true),
    'notification-changed',
    'notifications:' || v_receiver_id::text,
    true
  );
  return null;
end;
$$;

revoke all on function public.broadcast_notification_change()
  from public, anon, authenticated;

drop trigger if exists broadcast_notification_change
  on public.notifications;

create trigger broadcast_notification_change
after insert or update or delete
on public.notifications
for each row
execute function public.broadcast_notification_change();

-- Resolves and broadcasts the patient topic affected by a clinical row change.
create or replace function public.broadcast_patient_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_patient_role text;
  v_patient_id uuid;
  v_consultation_id uuid;
  v_visit_id uuid;
begin
  if tg_table_name like 'student_%' then
    v_patient_role := 'student';
    v_patient_id := nullif(v_row->>'student_id', '')::uuid;
  elsif tg_table_name like 'faculty_%' then
    v_patient_role := 'faculty';
    v_patient_id := nullif(v_row->>'faculty_id', '')::uuid;
  elsif tg_table_name like 'staff_%' then
    v_patient_role := 'staff';
    v_patient_id := nullif(v_row->>'staff_id', '')::uuid;
  elsif tg_table_name in ('medical_exam_results', 'sick_leave_entries') then
    v_patient_role := v_row->>'patient_role';
    v_patient_id := coalesce(
      nullif(v_row->>'student_id', '')::uuid,
      nullif(v_row->>'faculty_id', '')::uuid,
      nullif(v_row->>'staff_id', '')::uuid
    );
  elsif tg_table_name = 'consultations' then
    v_visit_id := nullif(v_row->>'visit_id', '')::uuid;
  else
    v_consultation_id := nullif(v_row->>'consultation_id', '')::uuid;
  end if;

  if v_consultation_id is not null then
    select consultation.visit_id
    into v_visit_id
    from public.consultations consultation
    where consultation.id = v_consultation_id;
  end if;

  if v_visit_id is not null then
    select
      visit.patient_type,
      case visit.patient_type
        when 'student' then visit.student_id
        when 'faculty' then visit.faculty_id
        when 'staff' then visit.staff_id
      end
    into v_patient_role, v_patient_id
    from public.clinic_visits visit
    where visit.id = v_visit_id;
  end if;

  if v_patient_role is not null and v_patient_id is not null then
    perform realtime.send(
      jsonb_build_object('changed', true),
      'patient-record-changed',
      'patient-record:' || v_patient_role || ':' || v_patient_id::text,
      true
    );
  end if;

  return null;
end;
$$;

revoke all on function public.broadcast_patient_record_change()
  from public, anon, authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'consultations',
    'triage_assessments',
    'diagnoses',
    'treatments',
    'prescriptions',
    'follow_ups',
    'student_medical_history',
    'student_allergies',
    'student_medications',
    'student_immunizations',
    'faculty_medical_history',
    'faculty_allergies',
    'faculty_medications',
    'faculty_immunizations',
    'staff_medical_history',
    'staff_allergies',
    'staff_medications',
    'staff_immunizations',
    'student_documents',
    'faculty_documents',
    'staff_documents',
    'medical_exam_results',
    'sick_leave_entries'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format(
        'drop trigger if exists broadcast_patient_record_change on public.%I',
        v_table
      );
      execute format(
        'create trigger broadcast_patient_record_change '
        || 'after insert or update or delete on public.%I '
        || 'for each row execute function '
        || 'public.broadcast_patient_record_change()',
        v_table
      );
    end if;
  end loop;
end;
$$;

-- Atomically claims a consultation and records the responsible clinic account.
create or replace function public.claim_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_account_id uuid;
  v_consultation public.consultations%rowtype;
  v_queue public.clinic_queue_entries%rowtype;
  v_visit public.clinic_visits%rowtype;
  v_patient_user_id uuid;
begin
  select role.name, clinic_account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role
    on role.id = user_role.role_id
  join public.clinic_accounts clinic_account
    on clinic_account.user_id = user_role.user_id
   and clinic_account.is_active = true
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'doctor', 'nurse')
  limit 1;

  if v_actor_id is null or v_account_id is null then
    raise exception 'Active clinical account is required';
  end if;

  select *
  into v_consultation
  from public.consultations
  where id = p_consultation_id
  for update;

  select *
  into v_visit
  from public.clinic_visits
  where id = v_consultation.visit_id
  for update;

  select *
  into v_queue
  from public.clinic_queue_entries
  where visit_id = v_visit.id
  for update;

  if v_consultation.id is null
    or v_queue.status not in ('waiting', 'claimed', 'awaiting_doctor_review')
    or v_consultation.status not in ('in-progress', 'awaiting_doctor_review') then
    raise exception 'This consultation is no longer available';
  end if;

  if v_queue.status = 'claimed' then
    if v_queue.claimed_by = v_actor_id then
      return v_queue.id;
    end if;
    raise exception 'This patient is already being handled';
  end if;

  if v_queue.status = 'awaiting_doctor_review'
    and v_actor_role not in ('admin', 'doctor') then
    raise exception 'Only a doctor may claim this review';
  end if;

  select case v_visit.patient_type
    when 'student' then student.user_id
    when 'faculty' then faculty.user_id
    when 'staff' then staff.user_id
  end
  into v_patient_user_id
  from (select 1) seed
  left join public.students student
    on student.id = v_visit.student_id
  left join public.faculty faculty
    on faculty.id = v_visit.faculty_id
  left join public.staff staff
    on staff.id = v_visit.staff_id;

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
    status = 'in-progress',
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
    case
      when v_queue.status = 'awaiting_doctor_review'
        then 'consultation.claimed_for_review'
      else 'consultation.claimed'
    end,
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

revoke all on function public.claim_consultation(uuid)
  from public, anon, service_role;
grant execute on function public.claim_consultation(uuid)
  to authenticated;

drop function if exists public.finalize_consultation_workflow(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb
);

-- Persists a Nurse handoff or final Doctor/Admin review in one transaction.
create or replace function public.finalize_consultation_workflow(
  p_consultation_id uuid,
  p_vitals_disposition text,
  p_vitals_skip_reason text,
  p_vitals jsonb,
  p_notes text,
  p_diagnosis jsonb,
  p_treatment jsonb,
  p_prescriptions jsonb,
  p_follow_up jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_account_id uuid;
  v_consultation public.consultations%rowtype;
  v_queue public.clinic_queue_entries%rowtype;
  v_visit public.clinic_visits%rowtype;
  v_vitals jsonb := coalesce(p_vitals, '{}'::jsonb);
  v_prescription jsonb;
  v_is_final_reviewer boolean;
  v_event text;
  v_new_status text;
begin
  select role.name, clinic_account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role
    on role.id = user_role.role_id
  join public.clinic_accounts clinic_account
    on clinic_account.user_id = user_role.user_id
   and clinic_account.is_active = true
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'doctor', 'nurse')
  limit 1;

  if v_actor_id is null or v_account_id is null then
    raise exception 'Active clinical account is required';
  end if;

  select *
  into v_consultation
  from public.consultations
  where id = p_consultation_id
  for update;

  select *
  into v_visit
  from public.clinic_visits
  where id = v_consultation.visit_id
  for update;

  select *
  into v_queue
  from public.clinic_queue_entries
  where visit_id = v_visit.id
  for update;

  if v_consultation.id is null
    or v_consultation.status <> 'in-progress'
    or v_queue.status <> 'claimed'
    or v_queue.claimed_by <> v_actor_id then
    raise exception 'This consultation is not claimed by the current clinician';
  end if;

  if p_vitals_disposition not in ('required', 'not_required') then
    raise exception 'Choose whether vital signs are required';
  end if;

  if p_vitals_disposition = 'required' and v_vitals = '{}'::jsonb then
    raise exception 'Record at least one vital sign';
  end if;

  if p_vitals_disposition = 'not_required'
    and nullif(btrim(p_vitals_skip_reason), '') is null then
    raise exception 'A reason is required when vital signs are not needed';
  end if;

  if nullif(btrim(p_notes), '') is null then
    raise exception 'A consultation outcome note is required';
  end if;

  v_is_final_reviewer := v_actor_role in ('admin', 'doctor');

  if not v_is_final_reviewer and (
    p_diagnosis is not null
    or p_treatment is not null
    or jsonb_array_length(coalesce(p_prescriptions, '[]'::jsonb)) > 0
    or p_follow_up is not null
  ) then
    raise exception 'Only a doctor may add the clinical plan';
  end if;

  if p_vitals_disposition = 'required' then
    insert into public.triage_assessments (
      consultation_id,
      nurse_id,
      temperature,
      blood_pressure,
      heart_rate,
      respiratory_rate,
      oxygen_saturation
    )
    values (
      v_consultation.id,
      v_account_id,
      nullif(v_vitals->>'temperature', '')::numeric,
      nullif(v_vitals->>'blood_pressure', ''),
      nullif(v_vitals->>'heart_rate', '')::integer,
      nullif(v_vitals->>'respiratory_rate', '')::integer,
      nullif(v_vitals->>'oxygen_saturation', '')::integer
    )
    on conflict (consultation_id) do update
    set
      nurse_id = excluded.nurse_id,
      temperature = excluded.temperature,
      blood_pressure = excluded.blood_pressure,
      heart_rate = excluded.heart_rate,
      respiratory_rate = excluded.respiratory_rate,
      oxygen_saturation = excluded.oxygen_saturation;
  end if;

  update public.consultations
  set
    consultation_notes = btrim(p_notes),
    vitals_disposition = case
      when p_vitals_disposition = 'required' then 'recorded'
      else 'not_required'
    end,
    vitals_skip_reason = case
      when p_vitals_disposition = 'not_required'
        then btrim(p_vitals_skip_reason)
      else null
    end,
    vitals_assessed_by = v_actor_id,
    vitals_assessed_at = now(),
    doctor_id = case
      when v_is_final_reviewer then v_account_id
      else doctor_id
    end,
    nurse_id = case
      when v_actor_role = 'nurse' then v_account_id
      else nurse_id
    end,
    status = case
      when v_is_final_reviewer then 'completed'
      else 'awaiting_doctor_review'
    end,
    completed_by_user_id = case
      when v_is_final_reviewer then v_actor_id
      else null
    end,
    completed_by_clinic_account_id = case
      when v_is_final_reviewer then v_account_id
      else null
    end,
    completed_at = case
      when v_is_final_reviewer then now()
      else null
    end,
    updated_at = now()
  where id = v_consultation.id;

  if v_is_final_reviewer then
    if p_diagnosis is not null
      and nullif(btrim(p_diagnosis->>'description'), '') is not null then
      insert into public.diagnoses (
        consultation_id,
        icd10_code,
        description,
        is_primary,
        created_by
      )
      values (
        v_consultation.id,
        nullif(btrim(p_diagnosis->>'icd10_code'), ''),
        btrim(p_diagnosis->>'description'),
        coalesce((p_diagnosis->>'is_primary')::boolean, true),
        v_actor_id
      );
    end if;

    if p_treatment is not null and (
      nullif(btrim(p_treatment->>'treatment_plan'), '') is not null
      or nullif(btrim(p_treatment->>'instructions'), '') is not null
    ) then
      insert into public.treatments (
        consultation_id,
        treatment_plan,
        instructions,
        follow_up_days,
        created_by
      )
      values (
        v_consultation.id,
        nullif(btrim(p_treatment->>'treatment_plan'), ''),
        nullif(btrim(p_treatment->>'instructions'), ''),
        nullif(p_treatment->>'follow_up_days', '')::integer,
        v_actor_id
      );
    end if;

    for v_prescription in
      select value
      from jsonb_array_elements(
        coalesce(p_prescriptions, '[]'::jsonb)
      )
    loop
      insert into public.prescriptions (
        consultation_id,
        medicine_id,
        dosage,
        frequency,
        duration_days,
        quantity,
        instructions,
        prescribed_by,
        status
      )
      values (
        v_consultation.id,
        (v_prescription->>'medicine_id')::uuid,
        nullif(btrim(v_prescription->>'dosage'), ''),
        nullif(btrim(v_prescription->>'frequency'), ''),
        nullif(v_prescription->>'duration_days', '')::integer,
        nullif(v_prescription->>'quantity', '')::integer,
        nullif(btrim(v_prescription->>'instructions'), ''),
        v_actor_id,
        'pending'
      );
    end loop;

    if p_follow_up is not null
      and nullif(btrim(p_follow_up->>'scheduled_date'), '') is not null then
      insert into public.follow_ups (
        consultation_id,
        scheduled_date,
        reason
      )
      values (
        v_consultation.id,
        (p_follow_up->>'scheduled_date')::date,
        nullif(btrim(p_follow_up->>'reason'), '')
      );
    end if;

    update public.clinic_queue_entries
    set
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    where id = v_queue.id;

    update public.clinic_visits
    set
      status = 'completed',
      check_out_time = now(),
      updated_at = now()
    where id = v_visit.id;

    v_event := 'consultation.completed';
    v_new_status := 'completed';
  else
    update public.clinic_queue_entries
    set
      status = 'awaiting_doctor_review',
      claimed_by = null,
      claimed_at = null,
      updated_at = now()
    where id = v_queue.id;

    v_event := 'consultation.submitted_for_review';
    v_new_status := 'awaiting_doctor_review';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    v_event,
    'consultation',
    v_consultation.id,
    jsonb_build_object(
      'clinic_account_id', v_account_id,
      'clinician_role', v_actor_role,
      'patient_role', v_visit.patient_type,
      'previous_status', 'in-progress',
      'new_status', v_new_status
    )
  );

  return v_new_status;
end;
$$;

revoke all on function public.finalize_consultation_workflow(
  uuid,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, service_role;

grant execute on function public.finalize_consultation_workflow(
  uuid,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to authenticated;
