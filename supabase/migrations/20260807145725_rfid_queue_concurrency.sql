-- Adds a queue owned exclusively by clinical operators.
CREATE TABLE public.clinic_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL UNIQUE REFERENCES public.clinic_visits(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'claimed', 'completed', 'cancelled')),
  priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 2),
  priority_reason TEXT,
  prioritized_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  prioritized_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (priority = 0 AND priority_reason IS NULL AND prioritized_by IS NULL)
    OR (priority > 0 AND priority_reason IS NOT NULL AND prioritized_by IS NOT NULL)
  )
);

ALTER TABLE public.consultations
  DROP CONSTRAINT consultations_status_check,
  ADD CONSTRAINT consultations_status_check
    CHECK (status IN ('queued', 'in-progress', 'completed'));

CREATE UNIQUE INDEX clinic_visits_one_active_student_idx
  ON public.clinic_visits(student_id)
  WHERE student_id IS NOT NULL AND status = 'waiting';

CREATE UNIQUE INDEX clinic_visits_one_active_faculty_idx
  ON public.clinic_visits(faculty_id)
  WHERE faculty_id IS NOT NULL AND status = 'waiting';

CREATE INDEX clinic_queue_entries_worklist_idx
  ON public.clinic_queue_entries(status, priority DESC, created_at ASC);

ALTER TABLE public.clinic_queue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical operators manage queue entries"
  ON public.clinic_queue_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN ('admin', 'nurse', 'doctor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN ('admin', 'nurse', 'doctor')
    )
  );

-- Creates at most one waiting check-in for a patient inside one transaction.
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
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_patient_type TEXT;
  v_patient_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_photo_url TEXT;
  v_visit_id UUID;
  v_queue_entry_id UUID;
  v_consultation_id UUID;
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

  IF p_rfid_uid IS NULL OR length(trim(p_rfid_uid)) NOT BETWEEN 4 AND 64 THEN
    RAISE EXCEPTION 'Invalid RFID UID format';
  END IF;

  SELECT 'student', s.id, s.first_name, s.last_name, s.profile_photo_url
  INTO v_patient_type, v_patient_id, v_first_name, v_last_name, v_photo_url
  FROM public.students s
  WHERE s.rfid_uid = trim(p_rfid_uid) AND s.status = 'active';

  IF v_patient_id IS NULL THEN
    SELECT 'faculty', f.id, f.first_name, f.last_name, NULL::TEXT
    INTO v_patient_type, v_patient_id, v_first_name, v_last_name, v_photo_url
    FROM public.faculty f
    WHERE f.rfid_uid = trim(p_rfid_uid) AND f.status = 'active';
  END IF;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'RFID card is not registered to an active patient';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_patient_type || ':' || v_patient_id::TEXT, 0)
  );

  SELECT cv.id, q.id, c.id
  INTO v_visit_id, v_queue_entry_id, v_consultation_id
  FROM public.clinic_visits cv
  JOIN public.clinic_queue_entries q ON q.visit_id = cv.id
  JOIN public.consultations c ON c.visit_id = cv.id
  WHERE (
    (v_patient_type = 'student' AND cv.student_id = v_patient_id)
    OR (v_patient_type = 'faculty' AND cv.faculty_id = v_patient_id)
  )
    AND cv.status IN ('waiting', 'in-progress')
    AND q.status IN ('waiting', 'claimed')
  ORDER BY cv.check_in_time ASC
  LIMIT 1;

  IF v_visit_id IS NOT NULL THEN
    RETURN QUERY SELECT v_queue_entry_id, v_consultation_id, v_patient_type,
      v_patient_id, v_first_name, v_last_name, v_photo_url, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.clinic_visits (
    patient_type,
    student_id,
    faculty_id,
    visit_type,
    status,
    created_by
  ) VALUES (
    v_patient_type,
    CASE WHEN v_patient_type = 'student' THEN v_patient_id END,
    CASE WHEN v_patient_type = 'faculty' THEN v_patient_id END,
    'rfid',
    'waiting',
    v_actor_id
  ) RETURNING id INTO v_visit_id;

  INSERT INTO public.consultations (visit_id, status)
  VALUES (v_visit_id, 'queued')
  RETURNING id INTO v_consultation_id;

  INSERT INTO public.clinic_queue_entries (visit_id)
  VALUES (v_visit_id)
  RETURNING id INTO v_queue_entry_id;

  RETURN QUERY SELECT v_queue_entry_id, v_consultation_id, v_patient_type,
    v_patient_id, v_first_name, v_last_name, v_photo_url, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_rfid(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_rfid(TEXT) TO authenticated;
