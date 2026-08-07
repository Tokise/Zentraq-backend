-- ============================================
-- Complete Faculty Medical Tables
-- Adds missing immunizations and documents tables for faculty
-- ============================================

-- Faculty Immunizations
CREATE TABLE IF NOT EXISTS faculty_immunizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    vaccine_name TEXT NOT NULL,
    administered_date DATE,
    dose_number INTEGER,
    lot_number TEXT,
    administered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_immunizations_faculty_id 
    ON faculty_immunizations(faculty_id);

-- Faculty Documents
CREATE TABLE IF NOT EXISTS faculty_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_documents_faculty_id 
    ON faculty_documents(faculty_id);

-- Triggers for updated_at
CREATE TRIGGER set_faculty_immunizations_timestamp 
    BEFORE UPDATE ON faculty_immunizations 
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_faculty_documents_timestamp 
    BEFORE UPDATE ON faculty_documents 
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();