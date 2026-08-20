set statement_timeout = '30s';

-- Claims queued RFID consultations and preserves atomic ownership transitions.
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
  select role.name, clinic_account.id
  into v_actor_role, v_account_id
  from public.user_roles user_role
  join public.roles role
    on role.id = user_role.role_id
  join public.clinic_accounts clinic_account
    on clinic_account.user_id = user_role.user_id
   and clinic_account.role = role.name
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

  if v_consultation.id is null then
    raise exception 'This consultation is no longer available';
  end if;

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

  if v_visit.id is null
    or v_queue.id is null
    or v_queue.status not in ('waiting', 'claimed', 'awaiting_doctor_review')
    or v_consultation.status not in (
      'queued',
      'in-progress',
      'awaiting_doctor_review'
    ) then
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

-- Authorizes minimized application invalidations in addition to owned topics.
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
  v_actor_id uuid := (select auth.uid());
  v_patient_role text;
  v_profile_id uuid;
  v_profile_id_text text;
begin
  if v_actor_id is null then
    return false;
  end if;

  if requested_topic = 'app:changes' then
    return true;
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
      select 1 from public.students student
      where student.id = v_profile_id and student.user_id = v_actor_id
    )
    when 'faculty' then exists (
      select 1 from public.faculty faculty
      where faculty.id = v_profile_id and faculty.user_id = v_actor_id
    )
    when 'staff' then exists (
      select 1 from public.staff staff
      where staff.id = v_profile_id and staff.user_id = v_actor_id
    )
    else false
  end;
end;
$$;

revoke all on function private.can_receive_realtime_topic(text)
  from public, anon;
grant execute on function private.can_receive_realtime_topic(text)
  to authenticated;

-- Broadcasts only a domain name so clients can reload authorized DTOs.
create or replace function public.broadcast_domain_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
begin
  v_domain := case tg_table_name
    when 'announcements' then 'announcements'
    when 'appointments' then 'appointments'
    when 'clinic_queue_entries' then 'consultations'
    when 'consultations' then 'consultations'
    when 'students' then 'profiles'
    when 'faculty' then 'profiles'
    when 'staff' then 'profiles'
    when 'user_roles' then 'profiles'
    when 'clinic_accounts' then 'profiles'
    else 'system'
  end;

  perform realtime.send(
    jsonb_build_object('domain', v_domain),
    'domain-changed',
    'app:changes',
    true
  );
  return null;
end;
$$;

revoke all on function public.broadcast_domain_change()
  from public, anon, authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'announcements',
    'appointments',
    'clinic_accounts',
    'clinic_queue_entries',
    'consultations',
    'faculty',
    'staff',
    'students',
    'user_roles'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format(
        'drop trigger if exists broadcast_domain_change on public.%I',
        v_table
      );
      execute format(
        'create trigger broadcast_domain_change '
        || 'after insert or update or delete on public.%I '
        || 'for each statement execute function '
        || 'public.broadcast_domain_change()',
        v_table
      );
    end if;
  end loop;
end;
$$;

-- Creates generic owned notifications for consultation state transitions.
create or replace function public.notify_consultation_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_visit public.clinic_visits%rowtype;
begin
  if old.status is not distinct from new.status then
    return null;
  end if;

  select * into v_visit
  from public.clinic_visits
  where id = new.visit_id;

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

  if new.status = 'in-progress' and new.claimed_by_user_id is not null then
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
      new.claimed_by_user_id,
      new.claimed_by_user_id,
      'Consultation claimed',
      'The consultation is now assigned to you.',
      'consultation',
      'consultation',
      new.id
    );
  end if;

  if v_patient_user_id is not null and new.status = 'in-progress' then
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
      new.claimed_by_user_id,
      v_patient_user_id,
      'Consultation started',
      'A clinic clinician has started your consultation.',
      'consultation',
      'consultation',
      new.id
    );
  elsif v_patient_user_id is not null and new.status = 'completed' then
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
      new.completed_by_user_id,
      v_patient_user_id,
      'Consultation completed',
      'Your clinic consultation has been completed.',
      'consultation',
      'consultation',
      new.id
    );
  end if;

  return null;
end;
$$;

revoke all on function public.notify_consultation_transition()
  from public, anon, authenticated;

drop trigger if exists notify_consultation_transition
  on public.consultations;
create trigger notify_consultation_transition
after update of status
on public.consultations
for each row
execute function public.notify_consultation_transition();

-- Notifies the patient about terminal appointment decisions from any API path.
create or replace function public.notify_appointment_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text;
  v_patient_user_id uuid;
  v_title text;
begin
  if old.status is not distinct from new.status
    or new.status not in ('approved', 'rejected', 'cancelled') then
    return null;
  end if;

  select case new.patient_type
    when 'student' then student.user_id
    when 'faculty' then faculty.user_id
    when 'staff' then staff.user_id
  end
  into v_patient_user_id
  from (select 1) seed
  left join public.students student on student.id = new.student_id
  left join public.faculty faculty on faculty.id = new.faculty_id
  left join public.staff staff on staff.id = new.staff_id;

  if v_patient_user_id is null then
    return null;
  end if;

  v_title := case new.status
    when 'approved' then 'Appointment approved'
    when 'rejected' then 'Appointment declined'
    else 'Appointment cancelled'
  end;
  v_message := case new.status
    when 'approved' then 'Your appointment request has been approved.'
    when 'rejected' then 'Your appointment request was not approved.'
    else 'Your appointment has been cancelled.'
  end;

  insert into public.notifications (
    receiver_id,
    title,
    message,
    type,
    entity_type,
    entity_id
  )
  values (
    v_patient_user_id,
    v_title,
    v_message,
    'appointment',
    'appointment',
    new.id
  );

  return null;
end;
$$;

revoke all on function public.notify_appointment_transition()
  from public, anon, authenticated;

drop trigger if exists notify_appointment_transition
  on public.appointments;
create trigger notify_appointment_transition
after update of status
on public.appointments
for each row
execute function public.notify_appointment_transition();
