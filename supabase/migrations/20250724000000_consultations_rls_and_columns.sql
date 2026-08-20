-- Add missing columns to consultations table (handled_at, notes, handled_by)
alter table public.consultations
  add column if not exists handled_at timestamptz,
  add column if not exists notes text,
  add column if not exists handled_by uuid references auth.users(id) on delete set null;

-- Migrate existing rows: old 'active' status → 'waiting'
update public.consultations set status = 'waiting' where status = 'active';
update public.consultations set status = 'waiting' where status is null or status = '';

-- Add status check constraint
-- The original migration had default 'active' but the app uses 'waiting', 'in_progress', 'completed', 'dismissed', 'emergency'
-- We need to update the default and add a proper check constraint
alter table public.consultations
  alter column status set default 'waiting';

-- Drop existing constraint if it exists and recreate
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'consultations_status_check'
    and table_name = 'consultations'
  ) then
    alter table public.consultations drop constraint consultations_status_check;
  end if;
end $$;

alter table public.consultations
  add constraint consultations_status_check
  check (status in ('waiting', 'in_progress', 'completed', 'dismissed', 'emergency'));

-- Enable RLS on consultations table
alter table public.consultations enable row level security;

-- Drop existing policies if they exist
drop policy if exists "authenticated_select_consultations" on public.consultations;
drop policy if exists "authenticated_insert_consultations" on public.consultations;
drop policy if exists "authenticated_update_consultations" on public.consultations;
drop policy if exists "anon_insert_consultations" on public.consultations;

-- Authenticated users can read all consultations
create policy "authenticated_select_consultations"
  on public.consultations for select
  to authenticated
  using (true);

-- Authenticated users can insert consultations
create policy "authenticated_insert_consultations"
  on public.consultations for insert
  to authenticated
  with check (true);

-- Authenticated users can update consultations
create policy "authenticated_update_consultations"
  on public.consultations for update
  to authenticated
  using (true)
  with check (true);

-- Anon (kiosk) can insert consultations with status 'waiting'
create policy "anon_insert_consultations"
  on public.consultations for insert
  to anon
  with check (status = 'waiting');

-- Enable realtime for consultations table
alter publication supabase_realtime add table public.consultations;

-- Grant permissions
grant select, insert, update on public.consultations to anon, authenticated;