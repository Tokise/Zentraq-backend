-- Creates RPC function to calculate accurate, un-truncated clinician workload stats.

set lock_timeout = '5s';
set statement_timeout = '30s';

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
  -- Resolve Manila clinic local date
  v_today_date := (now() at time zone 'Asia/Manila')::date;

  -- Find clinic account
  select id into v_clinic_account_id
  from public.clinic_accounts
  where user_id = p_user_id
    and role = p_role
    and is_active = true
  limit 1;

  if v_clinic_account_id is null then
    return jsonb_build_object(
      'totalPatients', 0,
      'patientsToday', 0,
      'consultations', 0,
      'appointments', 0,
      'pendingRequests', 0
    );
  end if;

  -- Total distinct assigned patients (all-time / overall)
  select count(distinct coalesce(v.student_id, v.faculty_id, v.staff_id))
  into v_total_assigned_patients
  from public.consultations c
  join public.clinic_visits v on v.id = c.visit_id
  where c.doctor_id = v_clinic_account_id
     or c.nurse_id = v_clinic_account_id
     or c.claimed_by_clinic_account_id = v_clinic_account_id
     or c.completed_by_clinic_account_id = v_clinic_account_id;

  -- Assigned patients handled today (in Manila local date)
  select count(distinct coalesce(v.student_id, v.faculty_id, v.staff_id))
  into v_patients_today
  from public.consultations c
  join public.clinic_visits v on v.id = c.visit_id
  where (c.doctor_id = v_clinic_account_id
         or c.nurse_id = v_clinic_account_id
         or c.claimed_by_clinic_account_id = v_clinic_account_id
         or c.completed_by_clinic_account_id = v_clinic_account_id)
    and ((c.created_at at time zone 'Asia/Manila')::date = v_today_date
         or (v.check_in_time at time zone 'Asia/Manila')::date = v_today_date
         or (c.completed_at at time zone 'Asia/Manila')::date = v_today_date);

  -- Total assigned consultations
  select count(*)
  into v_total_consultations
  from public.consultations c
  where c.doctor_id = v_clinic_account_id
     or c.nurse_id = v_clinic_account_id
     or c.claimed_by_clinic_account_id = v_clinic_account_id
     or c.completed_by_clinic_account_id = v_clinic_account_id;

  -- Total assigned appointments
  select count(*)
  into v_total_appointments
  from public.appointments a
  where a.doctor_id = v_clinic_account_id;

  -- Pending requests
  select count(*)
  into v_pending_requests
  from public.consultations c
  where (c.doctor_id = v_clinic_account_id
         or c.nurse_id = v_clinic_account_id
         or c.claimed_by_clinic_account_id = v_clinic_account_id)
    and c.status in ('waiting', 'in-progress', 'awaiting_doctor_review');

  return jsonb_build_object(
    'totalPatients', v_total_assigned_patients,
    'patientsToday', v_patients_today,
    'consultations', v_total_consultations,
    'appointments', v_total_appointments,
    'pendingRequests', v_pending_requests
  );
end;
$$;

grant execute on function public.get_clinician_workload_stats(uuid, text)
  to authenticated, service_role;
