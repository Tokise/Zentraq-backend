-- ============================================
-- Staff Availability Table
-- Tracks when each doctor/nurse is available for appointments
-- ============================================

CREATE TABLE IF NOT EXISTS staff_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_account_id UUID NOT NULL REFERENCES clinic_accounts(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT staff_availability_unique UNIQUE (clinic_account_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_clinic_account 
    ON staff_availability(clinic_account_id);

CREATE TRIGGER set_staff_availability_timestamp 
    BEFORE UPDATE ON staff_availability 
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();