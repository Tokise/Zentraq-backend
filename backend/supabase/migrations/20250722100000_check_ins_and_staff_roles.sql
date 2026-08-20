-- Check-ins queue (RFID kiosk → operator dashboard)
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.clinic_profiles(id) on delete set null,
  patient_name text not null,
  rfid_uid text,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_progress', 'completed', 'dismissed')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists check_ins_status_created_idx
  on public.check_ins (status, created_at desc);

alter table public.check_ins enable row level security;

-- Kiosk (anon) can insert check-ins
create policy "anon_insert_check_ins"
  on public.check_ins for insert
  to anon
  with check (status = 'waiting');

-- Authenticated staff can read and update check-ins
create policy "authenticated_select_check_ins"
  on public.check_ins for select
  to authenticated
  using (true);

create policy "authenticated_update_check_ins"
  on public.check_ins for update
  to authenticated
  using (true)
  with check (true);

-- Enable realtime for live dashboard updates
alter publication supabase_realtime add table public.check_ins;

grant select, insert, update on public.check_ins to anon, authenticated;

