-- Adds staff as a first-class patient type without changing existing records.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE clinic_visits
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE health_clearances
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_patient_type_check;

ALTER TABLE clinic_visits
  DROP CONSTRAINT IF EXISTS clinic_visits_patient_type_check;

ALTER TABLE health_clearances
  DROP CONSTRAINT IF EXISTS health_clearances_requester_type_check;

DO $$
DECLARE
  target_table REGCLASS;
  constraint_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.appointments'::REGCLASS,
    'public.clinic_visits'::REGCLASS,
    'public.health_clearances'::REGCLASS
  ]
  LOOP
    FOR constraint_name IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = target_table
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%student_id%'
        AND pg_get_constraintdef(oid) ILIKE '%faculty_id%'
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target_table, constraint_name);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_patient_reference_check CHECK (
    (patient_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL AND staff_id IS NULL)
    OR (patient_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL AND staff_id IS NULL)
    OR (patient_type = 'staff' AND staff_id IS NOT NULL AND student_id IS NULL AND faculty_id IS NULL)
  );

ALTER TABLE clinic_visits
  ADD CONSTRAINT clinic_visits_patient_reference_check CHECK (
    (patient_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL AND staff_id IS NULL)
    OR (patient_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL AND staff_id IS NULL)
    OR (patient_type = 'staff' AND staff_id IS NOT NULL AND student_id IS NULL AND faculty_id IS NULL)
  );

ALTER TABLE health_clearances
  ADD CONSTRAINT health_clearances_requester_reference_check CHECK (
    (requester_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL AND staff_id IS NULL)
    OR (requester_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL AND staff_id IS NULL)
    OR (requester_type = 'staff' AND staff_id IS NOT NULL AND student_id IS NULL AND faculty_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_staff_id ON clinic_visits(staff_id);
CREATE INDEX IF NOT EXISTS idx_health_clearances_staff_id ON health_clearances(staff_id);

CREATE OR REPLACE VIEW v_appointment_overview AS
SELECT
  a.id,
  a.patient_type,
  COALESCE(s.first_name, f.first_name, st.first_name) AS patient_first_name,
  COALESCE(s.last_name, f.last_name, st.last_name) AS patient_last_name,
  a.scheduled_date,
  a.scheduled_time,
  a.priority,
  a.status,
  a.created_at,
  a.doctor_id,
  ca.display_name AS doctor_name
FROM appointments a
LEFT JOIN students s ON a.student_id = s.id
LEFT JOIN faculty f ON a.faculty_id = f.id
LEFT JOIN staff st ON a.staff_id = st.id
LEFT JOIN clinic_accounts ca ON a.doctor_id = ca.id;

CREATE OR REPLACE VIEW v_consultation_summary AS
SELECT
  c.id AS consultation_id,
  cv.id AS visit_id,
  cv.patient_type,
  COALESCE(s.student_number, f.employee_number, st.employee_number) AS patient_identifier,
  COALESCE(s.first_name, f.first_name, st.first_name) AS patient_first_name,
  COALESCE(s.last_name, f.last_name, st.last_name) AS patient_last_name,
  cv.check_in_time,
  c.chief_complaint,
  c.status AS consultation_status,
  ca.display_name AS doctor_name,
  c.created_at,
  COALESCE(s.id, f.id, st.id) AS patient_id
FROM consultations c
JOIN clinic_visits cv ON c.visit_id = cv.id
LEFT JOIN students s ON cv.student_id = s.id
LEFT JOIN faculty f ON cv.faculty_id = f.id
LEFT JOIN staff st ON cv.staff_id = st.id
LEFT JOIN clinic_accounts ca ON c.doctor_id = ca.id;
