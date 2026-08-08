-- Adds first-class profile photos and safe clinician scheduling primitives.
-- Existing faculty rows are intentionally left untouched; only new registrations
-- are routed to the staff table by the application layer.

ALTER TABLE faculty
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('faculty-documents', 'faculty-documents', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Date-specific blocks override recurring availability for a clinician.
CREATE TABLE IF NOT EXISTS clinician_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id UUID NOT NULL REFERENCES clinic_accounts(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clinician_schedule_blocks_time_check CHECK (end_time > start_time),
  CONSTRAINT clinician_schedule_blocks_unique UNIQUE (
    clinic_account_id,
    blocked_date,
    start_time,
    end_time
  )
);

CREATE INDEX IF NOT EXISTS idx_clinician_schedule_blocks_lookup
  ON clinician_schedule_blocks (clinic_account_id, blocked_date);

ALTER TABLE clinician_schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_staff_manage_schedule_blocks"
  ON clinician_schedule_blocks
  FOR ALL
  TO authenticated
  USING (is_clinic_staff())
  WITH CHECK (is_clinic_staff());

-- A clinician cannot have two active patients in the same appointment slot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_clinician_slot
  ON appointments (doctor_id, scheduled_date, scheduled_time)
  WHERE doctor_id IS NOT NULL
    AND scheduled_date IS NOT NULL
    AND scheduled_time IS NOT NULL
    AND status IN (
      'scheduled',
      'reminded',
      'checked_in',
      'in_consultation'
    );

-- Supplies only the patient identity fields needed by clinic RFID interfaces.
CREATE OR REPLACE VIEW v_rfid_patient_profiles WITH (security_invoker = true) AS
SELECT
  'student'::TEXT AS patient_type,
  id AS patient_id,
  rfid_uid,
  first_name,
  last_name,
  student_number AS identifier,
  department,
  profile_photo_url
FROM students
UNION ALL
SELECT
  'faculty'::TEXT AS patient_type,
  id AS patient_id,
  rfid_uid,
  first_name,
  last_name,
  employee_number AS identifier,
  department,
  profile_photo_url
FROM faculty
UNION ALL
SELECT
  'staff'::TEXT AS patient_type,
  id AS patient_id,
  rfid_uid,
  first_name,
  last_name,
  employee_number AS identifier,
  department,
  profile_photo_url
FROM staff;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
