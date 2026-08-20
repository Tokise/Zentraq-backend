-- Update consultations status check constraint to use new status values
-- in_progress -> in_consultation
-- emergency -> in_emergency

-- Drop existing constraint
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

-- Update existing records to new status values
update public.consultations set status = 'in_consultation' where status = 'in_progress';
update public.consultations set status = 'in_emergency' where status = 'emergency';

-- Add new check constraint
alter table public.consultations
  add constraint consultations_status_check
  check (status in ('waiting', 'in_consultation', 'in_emergency', 'completed', 'dismissed'));