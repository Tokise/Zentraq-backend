-- Clear existing visit_logs to start fresh
truncate table public.visit_logs;

-- Insert only the latest completed record per patient (deduplicated)
insert into public.visit_logs (consultation_id, patient_name, chief_complaint, origin, diagnosis, treatment, recommendations, handled_at, created_at)
select distinct on (c.patient_name)
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
  and c.notes::jsonb ? 'recommendations'
order by c.patient_name, c.created_at desc;