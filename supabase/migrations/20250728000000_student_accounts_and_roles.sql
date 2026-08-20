-- ============================================================
-- MIGRATION: student_accounts, announcements, appointments
-- + role update: operator → nurse/doctor
-- ============================================================

-- 1. Create student_accounts table (replaces clinic_profiles as the main table)
create table if not exists public.student_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null unique,
  rfid_uid text unique,
  first_name text not null,
  last_name text not null,
  email text,
  student_number text unique,
  employee_number text,
  department text,
  course text,
  year_level text,
  position text,
  clinic_photo_url text,
  active_status boolean default true,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Migrate all existing clinic_profiles data into student_accounts
insert into public.student_accounts (
  id, rfid_uid, first_name, last_name, email, student_number,
  employee_number, department, course, year_level, position,
  clinic_photo_url, active_status, archived_at, created_at
)
select
  id, rfid_uid, first_name, last_name, email, student_number,
  employee_number, department, course, year_level, position,
  clinic_photo_url, active_status, archived_at, created_at
from public.clinic_profiles
on conflict (id) do nothing;

-- 3. Create announcements table
create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  posted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Create student_appointments table
create table if not exists public.student_appointments (
  id uuid default gen_random_uuid() primary key,
  student_user_id uuid references auth.users(id) on delete cascade,
  student_account_id uuid references public.student_accounts(id) on delete cascade,
  appointment_date date not null,
  time_slot text not null,
  reason text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz default now()
);

-- 5. Enable RLS
alter table public.student_accounts enable row level security;
alter table public.announcements enable row level security;
alter table public.student_appointments enable row level security;

-- 6. RLS policies for student_accounts
drop policy if exists "authenticated_select_student_accounts" on public.student_accounts;
drop policy if exists "authenticated_insert_student_accounts" on public.student_accounts;
drop policy if exists "authenticated_update_student_accounts" on public.student_accounts;
drop policy if exists "anon_select_student_accounts" on public.student_accounts;
drop policy if exists "anon_insert_student_accounts" on public.student_accounts;

create policy "authenticated_select_student_accounts"
  on public.student_accounts for select
  to authenticated
  using (true);

create policy "authenticated_insert_student_accounts"
  on public.student_accounts for insert
  to authenticated
  with check (true);

create policy "authenticated_update_student_accounts"
  on public.student_accounts for update
  to authenticated
  using (true)
  with check (true);

create policy "anon_select_student_accounts"
  on public.student_accounts for select
  to anon
  using (true);

create policy "anon_insert_student_accounts"
  on public.student_accounts for insert
  to anon
  with check (true);

-- 7. RLS policies for announcements
drop policy if exists "authenticated_select_announcements" on public.announcements;
drop policy if exists "authenticated_insert_announcements" on public.announcements;
drop policy if exists "authenticated_update_announcements" on public.announcements;
drop policy if exists "authenticated_delete_announcements" on public.announcements;
drop policy if exists "anon_select_announcements" on public.announcements;

create policy "authenticated_select_announcements"
  on public.announcements for select
  to authenticated
  using (true);

create policy "authenticated_insert_announcements"
  on public.announcements for insert
  to authenticated
  with check (true);

create policy "authenticated_update_announcements"
  on public.announcements for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_delete_announcements"
  on public.announcements for delete
  to authenticated
  using (true);

create policy "anon_select_announcements"
  on public.announcements for select
  to anon
  using (true);

-- 8. RLS policies for student_appointments
drop policy if exists "authenticated_select_student_appointments" on public.student_appointments;
drop policy if exists "authenticated_insert_student_appointments" on public.student_appointments;
drop policy if exists "authenticated_update_student_appointments" on public.student_appointments;
drop policy if exists "authenticated_delete_student_appointments" on public.student_appointments;

create policy "authenticated_select_student_appointments"
  on public.student_appointments for select
  to authenticated
  using (true);

create policy "authenticated_insert_student_appointments"
  on public.student_appointments for insert
  to authenticated
  with check (true);

create policy "authenticated_update_student_appointments"
  on public.student_appointments for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_delete_student_appointments"
  on public.student_appointments for delete
  to authenticated
  using (true);

-- 9. Enable realtime
alter publication supabase_realtime add table public.student_accounts;
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.student_appointments;

-- 10. Grant permissions
grant select, insert, update, delete on public.student_accounts to anon, authenticated;
grant select, insert, update, delete on public.announcements to anon, authenticated;
grant select, insert, update, delete on public.student_appointments to authenticated;

-- 11. Update the user_role enum to support new roles
-- First check what values already exist before adding
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'nurse' and enumtypid = 'public.user_role'::regtype) then
    alter type public.user_role add value 'nurse';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'doctor' and enumtypid = 'public.user_role'::regtype) then
    alter type public.user_role add value 'doctor';
  end if;
end $$;

-- 12. Update existing operator/receptionist roles to nurse (these old values shouldn't exist, but just in case)
-- The profiles table shouldn't have 'operator' or 'receptionist' since the enum doesn't have them
-- This is a safety net
update public.profiles set role = 'nurse' where role::text in ('operator', 'receptionist');
