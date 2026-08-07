-- ============================================
-- Staff Medical Tables
-- Separate medical record tables for staff (general employees)
-- ============================================

-- Staff Medical History
CREATE TABLE IF NOT EXISTS staff_medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    condition_name TEXT NOT NULL,
    diagnosed_date DATE,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_medical_history_staff_id 
    ON staff_medical_history(staff_id);

-- Staff Allergies
CREATE TABLE IF NOT EXISTS staff_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_allergies_staff_id 
    ON staff_allergies(staff_id);

-- Staff Medications
CREATE TABLE IF NOT EXISTS staff_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    start_date DATE,
    end_date DATE,
    prescribed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_medications_staff_id 
    ON staff_medications(staff_id);

-- Staff Immunizations
CREATE TABLE IF NOT EXISTS staff_immunizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    vaccine_name TEXT NOT NULL,
    administered_date DATE,
    dose_number INTEGER,
    lot_number TEXT,
    administered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_immunizations_staff_id 
    ON staff_immunizations(staff_id);

-- Staff Documents
CREATE TABLE IF NOT EXISTS staff_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_id 
    ON staff_documents(staff_id);

-- Triggers for updated_at
CREATE TRIGGER set_staff_medical_history_timestamp 
    BEFORE UPDATE ON staff_medical_history 
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_staff_medications_timestamp 
    BEFORE UPDATE ON staff_medications 
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();