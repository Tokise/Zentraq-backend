set lock_timeout = '5s';
set statement_timeout = '30s';

create extension if not exists pgcrypto with schema extensions;

alter table public.user_sessions
  add column if not exists session_token_hash text;

update public.user_sessions
set session_token_hash = encode(
  extensions.digest(session_token, 'sha256'),
  'hex'
)
where session_token_hash is null;

alter table public.user_sessions
  alter column session_token_hash set not null;

alter table public.user_sessions
  add constraint user_sessions_token_hash_format
  check (session_token_hash ~ '^[0-9a-f]{64}$') not valid;

alter table public.user_sessions
  validate constraint user_sessions_token_hash_format;

create unique index if not exists user_sessions_token_hash_key
  on public.user_sessions(session_token_hash);

create index if not exists user_sessions_active_lookup_idx
  on public.user_sessions(user_id, session_token_hash)
  where revoked_at is null;

alter table public.user_sessions
  drop column session_token;

-- Atomically creates the single active application session after Auth succeeds.
create or replace function public.establish_user_session_v1(
  p_user_id uuid,
  p_session_token_hash text,
  p_ip_address text,
  p_user_agent text,
  p_expires_at timestamptz
)
returns table(role text, session_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_session_id uuid;
begin
  if p_user_id is null
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '31 days'
    or char_length(coalesce(p_ip_address, '')) > 128
    or char_length(coalesce(p_user_agent, '')) > 512 then
    raise exception using
      errcode = '22023',
      message = 'Invalid session parameters';
  end if;

  select assigned_role.name
  into v_role
  from public.user_roles assignment
  join public.roles assigned_role on assigned_role.id = assignment.role_id
  where assignment.user_id = p_user_id
    and assigned_role.name in (
      'admin',
      'doctor',
      'nurse',
      'student',
      'faculty',
      'staff'
    )
  order by assigned_role.name
  limit 1;

  if v_role is null then
    raise exception using
      errcode = 'P0002',
      message = 'No active role assignment';
  end if;

  update public.user_sessions
  set revoked_at = now()
  where user_id = p_user_id
    and revoked_at is null;

  insert into public.user_sessions (
    user_id,
    session_token_hash,
    ip_address,
    user_agent,
    expires_at
  )
  values (
    p_user_id,
    p_session_token_hash,
    nullif(left(p_ip_address, 128), ''),
    nullif(left(p_user_agent, 512), ''),
    p_expires_at
  )
  returning id into v_session_id;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    ip_address,
    user_agent
  )
  values (
    p_user_id,
    'AUTH_LOGIN_SUCCESS',
    'application_session',
    v_session_id,
    jsonb_build_object('role', v_role),
    nullif(left(p_ip_address, 128), ''),
    nullif(left(p_user_agent, 512), '')
  );

  return query select v_role, v_session_id;
end;
$$;

-- Validates one active application session and resolves its current DB role.
create or replace function public.validate_portal_session_v1(
  p_user_id uuid,
  p_session_token_hash text
)
returns table(valid boolean, role text)
language sql
stable
security definer
set search_path = ''
as $$
  with active_session as (
    select true as valid
    from public.user_sessions session
    where session.user_id = p_user_id
      and session.session_token_hash = p_session_token_hash
      and session.revoked_at is null
      and session.expires_at > now()
    limit 1
  ), active_role as (
    select assigned_role.name as role
    from public.user_roles assignment
    join public.roles assigned_role on assigned_role.id = assignment.role_id
    where assignment.user_id = p_user_id
      and assigned_role.name in (
        'admin',
        'doctor',
        'nurse',
        'student',
        'faculty',
        'staff'
      )
    order by assigned_role.name
    limit 1
  )
  select
    exists(select 1 from active_session)
      and exists(select 1 from active_role) as valid,
    case
      when exists(select 1 from active_session)
        then (select active_role.role from active_role)
      else null
    end as role;
$$;

-- Returns a bounded, role-owned dashboard snapshot in one database roundtrip.
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

  select coalesce(jsonb_agg(to_jsonb(recent_consultation)), '[]'::jsonb)
  into v_consultations
  from (
    select
      consultation.id,
      coalesce(
        nullif(concat_ws(' ', student.first_name, student.last_name), ''),
        nullif(concat_ws(' ', faculty.first_name, faculty.last_name), ''),
        nullif(concat_ws(' ', staff.first_name, staff.last_name), ''),
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

  select coalesce(jsonb_agg(to_jsonb(recent_appointment)), '[]'::jsonb)
  into v_appointments
  from (
    select
      appointment.id,
      coalesce(appointment.scheduled_date::text, '') as appointment_date,
      coalesce(appointment.scheduled_time::text, '') as time_slot,
      appointment.reason,
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
    ), daily as (
      select
        event_date,
        count(*) filter (where kind = 'assigned') as assigned_consultations,
        count(*) filter (where kind = 'completed') as completed_consultations,
        count(*) filter (where kind = 'triage') as triage_assessments,
        count(*) filter (where kind = 'check_in') as patient_check_ins
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
    ), daily as (
      select
        event_date,
        count(*) filter (where kind = 'assigned') as assigned_consultations,
        count(*) filter (where kind = 'completed') as completed_consultations,
        count(*) filter (where kind = 'appointment') as scheduled_appointments,
        count(*) filter (where kind = 'prescription') as prescriptions_written,
        count(*) filter (where kind = 'clearance') as clearance_evaluations
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

revoke all on function public.establish_user_session_v1(
  uuid,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.validate_portal_session_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_dashboard_snapshot_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.establish_user_session_v1(
  uuid,
  text,
  text,
  text,
  timestamptz
) to service_role;
grant execute on function public.validate_portal_session_v1(uuid, text)
  to service_role;
grant execute on function public.get_dashboard_snapshot_v1(uuid, text)
  to service_role;

create index if not exists consultations_doctor_dashboard_idx
  on public.consultations(doctor_id, created_at desc);
create index if not exists consultations_nurse_dashboard_idx
  on public.consultations(nurse_id, created_at desc);
create index if not exists appointments_doctor_dashboard_idx
  on public.appointments(doctor_id, scheduled_date);
