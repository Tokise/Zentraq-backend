-- Adds assignment-safe Nurse handoffs, Doctor duty state, and review notifications.

set lock_timeout = '5s';
set statement_timeout = '30s';

create schema if not exists private;

create table if not exists public.clinician_duty_status (
  clinic_account_id uuid primary key
    references public.clinic_accounts(id) on delete cascade,
  is_on_duty boolean not null default false,
  expires_at timestamptz,
  updated_by uuid not null
    references public.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint clinician_duty_status_expiry_check check (
    (not is_on_duty) or expires_at is not null
  )
);

alter table public.clinician_duty_status enable row level security;
revoke all on table public.clinician_duty_status
  from public, anon, authenticated;
grant all on table public.clinician_duty_status to service_role;

alter table public.consultations
  add column if not exists review_doctor_id uuid
    references public.clinic_accounts(id) on delete set null,
  add column if not exists review_requested_by uuid
    references public.users(id) on delete set null,
  add column if not exists review_requested_at timestamptz,
  add column if not exists nurse_handoff_note text,
  add column if not exists nurse_handoff_at timestamptz,
  add column if not exists doctor_review_note text,
  add column if not exists doctor_reviewed_at timestamptz;

create index if not exists consultations_review_assignment_idx
  on public.consultations (
    review_doctor_id,
    status,
    review_requested_at
  )
  where nurse_handoff_at is not null;

update public.consultations
set
  nurse_handoff_note = consultation_notes,
  nurse_handoff_at = coalesce(updated_at, created_at)
where status = 'awaiting_doctor_review'
  and nurse_id is not null
  and nurse_handoff_note is null;

alter table private.notification_jobs
  drop constraint if exists notification_jobs_template_check;
alter table private.notification_jobs
  add constraint notification_jobs_template_check check (
    template_key in (
      'appointment.updated',
      'clearance.updated',
      'inventory.attention',
      'consultation.review_requested',
      'system.notice'
    )
  );

alter table private.notification_jobs
  drop constraint if exists notification_jobs_entity_type_check;
alter table private.notification_jobs
  add constraint notification_jobs_entity_type_check check (
    entity_type is null
    or entity_type in (
      'appointment',
      'clearance',
      'inventory',
      'consultation',
      'system'
    )
  );

-- Checks whether one active Doctor is selectable at a specific instant.
create or replace function private.is_review_doctor_available(
  requested_account_id uuid,
  requested_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_accounts account
    join public.user_roles user_role
      on user_role.user_id = account.user_id
    join public.roles role
      on role.id = user_role.role_id
    join public.clinician_duty_status duty
      on duty.clinic_account_id = account.id
     and duty.is_on_duty
     and duty.expires_at > requested_at
    join public.staff_availability availability
      on availability.clinic_account_id = account.id
     and availability.is_active
     and availability.day_of_week = extract(
       dow from timezone('Asia/Manila', requested_at)
     )::integer
     and timezone('Asia/Manila', requested_at)::time >= availability.start_time
     and timezone('Asia/Manila', requested_at)::time < availability.end_time
    where account.id = requested_account_id
      and account.role = 'doctor'
      and account.is_active
      and role.name = 'doctor'
      and not exists (
        select 1
        from public.clinician_schedule_blocks block
        where block.clinic_account_id = account.id
          and block.blocked_date = timezone(
            'Asia/Manila',
            requested_at
          )::date
          and timezone('Asia/Manila', requested_at)::time >= block.start_time
          and timezone('Asia/Manila', requested_at)::time < block.end_time
      )
  );
$$;

revoke all on function private.is_review_doctor_available(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- Queues one generic review notification without patient or RFID data.
create or replace function private.enqueue_review_notification(
  requested_by uuid,
  requested_receiver_id uuid,
  requested_consultation_id uuid,
  requested_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  insert into private.notification_jobs (
    requested_by,
    receiver_id,
    template_key,
    entity_type,
    entity_id,
    idempotency_key,
    correlation_id
  )
  values (
    requested_by,
    requested_receiver_id,
    'consultation.review_requested',
    'consultation',
    requested_consultation_id,
    requested_idempotency_key,
    gen_random_uuid()
  )
  on conflict (receiver_id, idempotency_key)
  do update set updated_at = excluded.updated_at
  returning id into v_job_id;

  if not exists (
    select 1
    from pgmq.q_zentraq_notification_jobs message
    where message.message->>'jobId' = v_job_id::text
  ) and exists (
    select 1
    from private.notification_jobs job
    where job.id = v_job_id
      and job.status = 'queued'
  ) then
    perform pgmq.send(
      'zentraq_notification_jobs',
      jsonb_build_object(
        'version', 1,
        'jobId', v_job_id,
        'jobType', 'notification.deliver'
      )
    );
  end if;
end;
$$;

revoke all on function private.enqueue_review_notification(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

-- Returns minimized currently selectable Doctors for a Nurse handoff.
create or replace function public.get_available_review_doctors()
returns table (
  clinic_account_id uuid,
  display_name text,
  available_until timestamptz,
  active_review_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_local_now timestamp := timezone('Asia/Manila', now());
begin
  if not exists (
    select 1
    from public.user_roles user_role
    join public.roles role on role.id = user_role.role_id
    join public.clinic_accounts account
      on account.user_id = user_role.user_id
     and account.role = role.name
     and account.is_active
    where user_role.user_id = v_actor_id
      and role.name in ('admin', 'nurse')
  ) then
    raise exception 'Active Nurse or Admin account is required';
  end if;

  return query
  select
    account.id,
    account.display_name,
    least(
      duty.expires_at,
      (
        v_local_now::date + availability.end_time
      ) at time zone 'Asia/Manila'
    ),
    count(consultation.id) filter (
      where consultation.status in ('in-progress', 'awaiting_doctor_review')
    )
  from public.clinic_accounts account
  join public.user_roles user_role on user_role.user_id = account.user_id
  join public.roles role on role.id = user_role.role_id
  join public.clinician_duty_status duty
    on duty.clinic_account_id = account.id
  join public.staff_availability availability
    on availability.clinic_account_id = account.id
  left join public.consultations consultation
    on consultation.review_doctor_id = account.id
   and consultation.nurse_handoff_at is not null
  where account.role = 'doctor'
    and account.is_active
    and role.name = 'doctor'
    and duty.is_on_duty
    and duty.expires_at > now()
    and availability.is_active
    and availability.day_of_week = extract(dow from v_local_now)::integer
    and v_local_now::time >= availability.start_time
    and v_local_now::time < availability.end_time
    and not exists (
      select 1
      from public.clinician_schedule_blocks block
      where block.clinic_account_id = account.id
        and block.blocked_date = v_local_now::date
        and v_local_now::time >= block.start_time
        and v_local_now::time < block.end_time
    )
  group by
    account.id,
    account.display_name,
    duty.expires_at,
    availability.end_time
  order by active_review_count, account.display_name
  limit 50;
end;
$$;

-- Returns the current Doctor duty state without exposing schedule details.
create or replace function public.get_my_clinician_duty_status()
returns table (
  is_on_duty boolean,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account_id uuid;
begin
  select account.id
  into v_account_id
  from public.clinic_accounts account
  join public.user_roles user_role on user_role.user_id = account.user_id
  join public.roles role on role.id = user_role.role_id
  where account.user_id = v_actor_id
    and account.role = 'doctor'
    and account.is_active
    and role.name = 'doctor'
  limit 1;

  if v_account_id is null then
    raise exception 'Active Doctor account is required';
  end if;

  return query
  select
    coalesce(duty.is_on_duty and duty.expires_at > now(), false),
    case when duty.expires_at > now() then duty.expires_at else null end
  from (select 1) seed
  left join public.clinician_duty_status duty
    on duty.clinic_account_id = v_account_id;
end;
$$;

-- Changes Doctor duty state and notifies them about unassigned review work.
create or replace function public.set_my_clinician_duty_status(
  requested_on_duty boolean
)
returns table (
  is_on_duty boolean,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account_id uuid;
  v_expires_at timestamptz;
  v_local_now timestamp := timezone('Asia/Manila', now());
  v_consultation record;
begin
  select account.id
  into v_account_id
  from public.clinic_accounts account
  join public.user_roles user_role on user_role.user_id = account.user_id
  join public.roles role on role.id = user_role.role_id
  where account.user_id = v_actor_id
    and account.role = 'doctor'
    and account.is_active
    and role.name = 'doctor'
  limit 1;

  if v_account_id is null then
    raise exception 'Active Doctor account is required';
  end if;

  if requested_on_duty then
    select least(
      (
        v_local_now::date + availability.end_time
      ) at time zone 'Asia/Manila',
      now() + interval '12 hours'
    )
    into v_expires_at
    from public.staff_availability availability
    where availability.clinic_account_id = v_account_id
      and availability.is_active
      and availability.day_of_week = extract(dow from v_local_now)::integer
      and v_local_now::time >= availability.start_time
      and v_local_now::time < availability.end_time
    order by availability.end_time
    limit 1;

    if v_expires_at is null or exists (
      select 1
      from public.clinician_schedule_blocks block
      where block.clinic_account_id = v_account_id
        and block.blocked_date = v_local_now::date
        and v_local_now::time >= block.start_time
        and v_local_now::time < block.end_time
    ) then
      raise exception 'Doctor is outside an available schedule window';
    end if;
  end if;

  insert into public.clinician_duty_status (
    clinic_account_id,
    is_on_duty,
    expires_at,
    updated_by,
    updated_at
  )
  values (
    v_account_id,
    requested_on_duty,
    case when requested_on_duty then v_expires_at else now() end,
    v_actor_id,
    now()
  )
  on conflict (clinic_account_id) do update
  set
    is_on_duty = excluded.is_on_duty,
    expires_at = excluded.expires_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'clinician.duty_status_changed',
    'clinic_account',
    v_account_id,
    jsonb_build_object(
      'is_on_duty', requested_on_duty,
      'expires_at', case when requested_on_duty then v_expires_at end
    )
  );

  if requested_on_duty then
    for v_consultation in
      select
        consultation.id,
        consultation.review_requested_by
      from public.consultations consultation
      where consultation.status = 'awaiting_doctor_review'
        and consultation.review_doctor_id is null
        and consultation.nurse_handoff_at is not null
      order by consultation.review_requested_at
      limit 20
    loop
      perform private.enqueue_review_notification(
        coalesce(v_consultation.review_requested_by, v_actor_id),
        v_actor_id,
        v_consultation.id,
        'consultation.review_available:'
          || v_consultation.id::text
          || ':'
          || v_actor_id::text
      );
    end loop;
  end if;

  return query select requested_on_duty, v_expires_at;
end;
$$;

drop function if exists public.claim_consultation(uuid);

-- Claims regular work or an assignment-safe Nurse handoff atomically.
create function public.claim_consultation(
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

  if v_queue.status = 'awaiting_doctor_review' then
    if v_actor_role <> 'doctor' then
      raise exception 'Only the assigned Doctor may claim this review';
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
    status = 'in-progress',
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

drop function if exists public.finalize_consultation_workflow(
  uuid, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb
);
drop function if exists public.finalize_consultation_workflow(
  uuid, text, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb
);

-- Persists a Nurse handoff, Doctor review, or direct clinical completion.
create function public.finalize_consultation_workflow(
  p_consultation_id uuid,
  p_patient_complaint text,
  p_review_doctor_id uuid,
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
  v_is_handoff_review boolean;
  v_is_final_reviewer boolean;
  v_reviewer_user_id uuid;
  v_patient_complaint text;
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
    or v_consultation.status <> 'in-progress'
    or v_queue.status <> 'claimed'
    or v_queue.claimed_by <> v_actor_id then
    raise exception 'This consultation is not claimed by the current clinician';
  end if;

  v_is_handoff_review := v_consultation.nurse_handoff_at is not null;
  v_is_final_reviewer := v_actor_role in ('admin', 'doctor');

  if v_is_handoff_review and (
    v_actor_role <> 'doctor'
    or v_consultation.review_doctor_id <> v_account_id
  ) then
    raise exception 'Only the assigned Doctor may complete this review';
  end if;

  if v_actor_role = 'nurse' and v_is_handoff_review then
    raise exception 'This Nurse handoff has already been submitted';
  end if;

  if nullif(btrim(p_notes), '') is null
    or char_length(btrim(p_notes)) > 5000 then
    raise exception 'A consultation outcome note is required';
  end if;

  if v_is_handoff_review then
    if p_vitals_disposition <> 'existing' then
      raise exception 'Doctor review must use the recorded Nurse assessment';
    end if;
    if v_consultation.vitals_disposition = 'recorded'
      and not exists (
        select 1
        from public.triage_assessments assessment
        where assessment.consultation_id = v_consultation.id
      ) then
      raise exception 'The Nurse vital-sign assessment is unavailable';
    end if;
    v_patient_complaint := v_consultation.patient_complaint;
  else
    v_patient_complaint := btrim(p_patient_complaint);
    if nullif(v_patient_complaint, '') is null
      or char_length(v_patient_complaint) > 120 then
      raise exception 'A valid patient complaint is required';
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
  end if;

  if v_actor_role = 'nurse' then
    if p_diagnosis is not null
      or p_treatment is not null
      or jsonb_array_length(coalesce(p_prescriptions, '[]'::jsonb)) > 0
      or p_follow_up is not null then
      raise exception 'Only a Doctor may add the clinical plan';
    end if;

    if p_review_doctor_id is not null
      and not private.is_review_doctor_available(p_review_doctor_id, now()) then
      raise exception 'The selected Doctor is no longer available';
    end if;
  elsif p_review_doctor_id is not null then
    raise exception 'Reviewer selection is only valid for a Nurse handoff';
  end if;

  if not v_is_handoff_review and p_vitals_disposition = 'required' then
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

  if v_actor_role = 'nurse' then
    update public.consultations
    set
      patient_complaint = v_patient_complaint,
      consultation_notes = btrim(p_notes),
      nurse_handoff_note = btrim(p_notes),
      nurse_handoff_at = now(),
      review_doctor_id = p_review_doctor_id,
      review_requested_by = v_actor_id,
      review_requested_at = now(),
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
      nurse_id = v_account_id,
      status = 'awaiting_doctor_review',
      updated_at = now()
    where id = v_consultation.id;

    update public.clinic_queue_entries
    set
      status = 'awaiting_doctor_review',
      claimed_by = null,
      claimed_at = null,
      updated_at = now()
    where id = v_queue.id;

    if p_review_doctor_id is not null then
      select account.user_id
      into v_reviewer_user_id
      from public.clinic_accounts account
      where account.id = p_review_doctor_id;

      perform private.enqueue_review_notification(
        v_actor_id,
        v_reviewer_user_id,
        v_consultation.id,
        'consultation.review_requested:' || v_consultation.id::text
      );
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
      'consultation.submitted_for_review',
      'consultation',
      v_consultation.id,
      jsonb_build_object(
        'clinic_account_id', v_account_id,
        'review_doctor_id', p_review_doctor_id,
        'patient_role', v_visit.patient_type,
        'new_status', 'awaiting_doctor_review'
      )
    );

    return 'awaiting_doctor_review';
  end if;

  for v_prescription in
    select value
    from jsonb_array_elements(coalesce(p_prescriptions, '[]'::jsonb))
  loop
    if not exists (
      select 1
      from public.medicines medicine
      where medicine.id = (v_prescription->>'medicine_id')::uuid
        and medicine.is_active
        and medicine.approval_status = 'approved'
    ) then
      raise exception 'A prescribed medicine is unavailable';
    end if;

    if nullif(v_prescription->>'quantity', '') is null
      or nullif(v_prescription->>'quantity', '')::integer not between 1 and 1000
      or (
        nullif(v_prescription->>'duration_days', '') is not null
        and nullif(v_prescription->>'duration_days', '')::integer
          not between 1 and 365
      ) then
      raise exception 'Prescription quantity or duration is invalid';
    end if;
  end loop;

  update public.consultations
  set
    patient_complaint = v_patient_complaint,
    consultation_notes = btrim(p_notes),
    doctor_review_note = btrim(p_notes),
    doctor_reviewed_at = now(),
    vitals_disposition = case
      when v_is_handoff_review then vitals_disposition
      when p_vitals_disposition = 'required' then 'recorded'
      else 'not_required'
    end,
    vitals_skip_reason = case
      when v_is_handoff_review then vitals_skip_reason
      when p_vitals_disposition = 'not_required'
        then btrim(p_vitals_skip_reason)
      else null
    end,
    vitals_assessed_by = case
      when v_is_handoff_review then vitals_assessed_by
      else v_actor_id
    end,
    vitals_assessed_at = case
      when v_is_handoff_review then vitals_assessed_at
      else now()
    end,
    doctor_id = v_account_id,
    status = 'completed',
    completed_by_user_id = v_actor_id,
    completed_by_clinic_account_id = v_account_id,
    completed_at = now(),
    updated_at = now()
  where id = v_consultation.id;

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
    from jsonb_array_elements(coalesce(p_prescriptions, '[]'::jsonb))
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

  insert into public.complaints (name)
  values (v_patient_complaint)
  on conflict do nothing;

  update public.clinic_queue_entries
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_queue.id;

  update public.clinic_visits
  set status = 'completed', check_out_time = now(), updated_at = now()
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
    'consultation.completed',
    'consultation',
    v_consultation.id,
    jsonb_build_object(
      'clinic_account_id', v_account_id,
      'clinician_role', v_actor_role,
      'patient_role', v_visit.patient_type,
      'reviewed_nurse_handoff', v_is_handoff_review,
      'new_status', 'completed'
    )
  );

  return 'completed';
end;
$$;

-- Reassigns an unclaimed Nurse handoff without exposing patient details.
create or replace function public.reassign_consultation_review(
  requested_consultation_id uuid,
  requested_doctor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_consultation public.consultations%rowtype;
  v_reviewer_user_id uuid;
begin
  select role.name
  into v_actor_role
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  join public.clinic_accounts account
    on account.user_id = user_role.user_id
   and account.role = role.name
   and account.is_active
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'nurse')
  limit 1;

  if v_actor_role is null then
    raise exception 'Active Nurse or Admin account is required';
  end if;

  select * into v_consultation
  from public.consultations
  where id = requested_consultation_id
  for update;

  if v_consultation.status <> 'awaiting_doctor_review'
    or v_consultation.nurse_handoff_at is null
    or exists (
      select 1
      from public.clinic_queue_entries queue
      where queue.visit_id = v_consultation.visit_id
        and queue.claimed_by is not null
    ) then
    raise exception 'Only an unclaimed Nurse handoff may be reassigned';
  end if;

  if v_actor_role = 'nurse'
    and v_consultation.review_requested_by <> v_actor_id then
    raise exception 'Only the submitting Nurse may reassign this review';
  end if;

  if requested_doctor_id is not null
    and not private.is_review_doctor_available(requested_doctor_id, now()) then
    raise exception 'The selected Doctor is no longer available';
  end if;

  update public.consultations
  set
    review_doctor_id = requested_doctor_id,
    review_requested_at = now(),
    updated_at = now()
  where id = requested_consultation_id;

  if requested_doctor_id is not null then
    select account.user_id
    into v_reviewer_user_id
    from public.clinic_accounts account
    where account.id = requested_doctor_id;

    perform private.enqueue_review_notification(
      v_actor_id,
      v_reviewer_user_id,
      requested_consultation_id,
      'consultation.review_reassigned:'
        || requested_consultation_id::text
        || ':'
        || requested_doctor_id::text
    );
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
    'consultation.review_reassigned',
    'consultation',
    requested_consultation_id,
    jsonb_build_object('review_doctor_id', requested_doctor_id)
  );
end;
$$;

-- Creates the allowlisted notification and archives the claimed message.
create or replace function public.complete_notification_job(
  requested_job_id uuid,
  requested_message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.notification_jobs%rowtype;
  v_message jsonb;
begin
  select * into v_job
  from private.notification_jobs
  where id = requested_job_id
  for update;

  select message into v_message
  from pgmq.q_zentraq_notification_jobs
  where msg_id = requested_message_id;

  if v_job.id is null
    or v_job.status <> 'processing'
    or v_message->>'jobId' <> requested_job_id::text then
    return false;
  end if;

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
    v_job.requested_by,
    v_job.receiver_id,
    case v_job.template_key
      when 'appointment.updated' then 'Appointment update'
      when 'clearance.updated' then 'Clearance update'
      when 'inventory.attention' then 'Inventory update'
      when 'consultation.review_requested' then 'Consultation review'
      else 'System notice'
    end,
    case v_job.template_key
      when 'appointment.updated'
        then 'An appointment update is available in Zentraq.'
      when 'clearance.updated'
        then 'A clearance update is available in Zentraq.'
      when 'inventory.attention'
        then 'An inventory item requires attention in Zentraq.'
      when 'consultation.review_requested'
        then 'A consultation is ready for your review in Zentraq.'
      else 'A new system notice is available in Zentraq.'
    end,
    split_part(v_job.template_key, '.', 1),
    v_job.entity_type,
    v_job.entity_id
  );

  perform pgmq.archive('zentraq_notification_jobs', requested_message_id);

  update private.notification_jobs
  set
    status = 'completed',
    error_code = null,
    completed_at = now(),
    updated_at = now()
  where id = requested_job_id;

  return true;
end;
$$;

-- Returns one requester-owned platform smoke status to the server boundary.
create or replace function public.get_service_job_status(
  requested_job_id uuid,
  requested_by uuid
)
returns table (
  status text,
  attempts integer,
  error_code text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    job.status,
    job.attempts,
    job.last_error_code,
    job.updated_at
  from private.service_jobs job
  where job.id = requested_job_id
    and job.requested_by = requested_by
    and job.job_type = 'platform.smoke_test';
$$;

revoke all on function public.get_available_review_doctors()
  from public, anon, service_role;
grant execute on function public.get_available_review_doctors()
  to authenticated;

revoke all on function public.get_my_clinician_duty_status()
  from public, anon, service_role;
grant execute on function public.get_my_clinician_duty_status()
  to authenticated;

revoke all on function public.set_my_clinician_duty_status(boolean)
  from public, anon, service_role;
grant execute on function public.set_my_clinician_duty_status(boolean)
  to authenticated;

revoke all on function public.claim_consultation(uuid)
  from public, anon, service_role;
grant execute on function public.claim_consultation(uuid)
  to authenticated;

revoke all on function public.finalize_consultation_workflow(
  uuid, text, uuid, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, service_role;
grant execute on function public.finalize_consultation_workflow(
  uuid, text, uuid, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb
) to authenticated;

revoke all on function public.reassign_consultation_review(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.reassign_consultation_review(uuid, uuid)
  to authenticated;

revoke all on function public.complete_notification_job(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.complete_notification_job(uuid, bigint)
  to service_role;

revoke all on function public.get_service_job_status(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_service_job_status(uuid, uuid)
  to service_role;
