-- Adds auditable vitals decisions and atomic lifecycle transitions for consultations.
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS vitals_disposition TEXT NOT NULL DEFAULT 'not_assessed'
    CHECK (vitals_disposition IN ('not_assessed', 'required', 'not_required', 'recorded')),
  ADD COLUMN IF NOT EXISTS vitals_skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS vitals_assessed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS vitals_assessed_at TIMESTAMPTZ;

ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_vitals_decision_check CHECK (
    (vitals_disposition <> 'not_required' OR vitals_skip_reason IS NOT NULL)
    AND (vitals_disposition = 'not_required' OR vitals_skip_reason IS NULL)
  );

CREATE INDEX IF NOT EXISTS consultations_workspace_status_idx
  ON public.consultations (status, updated_at DESC);

-- Claims one waiting queue entry so concurrent clinical operators cannot both begin it.
CREATE OR REPLACE FUNCTION public.claim_consultation(p_consultation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_visit_id UUID;
  v_queue_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_actor_id
      AND r.name IN ('admin', 'nurse', 'doctor')
  ) THEN
    RAISE EXCEPTION 'Clinical operator authorization is required';
  END IF;

  SELECT c.visit_id
  INTO v_visit_id
  FROM public.consultations c
  WHERE c.id = p_consultation_id
    AND c.status = 'queued'
  FOR UPDATE;

  IF v_visit_id IS NULL THEN
    RAISE EXCEPTION 'This consultation is no longer available to claim';
  END IF;

  UPDATE public.clinic_queue_entries q
  SET
    status = 'claimed',
    claimed_by = v_actor_id,
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE q.visit_id = v_visit_id
    AND q.status = 'waiting'
  RETURNING q.id INTO v_queue_id;

  IF v_queue_id IS NULL THEN
    RAISE EXCEPTION 'This patient is already being handled';
  END IF;

  UPDATE public.consultations
  SET status = 'in-progress', updated_at = NOW()
  WHERE id = p_consultation_id;

  UPDATE public.clinic_visits
  SET status = 'in-progress', updated_at = NOW()
  WHERE id = v_visit_id;

  RETURN v_queue_id;
END;
$$;

-- Completes a consultation only after the required clinical documentation exists.
CREATE OR REPLACE FUNCTION public.complete_consultation(p_consultation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_visit_id UUID;
  v_vitals_disposition TEXT;
  v_vitals_skip_reason TEXT;
  v_notes TEXT;
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_actor_id
      AND r.name IN ('admin', 'nurse', 'doctor')
  ) THEN
    RAISE EXCEPTION 'Clinical operator authorization is required';
  END IF;

  SELECT c.visit_id, c.vitals_disposition, c.vitals_skip_reason, c.consultation_notes
  INTO v_visit_id, v_vitals_disposition, v_vitals_skip_reason, v_notes
  FROM public.consultations c
  WHERE c.id = p_consultation_id
    AND c.status = 'in-progress'
  FOR UPDATE;

  IF v_visit_id IS NULL THEN
    RAISE EXCEPTION 'Only active consultations can be completed';
  END IF;

  IF NULLIF(BTRIM(v_notes), '') IS NULL THEN
    RAISE EXCEPTION 'A consultation outcome note is required';
  END IF;

  IF v_vitals_disposition = 'required' OR v_vitals_disposition = 'not_assessed' THEN
    RAISE EXCEPTION 'Record vital signs or document why they are not needed';
  END IF;

  IF v_vitals_disposition = 'not_required'
    AND NULLIF(BTRIM(v_vitals_skip_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required when vital signs are not needed';
  END IF;

  UPDATE public.consultations
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_consultation_id;

  UPDATE public.clinic_queue_entries
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE visit_id = v_visit_id
    AND status = 'claimed';

  UPDATE public.clinic_visits
  SET status = 'completed', check_out_time = NOW(), updated_at = NOW()
  WHERE id = v_visit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_consultation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_consultation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_consultation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_consultation(UUID) TO authenticated;
