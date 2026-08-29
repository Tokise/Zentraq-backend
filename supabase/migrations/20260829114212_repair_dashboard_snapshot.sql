-- Repairs the manually applied dashboard snapshot and its missing dependency.

set lock_timeout = '5s';
set statement_timeout = '30s';

-- Returns role-owned workload counts without exposing row-level clinical data.
create or replace function public.get_clinician_workload_stats(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_account_id uuid;
  v_today_date date;
  v_total_assigned_patients bigint := 0;
  v_patients_today bigint := 0;
  v_total_consultations bigint := 0;
  v_total_appointments bigint := 0;
  v_pending_requests bigint := 0;
begin
  if p_role not in ('admin', 'doctor', 'nurse') then
    raise exception using
      errcode = '22023',
      message = 'Invalid dashboard role';
  end if;

  v_today_date := (now() at time zone 'Asia/Manila')::date;

  select account.id
  into v_clinic_account_id
  from public.clinic_accounts account
  where account.user_id = p_user_id
    and account.role = p_role
    and account.is_active
  limit 1;

  if v_clinic_account_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Active clinic account not found';
  end if;

  select count(
    distinct coalesce(
      visit.student_id,
      visit.faculty_id,
      visit.staff_id
    )
  )
  into v_total_assigned_patients
  from public.consultations consultation
  join public.clinic_visits visit on visit.id = consultation.visit_id
  where consultation.doctor_id = v_clinic_account_id
     or consultation.nurse_id = v_clinic_account_id
     or consultation.claimed_by_clinic_account_id = v_clinic_account_id
     or consultation.completed_by_clinic_account_id = v_clinic_account_id;

  select count(
    distinct coalesce(
      visit.student_id,
      visit.faculty_id,
      visit.staff_id
    )
  )
  into v_patients_today
  from public.consultations consultation
  join public.clinic_visits visit on visit.id = consultation.visit_id
  where (
    consultation.doctor_id = v_clinic_account_id
    or consultation.nurse_id = v_clinic_account_id
    or consultation.claimed_by_clinic_account_id = v_clinic_account_id
    or consultation.completed_by_clinic_account_id = v_clinic_account_id
  )
    and (
      (
        consultation.created_at at time zone 'Asia/Manila'
      )::date = v_today_date
      or (
        visit.check_in_time at time zone 'Asia/Manila'
      )::date = v_today_date
      or (
        consultation.completed_at at time zone 'Asia/Manila'
      )::date = v_today_date
    );

  select count(*)
  into v_total_consultations
  from public.consultations consultation
  where consultation.doctor_id = v_clinic_account_id
     or consultation.nurse_id = v_clinic_account_id
     or consultation.claimed_by_clinic_account_id = v_clinic_account_id
     or consultation.completed_by_clinic_account_id = v_clinic_account_id;

  select count(*)
  into v_total_appointments
  from public.appointments appointment
  where appointment.doctor_id = v_clinic_account_id;

  select count(*)
  into v_pending_requests
  from public.consultations consultation
  where (
    consultation.doctor_id = v_clinic_account_id
    or consultation.nurse_id = v_clinic_account_id
    or consultation.claimed_by_clinic_account_id = v_clinic_account_id
  )
    and consultation.status in (
      'waiting',
      'in-progress',
      'awaiting_doctor_review'
    );

  return jsonb_build_object(
    'totalPatients', v_total_assigned_patients,
    'patientsToday', v_patients_today,
    'consultations', v_total_consultations,
    'appointments', v_total_appointments,
    'pendingRequests', v_pending_requests
  );
end;
$$;

-- Returns a bounded, assignment-aware dashboard snapshot in one roundtrip.
create or replace function public.get_dashboard_snapshot_v1(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_activity jsonb := '[]'::jsonb;
  v_appointments jsonb := '[]'::jsonb;
  v_consultations jsonb := '[]'::jsonb;
  v_stats jsonb := '{}'::jsonb;
begin
  if p_role not in ('admin', 'doctor', 'nurse') then
    raise exception using
      errcode = '22023',
      message = 'Invalid dashboard role';
  end if;

  select account.id
  into v_account_id
  from public.clinic_accounts account
  where account.user_id = p_user_id
    and account.role = p_role
    and account.is_active
  limit 1;

  if v_account_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Active clinic account not found';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(recent_consultation)),
    '[]'::jsonb
  )
  into v_consultations
  from (
    select
      consultation.id,
      coalesce(
        nullif(
          concat_ws(' ', student.first_name, student.last_name),
          ''
        ),
        nullif(
          concat_ws(' ', faculty.first_name, faculty.last_name),
          ''
        ),
        nullif(
          concat_ws(' ', staff.first_name, staff.last_name),
          ''
        ),
        'Unknown patient'
      ) as patient_name,
      coalesce(consultation.patient_complaint, '') as patient_complaint,
      consultation.status,
      consultation.created_at,
      consultation.completed_at as handled_at,
      consultation.consultation_notes as notes
    from public.consultations consultation
    join public.clinic_visits visit on visit.id = consultation.visit_id
    left join public.students student on student.id = visit.student_id
    left join public.faculty faculty on faculty.id = visit.faculty_id
    left join public.staff staff on staff.id = visit.staff_id
    where case
      when p_role = 'nurse' then consultation.nurse_id = v_account_id
      else consultation.doctor_id = v_account_id
    end
    order by consultation.created_at desc
    limit 25
  ) recent_consultation;

  select coalesce(
    jsonb_agg(to_jsonb(recent_appointment)),
    '[]'::jsonb
  )
  into v_appointments
  from (
    select
      appointment.id,
      coalesce(appointment.scheduled_date::text, '') as appointment_date,
      coalesce(appointment.scheduled_time::text, '') as time_slot,
      appointment_source.reason,
      appointment.status,
      nullif(
        concat_ws(
          ' ',
          appointment.patient_first_name,
          appointment.patient_last_name
        ),
        ''
      ) as patient_name,
      null::text as student_number,
      null::text as employee_number,
      null::text as department
    from public.v_appointment_overview appointment
    join public.appointments appointment_source
      on appointment_source.id = appointment.id
    where appointment.doctor_id = v_account_id
    order by appointment.scheduled_date asc nulls last
    limit 25
  ) recent_appointment;

  if p_role = 'nurse' then
    with activity_event as (
      select consultation.created_at::date as event_date, 'assigned' as kind
      from public.consultations consultation
      where consultation.nurse_id = v_account_id
        and consultation.created_at >= now() - interval '89 days'

      union all

      select consultation.completed_at::date, 'completed'
      from public.consultations consultation
      where consultation.nurse_id = v_account_id
        and consultation.completed_at >= now() - interval '89 days'

      union all

      select assessment.created_at::date, 'triage'
      from public.triage_assessments assessment
      where assessment.nurse_id = v_account_id
        and assessment.created_at >= now() - interval '89 days'

      union all

      select visit.check_in_time::date, 'check_in'
      from public.clinic_visits visit
      where visit.created_by = p_user_id
        and visit.check_in_time >= now() - interval '89 days'
    ),
    daily as (
      select
        event_date,
        count(*) filter (
          where kind = 'assigned'
        ) as assigned_consultations,
        count(*) filter (
          where kind = 'completed'
        ) as completed_consultations,
        count(*) filter (
          where kind = 'triage'
        ) as triage_assessments,
        count(*) filter (
          where kind = 'check_in'
        ) as patient_check_ins
      from activity_event
      group by event_date
      order by event_date
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', daily.event_date,
          'assigned_consultations', daily.assigned_consultations,
          'completed_consultations', daily.completed_consultations,
          'triage_assessments', daily.triage_assessments,
          'patient_check_ins', daily.patient_check_ins
        )
      ),
      '[]'::jsonb
    )
    into v_activity
    from daily;
  else
    with activity_event as (
      select consultation.created_at::date as event_date, 'assigned' as kind
      from public.consultations consultation
      where consultation.doctor_id = v_account_id
        and consultation.created_at >= now() - interval '89 days'

      union all

      select consultation.completed_at::date, 'completed'
      from public.consultations consultation
      where consultation.doctor_id = v_account_id
        and consultation.completed_at >= now() - interval '89 days'

      union all

      select appointment.scheduled_date, 'appointment'
      from public.appointments appointment
      where appointment.doctor_id = v_account_id
        and appointment.scheduled_date >= current_date - 89

      union all

      select prescription.created_at::date, 'prescription'
      from public.prescriptions prescription
      where prescription.prescribed_by = p_user_id
        and prescription.created_at >= now() - interval '89 days'

      union all

      select evaluation.evaluated_at::date, 'clearance'
      from public.clearance_evaluations evaluation
      where evaluation.doctor_id = v_account_id
        and evaluation.evaluated_at >= now() - interval '89 days'
    ),
    daily as (
      select
        event_date,
        count(*) filter (
          where kind = 'assigned'
        ) as assigned_consultations,
        count(*) filter (
          where kind = 'completed'
        ) as completed_consultations,
        count(*) filter (
          where kind = 'appointment'
        ) as scheduled_appointments,
        count(*) filter (
          where kind = 'prescription'
        ) as prescriptions_written,
        count(*) filter (
          where kind = 'clearance'
        ) as clearance_evaluations
      from activity_event
      group by event_date
      order by event_date
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', daily.event_date,
          'assigned_consultations', daily.assigned_consultations,
          'completed_consultations', daily.completed_consultations,
          'scheduled_appointments', daily.scheduled_appointments,
          'prescriptions_written', daily.prescriptions_written,
          'clearance_evaluations', daily.clearance_evaluations
        )
      ),
      '[]'::jsonb
    )
    into v_activity
    from daily;
  end if;

  v_stats := public.get_clinician_workload_stats(p_user_id, p_role)
    || jsonb_build_object('emergencyCases', 0);

  return jsonb_build_object(
    'activity', v_activity,
    'activityScope', p_role,
    'appointments', v_appointments,
    'consultations', v_consultations,
    'stats', v_stats
  );
end;
$$;

revoke all on function public.get_clinician_workload_stats(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_dashboard_snapshot_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.get_clinician_workload_stats(uuid, text)
  to service_role;
grant execute on function public.get_dashboard_snapshot_v1(uuid, text)
  to service_role;
