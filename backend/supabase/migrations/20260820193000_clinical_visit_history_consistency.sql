-- Ensures completed consultations and notifications are consistently processed for clinical history and realtime domain events.

set lock_timeout = '5s';
set statement_timeout = '30s';

-- Create or update the consultation transition trigger to notify both clinician and patient upon completion.
create or replace function public.notify_consultation_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_patient_name text := 'Patient';
  v_visit public.clinic_visits%rowtype;
begin
  if old.status is not distinct from new.status then
    return null;
  end if;

  select * into v_visit
  from public.clinic_visits
  where id = new.visit_id;

  select
    case v_visit.patient_type
      when 'student' then student.user_id
      when 'faculty' then faculty.user_id
      when 'staff' then staff.user_id
    end,
    coalesce(
      case v_visit.patient_type
        when 'student' then trim(concat(student.first_name, ' ', student.last_name))
        when 'faculty' then trim(concat(faculty.first_name, ' ', faculty.last_name))
        when 'staff' then trim(concat(staff.first_name, ' ', staff.last_name))
      end,
      'Patient'
    )
  into v_patient_user_id, v_patient_name
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
  elsif new.status = 'completed' then
    -- Notify the completing clinician operator
    if new.completed_by_user_id is not null then
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
        new.completed_by_user_id,
        'Consultation completed',
        concat('Consultation for ', v_patient_name, ' has been successfully completed.'),
        'consultation',
        'consultation',
        new.id
      );
    end if;

    -- Notify the patient if registered
    if v_patient_user_id is not null and (new.completed_by_user_id is null or v_patient_user_id <> new.completed_by_user_id) then
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
        coalesce(new.completed_by_user_id, v_patient_user_id),
        v_patient_user_id,
        'Consultation completed',
        'Your clinic consultation has been completed.',
        'consultation',
        'consultation',
        new.id
      );
    end if;
  end if;

  return null;
end;
$$;

create index if not exists consultations_history_clinician_idx
  on public.consultations (
    status,
    completed_at desc,
    doctor_id,
    nurse_id,
    claimed_by_clinic_account_id,
    completed_by_clinic_account_id
  )
  where status = 'completed';

-- Backfills any completed consultations missing completed_by_clinic_account_id from claimed account.
update public.consultations
set
  completed_by_clinic_account_id = coalesce(completed_by_clinic_account_id, claimed_by_clinic_account_id, doctor_id, nurse_id),
  completed_at = coalesce(completed_at, updated_at, now())
where status = 'completed'
  and completed_by_clinic_account_id is null;
