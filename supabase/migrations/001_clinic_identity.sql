-- Clinic identity and dashboard tables

create table if not exists clinic_profiles (
  id uuid primary key default gen_random_uuid(),
  rfid_uid text unique,
  student_number text,
  employee_number text,
  first_name text not null,
  last_name text not null,
  email text,
  department text,
  course text,
  year_level text,
  position text,
  active_status boolean not null default true,
  clinic_photo_url text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinic_profiles_rfid_uid on clinic_profiles (rfid_uid);

create table if not exists identity_sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null,
  records_synced integer not null default 0,
  status text not null default 'completed',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references clinic_profiles (id) on delete cascade,
  patient_name text not null,
  chief_complaint text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references clinic_profiles (id) on delete cascade,
  patient_name text not null,
  appointment_time timestamptz not null,
  appointment_type text not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  current_stock integer not null default 0,
  minimum_stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid references medicines (id) on delete cascade,
  medicine_name text not null,
  current_stock integer not null,
  minimum_stock integer not null,
  severity text not null default 'warning',
  created_at timestamptz not null default now()
);

-- RLS
alter table clinic_profiles enable row level security;
alter table identity_sync_logs enable row level security;
alter table consultations enable row level security;
alter table appointments enable row level security;
alter table medicines enable row level security;
alter table inventory_alerts enable row level security;

-- Allow authenticated users full access (clinic staff)
create policy "clinic_profiles_select" on clinic_profiles for select to authenticated using (true);
create policy "clinic_profiles_insert" on clinic_profiles for insert to authenticated with check (true);
create policy "clinic_profiles_update" on clinic_profiles for update to authenticated using (true) with check (true);

create policy "identity_sync_logs_select" on identity_sync_logs for select to authenticated using (true);
create policy "consultations_select" on consultations for select to authenticated using (true);
create policy "appointments_select" on appointments for select to authenticated using (true);
create policy "medicines_select" on medicines for select to authenticated using (true);
create policy "inventory_alerts_select" on inventory_alerts for select to authenticated using (true);

-- Allow anon insert for RFID registration (clinic kiosk mode)
create policy "clinic_profiles_anon_insert" on clinic_profiles for insert to anon with check (true);
create policy "clinic_profiles_anon_select" on clinic_profiles for select to anon using (true);

-- Grant API access
grant select, insert, update on clinic_profiles to authenticated, anon;
grant select on identity_sync_logs, consultations, appointments, medicines, inventory_alerts to authenticated;
