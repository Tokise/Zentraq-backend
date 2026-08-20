create table if not exists public.medical_exam_results (
  id uuid primary key default gen_random_uuid(),
  patient_role text not null
    check (patient_role in ('student', 'faculty', 'staff')),
  student_id uuid references public.students(id) on delete cascade,
  faculty_id uuid references public.faculty(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  school_year text,
  semester text,
  calendar_year integer,
  clinical_result_status text,
  exam_details text not null,
  result_storage_path text not null,
  result_file_name text not null,
  result_mime_type text not null,
  result_file_size integer not null check (result_file_size > 0),
  uploaded_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medical_exam_results_one_patient_check check (
    num_nonnulls(student_id, faculty_id, staff_id) = 1
  ),
  constraint medical_exam_results_role_patient_check check (
    (patient_role = 'student' and student_id is not null) or
    (patient_role = 'faculty' and faculty_id is not null) or
    (patient_role = 'staff' and staff_id is not null)
  ),
  constraint medical_exam_results_student_fields_check check (
    (
      patient_role = 'student' and
      school_year is not null and
      semester is not null and
      calendar_year is null and
      clinical_result_status in ('cleared', 'pending', 'not_cleared')
    ) or
    (
      patient_role in ('faculty', 'staff') and
      school_year is null and
      semester is null and
      calendar_year between 2000 and 2200 and
      clinical_result_status is null
    )
  )
);

create table if not exists public.sick_leave_entries (
  id uuid primary key default gen_random_uuid(),
  patient_role text not null check (patient_role in ('faculty', 'staff')),
  faculty_id uuid references public.faculty(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason_diagnosis text not null,
  certificate_storage_path text not null,
  certificate_file_name text not null,
  certificate_mime_type text not null,
  certificate_file_size integer not null check (certificate_file_size > 0),
  authored_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sick_leave_entries_date_range_check check (
    end_date >= start_date
  ),
  constraint sick_leave_entries_one_patient_check check (
    num_nonnulls(faculty_id, staff_id) = 1
  ),
  constraint sick_leave_entries_role_patient_check check (
    (patient_role = 'faculty' and faculty_id is not null) or
    (patient_role = 'staff' and staff_id is not null)
  )
);

create index if not exists medical_exam_results_student_created_idx
  on public.medical_exam_results (student_id, created_at desc)
  where student_id is not null;

create index if not exists medical_exam_results_faculty_year_idx
  on public.medical_exam_results (faculty_id, calendar_year desc, created_at desc)
  where faculty_id is not null;

create index if not exists medical_exam_results_staff_year_idx
  on public.medical_exam_results (staff_id, calendar_year desc, created_at desc)
  where staff_id is not null;

create index if not exists sick_leave_entries_faculty_dates_idx
  on public.sick_leave_entries (faculty_id, start_date desc, created_at desc)
  where faculty_id is not null;

create index if not exists sick_leave_entries_staff_dates_idx
  on public.sick_leave_entries (staff_id, start_date desc, created_at desc)
  where staff_id is not null;

alter table public.medical_exam_results enable row level security;
alter table public.sick_leave_entries enable row level security;

create policy "Patients and clinic roles read medical exams"
  on public.medical_exam_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name in ('admin', 'doctor', 'nurse')
    )
    or exists (
      select 1
      from public.students s
      where s.id = medical_exam_results.student_id
        and s.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.faculty f
      where f.id = medical_exam_results.faculty_id
        and f.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.staff st
      where st.id = medical_exam_results.staff_id
        and st.user_id = (select auth.uid())
    )
  );

create policy "Admins create medical exams"
  on public.medical_exam_results
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name = 'admin'
    )
  );

create policy "Patients and clinic roles read sick leave"
  on public.sick_leave_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name in ('admin', 'doctor', 'nurse')
    )
    or exists (
      select 1
      from public.faculty f
      where f.id = sick_leave_entries.faculty_id
        and f.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.staff st
      where st.id = sick_leave_entries.staff_id
        and st.user_id = (select auth.uid())
    )
  );

create policy "Clinic roles create sick leave"
  on public.sick_leave_entries
  for insert
  to authenticated
  with check (
    authored_by = (select auth.uid())
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name in ('admin', 'doctor', 'nurse')
    )
  );

grant select, insert on public.medical_exam_results to authenticated;
grant select, insert on public.sick_leave_entries to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.medical_exam_results.result_storage_path is
  'Private compliance-documents object path. Never expose in client DTOs.';

comment on column public.sick_leave_entries.certificate_storage_path is
  'Private compliance-documents object path. Never expose in client DTOs.';
