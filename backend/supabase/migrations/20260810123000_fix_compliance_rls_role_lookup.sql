create schema if not exists private;

revoke usage on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.compliance_has_any_role(
  required_roles text[]
)
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
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name = any(required_roles)
    );
$$;

create or replace function private.compliance_owns_patient(
  requested_role text,
  requested_student_id uuid,
  requested_faculty_id uuid,
  requested_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      (
        requested_role = 'student'
        and exists (
          select 1
          from public.students s
          where s.id = requested_student_id
            and s.user_id = (select auth.uid())
        )
      )
      or (
        requested_role = 'faculty'
        and exists (
          select 1
          from public.faculty f
          where f.id = requested_faculty_id
            and f.user_id = (select auth.uid())
        )
      )
      or (
        requested_role = 'staff'
        and exists (
          select 1
          from public.staff st
          where st.id = requested_staff_id
            and st.user_id = (select auth.uid())
        )
      )
    );
$$;

revoke all on function private.compliance_has_any_role(text[]) from public, anon;
revoke all on function private.compliance_owns_patient(
  text,
  uuid,
  uuid,
  uuid
) from public, anon;

grant execute on function private.compliance_has_any_role(text[])
  to authenticated;
grant execute on function private.compliance_owns_patient(
  text,
  uuid,
  uuid,
  uuid
) to authenticated;

drop policy if exists "Patients and clinic roles read medical exams"
  on public.medical_exam_results;
drop policy if exists "Admins create medical exams"
  on public.medical_exam_results;
drop policy if exists "Patients and clinic roles read sick leave"
  on public.sick_leave_entries;
drop policy if exists "Clinic roles create sick leave"
  on public.sick_leave_entries;

create policy "Patients and clinic roles read medical exams"
  on public.medical_exam_results
  for select
  to authenticated
  using (
    private.compliance_has_any_role(array['admin', 'doctor', 'nurse'])
    or private.compliance_owns_patient(
      patient_role,
      student_id,
      faculty_id,
      staff_id
    )
  );

create policy "Admins create medical exams"
  on public.medical_exam_results
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.compliance_has_any_role(array['admin'])
  );

create policy "Patients and clinic roles read sick leave"
  on public.sick_leave_entries
  for select
  to authenticated
  using (
    private.compliance_has_any_role(array['admin', 'doctor', 'nurse'])
    or private.compliance_owns_patient(
      patient_role,
      null,
      faculty_id,
      staff_id
    )
  );

create policy "Clinic roles create sick leave"
  on public.sick_leave_entries
  for insert
  to authenticated
  with check (
    authored_by = (select auth.uid())
    and private.compliance_has_any_role(array['admin', 'doctor', 'nurse'])
  );
