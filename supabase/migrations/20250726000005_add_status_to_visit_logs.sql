-- Add status column to visit_logs for tracking patient disposition
alter table public.visit_logs
  add column if not exists status text not null default 'completed'
  check (status in ('waiting', 'in_progress', 'emergency', 'completed', 'return_to_class', 'return_to_activity', 'sent_home'));

-- Backfill existing records with 'return_to_class' as default since they were completed consultations
update public.visit_logs
set status = 'return_to_class'
where status = 'completed';