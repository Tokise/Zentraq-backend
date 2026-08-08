-- Makes the consultation review step the only persistent clinical write.

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS vitals_disposition TEXT NOT NULL DEFAULT 'not_assessed',
  ADD COLUMN IF NOT EXISTS vitals_skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS vitals_assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vitals_assessed_at TIMESTAMPTZ;

ALTER TABLE consultations
  DROP CONSTRAINT IF EXISTS consultations_status_check;

ALTER TABLE consultations
  ADD CONSTRAINT consultations_status_check CHECK (
    status IN ('in-progress', 'awaiting_doctor_review', 'completed')
  );

CREATE INDEX IF NOT EXISTS idx_consultations_active_assignment
  ON consultations (doctor_id, nurse_id, status)
  WHERE status IN ('in-progress', 'awaiting_doctor_review');

-- Persists one validated review atomically. Only the server service role can invoke
-- this RPC; the server action derives the actor from the active session.
CREATE OR REPLACE FUNCTION public.finalize_consultation_workflow(
  p_consultation_id UUID,
  p_actor_id UUID,
  p_actor_role TEXT,
  p_vitals_disposition TEXT,
  p_vitals_skip_reason TEXT,
  p_vitals JSONB,
  p_notes TEXT,
  p_diagnosis JSONB,
  p_prescriptions JSONB,
  p_follow_up JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account clinic_accounts%ROWTYPE;
  v_consultation consultations%ROWTYPE;
  v_review_doctor_id UUID;
  v_prescription JSONB;
  v_vitals JSONB := COALESCE(p_vitals, '{}'::JSONB);
BEGIN
  IF p_actor_role NOT IN ('doctor', 'nurse') THEN
    RAISE EXCEPTION 'Only clinical staff may submit a consultation review';
  END IF;

  SELECT *
  INTO v_account
  FROM clinic_accounts
  WHERE user_id = p_actor_id
    AND role = p_actor_role
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active clinic account not found';
  END IF;

  SELECT *
  INTO v_consultation
  FROM consultations
  WHERE id = p_consultation_id
  FOR UPDATE;

  IF NOT FOUND OR v_consultation.status = 'completed' THEN
    RAISE EXCEPTION 'Consultation is not available for review';
  END IF;

  IF p_vitals_disposition NOT IN ('required', 'not_required') THEN
    RAISE EXCEPTION 'Choose whether vital signs are required';
  END IF;

  IF p_vitals_disposition = 'not_required'
    AND COALESCE(BTRIM(p_vitals_skip_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when vital signs are not needed';
  END IF;

  IF p_vitals_disposition = 'required'
    AND v_vitals = '{}'::JSONB THEN
    RAISE EXCEPTION 'Record at least one vital sign';
  END IF;

  IF p_actor_role = 'nurse' THEN
    IF COALESCE(jsonb_array_length(p_prescriptions), 0) > 0
      OR p_diagnosis IS NOT NULL
      OR p_follow_up IS NOT NULL THEN
      RAISE EXCEPTION 'Only doctors may add diagnoses, prescriptions, or follow-ups';
    END IF;

    IF v_consultation.nurse_id IS NOT NULL
      AND v_consultation.nurse_id <> v_account.id
      AND v_consultation.doctor_id <> v_account.id THEN
      RAISE EXCEPTION 'This consultation is assigned to another clinician';
    END IF;

    SELECT id
    INTO v_review_doctor_id
    FROM clinic_accounts
    WHERE id = v_consultation.doctor_id
      AND role = 'doctor'
      AND is_active = TRUE;

    IF v_review_doctor_id IS NULL THEN
      SELECT id
      INTO v_review_doctor_id
      FROM clinic_accounts
      WHERE role = 'doctor'
        AND is_active = TRUE
      ORDER BY display_name ASC
      LIMIT 1;
    END IF;

    IF v_review_doctor_id IS NULL THEN
      RAISE EXCEPTION 'A doctor must be active before this consultation can be submitted for review';
    END IF;
  ELSE
    IF v_consultation.doctor_id IS NOT NULL
      AND v_consultation.doctor_id <> v_account.id
      AND v_consultation.status <> 'awaiting_doctor_review' THEN
      RAISE EXCEPTION 'This consultation is assigned to another clinician';
    END IF;
  END IF;

  UPDATE consultations
  SET consultation_notes = NULLIF(BTRIM(p_notes), ''),
      vitals_disposition = p_vitals_disposition,
      vitals_skip_reason = CASE
        WHEN p_vitals_disposition = 'not_required'
          THEN NULLIF(BTRIM(p_vitals_skip_reason), '')
        ELSE NULL
      END,
      vitals_assessed_by = p_actor_id,
      vitals_assessed_at = NOW(),
      nurse_id = CASE
        WHEN p_actor_role = 'nurse' THEN v_account.id
        ELSE nurse_id
      END,
      doctor_id = CASE
        WHEN p_actor_role = 'doctor' THEN v_account.id
        ELSE v_review_doctor_id
      END,
      status = CASE
        WHEN p_actor_role = 'doctor' THEN 'completed'
        ELSE 'awaiting_doctor_review'
      END,
      completed_at = CASE
        WHEN p_actor_role = 'doctor' THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = p_consultation_id;

  IF p_vitals_disposition = 'required' THEN
    INSERT INTO triage_assessments (
      consultation_id,
      nurse_id,
      temperature,
      blood_pressure,
      heart_rate,
      respiratory_rate,
      oxygen_saturation
    )
    VALUES (
      p_consultation_id,
      v_account.id,
      NULLIF(v_vitals->>'temperature', '')::NUMERIC,
      NULLIF(v_vitals->>'blood_pressure', ''),
      NULLIF(v_vitals->>'heart_rate', '')::INTEGER,
      NULLIF(v_vitals->>'respiratory_rate', '')::INTEGER,
      NULLIF(v_vitals->>'oxygen_saturation', '')::INTEGER
    );
  END IF;

  IF p_actor_role = 'doctor' THEN
    IF p_diagnosis IS NOT NULL
      AND COALESCE(BTRIM(p_diagnosis->>'description'), '') <> '' THEN
      INSERT INTO diagnoses (
        consultation_id,
        icd10_code,
        description,
        is_primary,
        created_by
      )
      VALUES (
        p_consultation_id,
        NULLIF(BTRIM(p_diagnosis->>'icd10_code'), ''),
        BTRIM(p_diagnosis->>'description'),
        COALESCE((p_diagnosis->>'is_primary')::BOOLEAN, TRUE),
        p_actor_id
      );
    END IF;

    IF p_follow_up IS NOT NULL
      AND COALESCE(BTRIM(p_follow_up->>'scheduled_date'), '') <> '' THEN
      INSERT INTO follow_ups (consultation_id, scheduled_date, reason)
      VALUES (
        p_consultation_id,
        (p_follow_up->>'scheduled_date')::DATE,
        NULLIF(BTRIM(p_follow_up->>'reason'), '')
      );
    END IF;

    FOR v_prescription IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_prescriptions, '[]'::JSONB))
    LOOP
      INSERT INTO prescriptions (
        consultation_id,
        medicine_id,
        dosage,
        frequency,
        duration_days,
        quantity,
        instructions,
        prescribed_by,
        status
      )
      VALUES (
        p_consultation_id,
        (v_prescription->>'medicine_id')::UUID,
        NULLIF(BTRIM(v_prescription->>'dosage'), ''),
        NULLIF(BTRIM(v_prescription->>'frequency'), ''),
        NULLIF(v_prescription->>'duration_days', '')::INTEGER,
        NULLIF(v_prescription->>'quantity', '')::INTEGER,
        NULLIF(BTRIM(v_prescription->>'instructions'), ''),
        p_actor_id,
        'pending'
      );
    END LOOP;
  END IF;

  RETURN CASE
    WHEN p_actor_role = 'doctor' THEN 'completed'
    ELSE 'awaiting_doctor_review'
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_consultation_workflow(
  UUID, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_consultation_workflow(
  UUID, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, JSONB
) TO service_role;
