-- Standardizes patient complaint naming and secures reusable visit reasons.
do $$
declare
  v_has_chief_complaint boolean;
  v_has_patient_complaint boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'consultations'
      and column_name = 'chief_complaint'
  ) into v_has_chief_complaint;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'consultations'
      and column_name = 'patient_complaint'
  ) into v_has_patient_complaint;

  if v_has_chief_complaint and v_has_patient_complaint then
    raise exception
      'consultations has both chief_complaint and patient_complaint';
  elsif v_has_chief_complaint then
    alter table public.consultations
      rename column chief_complaint to patient_complaint;
  elsif not v_has_patient_complaint then
    raise exception
      'consultations has neither chief_complaint nor patient_complaint';
  end if;
end;
$$;

-- Creates the reusable catalog when older environments skipped its migration.
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keeps the consultation summary view contract aligned across legacy labels.
do $$
declare
  v_has_chief_complaint boolean;
  v_has_student_complaint boolean;
  v_has_patient_complaint boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'v_consultation_summary'
      and column_name = 'chief_complaint'
  ) into v_has_chief_complaint;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'v_consultation_summary'
      and column_name = 'student_complaint'
  ) into v_has_student_complaint;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'v_consultation_summary'
      and column_name = 'patient_complaint'
  ) into v_has_patient_complaint;

  if v_has_patient_complaint
    and (v_has_chief_complaint or v_has_student_complaint) then
    raise exception
      'v_consultation_summary has patient_complaint and a legacy complaint column';
  elsif v_has_chief_complaint and v_has_student_complaint then
    raise exception
      'v_consultation_summary has both legacy complaint columns';
  elsif v_has_chief_complaint then
    alter view public.v_consultation_summary
      rename column chief_complaint to patient_complaint;
  elsif v_has_student_complaint then
    alter view public.v_consultation_summary
      rename column student_complaint to patient_complaint;
  end if;
end;
$$;

-- Removes duplicate catalog labels before enforcing normalized uniqueness.
with ranked_complaints as (
  select
    id,
    row_number() over (
      partition by lower(btrim(name))
      order by created_at, id
    ) as duplicate_number
  from public.complaints
)
delete from public.complaints
where id in (
  select id
  from ranked_complaints
  where duplicate_number > 1
);

create unique index if not exists complaints_name_normalized_unique
  on public.complaints ((lower(btrim(name))));

insert into public.complaints (name)
values
  ('General Checkup'),
  ('Fever'),
  ('Headache'),
  ('Cough / Colds'),
  ('Sore Throat'),
  ('Stomach Ache'),
  ('Injury / Cuts'),
  ('Skin Problem'),
  ('Eye Problem'),
  ('Allergic Reaction'),
  ('Dental')
on conflict do nothing;

alter table public.complaints enable row level security;

drop policy if exists "Allow read access to complaints"
  on public.complaints;
drop policy if exists "Allow insert access to complaints"
  on public.complaints;
drop policy if exists "Allow update access to complaints"
  on public.complaints;
drop policy if exists "Allow delete access to complaints"
  on public.complaints;

revoke all on table public.complaints
  from public, anon, authenticated, service_role;
grant select, insert on table public.complaints to service_role;

drop function if exists public.finalize_consultation_workflow(
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
);

-- Adds patient complaint persistence to the existing atomic final review.
create function public.finalize_consultation_workflow(
  p_consultation_id uuid,
  p_patient_complaint text,
  p_vitals_disposition text,
  p_vitals_skip_reason text,
  p_vitals jsonb,
  p_notes text,
  p_diagnosis jsonb,
  p_treatment jsonb,
  p_prescriptions jsonb,
  p_follow_up jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_complaint text := btrim(p_patient_complaint);
  v_status text;
begin
  if nullif(v_patient_complaint, '') is null then
    raise exception 'A patient complaint is required';
  end if;

  if char_length(v_patient_complaint) > 120 then
    raise exception 'The patient complaint is too long';
  end if;

  v_status := public.finalize_consultation_workflow(
    p_consultation_id,
    p_vitals_disposition,
    p_vitals_skip_reason,
    p_vitals,
    p_notes,
    p_diagnosis,
    p_treatment,
    p_prescriptions,
    p_follow_up
  );

  update public.consultations
  set
    patient_complaint = v_patient_complaint,
    updated_at = now()
  where id = p_consultation_id;

  if v_status = 'completed' then
    insert into public.complaints (name)
    values (v_patient_complaint)
    on conflict do nothing;
  end if;

  return v_status;
end;
$$;

revoke all on function public.finalize_consultation_workflow(
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, service_role;

grant execute on function public.finalize_consultation_workflow(
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to authenticated;
