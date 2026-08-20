-- Adds the selected complaint to the existing atomic consultation finalization.
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

create function public.finalize_consultation_workflow(
  p_consultation_id uuid,
  p_student_complaint text,
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
  v_status text;
begin
  if nullif(btrim(p_student_complaint), '') is null then
    raise exception 'A student complaint is required';
  end if;

  if char_length(btrim(p_student_complaint)) > 1000 then
    raise exception 'The student complaint is too long';
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
    chief_complaint = btrim(p_student_complaint),
    updated_at = now()
  where id = p_consultation_id;

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
