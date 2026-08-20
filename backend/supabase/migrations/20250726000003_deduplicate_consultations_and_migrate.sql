-- STEP 1: Remove duplicate records from consultations table
-- Keeps only the latest record per patient_name + chief_complaint
with duplicates as (
  select id,
         row_number() over (
           partition by patient_name, chief_complaint
           order by created_at desc, handled_at desc nulls last
         ) as rn
  from public.consultations
)
delete from public.consultations
where id in (
  select id from duplicates where rn > 1
);

-- STEP 2: Now migrate the cleaned consultations into visit_logs
-- Only records with proper structured notes get inserted
insert into public.visit_logs (consultation_id, patient_name, chief_complaint, origin, diagnosis, treatment, recommendations, handled_at, created_at)
select
  c.id,
  c.patient_name,
  c.chief_complaint,
  coalesce(c.origin, 'consultation'),
  coalesce((c.notes::json)->>'diagnosis', ''),
  coalesce((c.notes::json)->>'treatment', ''),
  coalesce((c.notes::json)->>'recommendations', ''),
  coalesce(c.handled_at, c.created_at),
  c.created_at
from public.consultations c
where c.status in ('completed', 'dismissed')
  and c.notes is not null and c.notes != ''
  and c.notes::jsonb ? 'diagnosis'
  and c.notes::jsonb ? 'treatment'
  and c.notes::jsonb ? 'recommendations';

-- STEP 3: Verify no duplicates remain in consultations
-- Run this to check: should return 0 rows
-- select patient_name, chief_complaint, count(*)
-- from public.consultations
-- group by patient_name, chief_complaint
-- having count(*) > 1;

-- STEP 4: Verify no duplicates remain in visit_logs
-- Run this to check: should return 0 rows
-- select patient_name, chief_complaint, count(*)
-- from public.visit_logs
-- group by patient_name, chief_complaint
-- having count(*) > 1;