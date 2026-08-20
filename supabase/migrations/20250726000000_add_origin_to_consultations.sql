-- Add origin column to consultations table
alter table public.consultations
  add column if not exists origin text;

-- Backfill existing records
-- Records with status 'emergency' get origin 'emergency', all others get 'consultation'
update public.consultations set origin = 'emergency' where status = 'emergency' and origin is null;
update public.consultations set origin = 'consultation' where origin is null;

-- Add check constraint for origin
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'consultations_origin_check'
    and table_name = 'consultations'
  ) then
    alter table public.consultations drop constraint consultations_origin_check;
  end if;
end $$;

alter table public.consultations
  add constraint consultations_origin_check
  check (origin in ('consultation', 'emergency'));

-- Remove duplicate rows keeping the earliest created_at for each unique combination
-- First, identify duplicates by patient_name + chief_complaint + status + created_at::date
delete from public.consultations
where id in (
  select id
  from (
    select id,
           row_number() over (
             partition by patient_name, chief_complaint, status, date(created_at)
             order by created_at asc
           ) as rn
    from public.consultations
  ) t
  where t.rn > 1
);

-- Set not-null after backfill
alter table public.consultations
  alter column origin set not null;

-- Set default for new rows
alter table public.consultations
  alter column origin set default 'consultation';