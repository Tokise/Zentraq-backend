-- Deduplicate consultations table: remove duplicate records keeping only the latest entry
-- A duplicate is defined as records with the same patient_name, chief_complaint, and created_at date
-- The query keeps the most recent record (by created_at timestamp) for each duplicate group

with duplicates as (
  select id,
         row_number() over (
           partition by patient_name, chief_complaint, created_at::date
           order by created_at desc, handled_at desc nulls last
         ) as rn
  from public.consultations
)
delete from public.consultations
where id in (
  select id from duplicates where rn > 1
);

-- Optional: Verify no duplicates remain
-- select patient_name, chief_complaint, created_at::date, count(*)
-- from public.consultations
-- group by patient_name, chief_complaint, created_at::date
-- having count(*) > 1;