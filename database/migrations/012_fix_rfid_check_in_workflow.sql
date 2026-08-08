-- Defines the RFID queue and its atomic scan workflow. Queue states are kept
-- separate from the consultation workflow states.

CREATE TABLE IF NOT EXISTS public.clinic_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.clinic_visits(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'claimed')),
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_queue_entries_active_visit
  ON public.clinic_queue_entries (visit_id, status);

ALTER TABLE public.clinic_queue_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_clinic_queue_entries_timestamp'
      AND tgrelid = 'public.clinic_queue_entries'::REGCLASS
  ) THEN
    CREATE TRIGGER set_clinic_queue_entries_timestamp
      BEFORE UPDATE ON public.clinic_queue_entries
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
END;
$$;

-- Validates the caller, reuses an open queue item, or creates a new visit.
CREATE OR REPLACE FUNCTION public.check_in_rfid(p_rfid_uid TEXT)
RETURNS TABLE (
  queue_entry_id UUID,
  consultation_id UUID,
  patient_type TEXT,
  patient_id UUID,
  first_name TEXT,
  last_name TEXT,
  clinic_photo_url TEXT,
  created_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_patient_type TEXT;
  v_patient_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_clinic_photo_url TEXT;
  v_visit_id UUID;
  v_queue_entry_id UUID;
  v_consultation_id UUID;
BEGIN
  IF COALESCE(BTRIM(p_rfid_uid), '') = '' THEN
    RAISE EXCEPTION 'RFID UID is required';
  END IF;

  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles user_role
    JOIN public.roles role ON role.id = user_role.role_id
    WHERE user_role.user_id = v_actor_id
      AND role.name IN ('admin', 'doctor', 'nurse')
  ) THEN
    RAISE EXCEPTION 'Only clinical staff may check in RFID patients';
  END IF;

  SELECT profile.patient_type,
         profile.patient_id,
         profile.first_name,
         profile.last_name,
         profile.profile_photo_url
  INTO v_patient_type,
       v_patient_id,
       v_first_name,
       v_last_name,
       v_clinic_photo_url
  FROM public.v_rfid_patient_profiles profile
  WHERE profile.rfid_uid = BTRIM(p_rfid_uid)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFID profile was not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_patient_type || ':' || v_patient_id::TEXT));

  SELECT queue.id, consultation.id
  INTO v_queue_entry_id, v_consultation_id
  FROM public.clinic_queue_entries queue
  JOIN public.clinic_visits visit ON visit.id = queue.visit_id
  JOIN public.consultations consultation ON consultation.visit_id = visit.id
  WHERE visit.patient_type = v_patient_type
    AND (
      (v_patient_type = 'student' AND visit.student_id = v_patient_id)
      OR (v_patient_type = 'faculty' AND visit.faculty_id = v_patient_id)
      OR (v_patient_type = 'staff' AND visit.staff_id = v_patient_id)
    )
    AND queue.status IN ('waiting', 'claimed')
    AND consultation.status IN ('in-progress', 'awaiting_doctor_review')
  ORDER BY queue.created_at DESC
  LIMIT 1
  FOR UPDATE OF queue, consultation;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_queue_entry_id,
      v_consultation_id,
      v_patient_type,
      v_patient_id,
      v_first_name,
      v_last_name,
      v_clinic_photo_url,
      FALSE;
    RETURN;
  END IF;

  INSERT INTO public.clinic_visits (
    patient_type,
    student_id,
    faculty_id,
    staff_id,
    visit_type,
    status,
    created_by
  )
  VALUES (
    v_patient_type,
    CASE WHEN v_patient_type = 'student' THEN v_patient_id END,
    CASE WHEN v_patient_type = 'faculty' THEN v_patient_id END,
    CASE WHEN v_patient_type = 'staff' THEN v_patient_id END,
    'rfid',
    'in-progress',
    v_actor_id
  )
  RETURNING id INTO v_visit_id;

  INSERT INTO public.consultations (visit_id, status)
  VALUES (v_visit_id, 'in-progress')
  RETURNING id INTO v_consultation_id;

  INSERT INTO public.clinic_queue_entries (visit_id, status, priority)
  VALUES (v_visit_id, 'waiting', 0)
  RETURNING id INTO v_queue_entry_id;

  RETURN QUERY SELECT
    v_queue_entry_id,
    v_consultation_id,
    v_patient_type,
    v_patient_id,
    v_first_name,
    v_last_name,
    v_clinic_photo_url,
    TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_rfid(TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.check_in_rfid(TEXT) TO authenticated;
