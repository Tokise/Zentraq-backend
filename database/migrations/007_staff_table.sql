-- ============================================
-- Staff Table
-- Separate table for general employees (non-faculty)
-- ============================================

CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    department TEXT,
    position TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    rfid_uid TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_rfid_uid ON staff(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_staff_employee_number ON staff(employee_number);

CREATE TRIGGER set_staff_timestamp BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();