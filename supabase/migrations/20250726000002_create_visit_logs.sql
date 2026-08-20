-- Create visit_logs table for deduplicated visit records
create table public.visit_logs (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete set null,
  patient_name text not null,
  chief_complaint text not null,
  origin text not null check (origin in ('consultation', 'emergency')),
  diagnosis text not null default '',
  treatment text not null default '',
  recommendations text not null default '',
  handled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.visit_logs enable row level security;

-- RLS policies
drop policy if exists "authenticated_select_visit_logs" on public.visit_logs;
drop policy if exists "authenticated_insert_visit_logs" on public.visit_logs;

create policy "authenticated_select_visit_logs"
  on public.visit_logs for select
  to authenticated
  using (true);

create policy "authenticated_insert_visit_logs"
  on public.visit_logs for insert
  to authenticated
  with check (true);

-- Enable realtime
alter publication supabase_realtime add table public.visit_logs;

-- Grant permissions
grant select, insert on public.visit_logs to anon, authenticated;

-- Migrate existing completed/dismissed/emergency consultations into visit_logs (deduplicated)
-- This grabs only the latest record per patient_name + chief_complaint (ignoring date)
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
from (
  select distinct on (patient_name, chief_complaint) *
  from public.consultations
  where status in ('completed', 'dismissed')
  order by patient_name, chief_complaint, created_at desc, handled_at desc nulls last
) c
where c.notes is not null and c.notes != ''
  and c.notes::jsonb ? 'diagnosis'
  and c.notes::jsonb ? 'treatment'
  and c.notes::jsonb ? 'recommendations'
on conflict (id) do nothing;
