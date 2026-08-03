-- ============================================
-- ZenTraq Database Schema - Initial Migration
-- Based on SAD §11 Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE AUTH TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT
);

-- User-Role assignments
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- Role-Permission mappings
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================
-- PATIENT TABLES
-- ============================================

-- Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    department TEXT,
    course TEXT,
    year_level INTEGER,
    section TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    birth_date DATE,
    gender TEXT,
    blood_type TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    rfid_uid TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    profile_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Medical History
CREATE TABLE student_medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    condition_name TEXT NOT NULL,
    diagnosed_date DATE,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Allergies
CREATE TABLE student_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Medications
CREATE TABLE student_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
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

-- Student Immunizations
CREATE TABLE student_immunizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    vaccine_name TEXT NOT NULL,
    administered_date DATE,
    dose_number INTEGER,
    lot_number TEXT,
    administered_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Documents
CREATE TABLE student_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty
CREATE TABLE faculty (
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

-- Faculty Medical History
CREATE TABLE faculty_medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    condition_name TEXT NOT NULL,
    diagnosed_date DATE,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty Allergies
CREATE TABLE faculty_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty Medications
CREATE TABLE faculty_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
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

-- Clinic Accounts (Admin, Doctor, Nurse)
CREATE TABLE clinic_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'nurse')),
    display_name TEXT NOT NULL,
    license_number TEXT,
    current_session_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLINIC VISITS & CONSULTATIONS
-- ============================================

-- Clinic Visits
CREATE TABLE clinic_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_type TEXT NOT NULL CHECK (patient_type IN ('student', 'faculty')),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    visit_type TEXT NOT NULL CHECK (visit_type IN ('walk-in', 'appointment', 'rfid')),
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    status TEXT DEFAULT 'in-progress',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (patient_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL) OR
        (patient_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL)
    )
);

-- Consultations
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES clinic_visits(id) ON DELETE CASCADE,
    appointment_id UUID,
    doctor_id UUID REFERENCES clinic_accounts(id) ON DELETE SET NULL,
    nurse_id UUID REFERENCES clinic_accounts(id) ON DELETE SET NULL,
    chief_complaint TEXT,
    consultation_notes TEXT,
    status TEXT DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triage Assessments
CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    nurse_id UUID REFERENCES clinic_accounts(id) ON DELETE SET NULL,
    temperature NUMERIC,
    blood_pressure TEXT,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    weight NUMERIC,
    height NUMERIC,
    symptoms TEXT,
    triage_level TEXT CHECK (triage_level IN ('red', 'yellow', 'green')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagnoses
CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    icd10_code TEXT,
    description TEXT,
    is_primary BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treatments
CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    treatment_plan TEXT,
    instructions TEXT,
    follow_up_days INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-ups
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHARMACY / MEDICINE INVENTORY
-- ============================================

-- Medicines Catalog
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generic_name TEXT NOT NULL,
    brand_name TEXT,
    category TEXT,
    unit TEXT NOT NULL,
    min_stock_level INTEGER DEFAULT 10,
    is_controlled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine Stock
CREATE TABLE medicine_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    batch_number TEXT,
    expiry_date DATE,
    location TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine Batches
-- Suppliers must exist before batches because each batch may reference one.
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE medicine_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    expiry_date DATE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    received_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescriptions
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    dosage TEXT,
    frequency TEXT,
    duration_days INTEGER,
    quantity INTEGER,
    instructions TEXT,
    prescribed_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispensing Logs
CREATE TABLE dispensing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_stock_id UUID NOT NULL REFERENCES medicine_stock(id) ON DELETE RESTRICT,
    dispensed_by UUID REFERENCES users(id),
    quantity INTEGER NOT NULL,
    dispensed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restock Requests
CREATE TABLE restock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    requested_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
    approved_by UUID REFERENCES users(id),
    supplier_id UUID REFERENCES suppliers(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS
-- ============================================

-- Appointments
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_type TEXT NOT NULL CHECK (patient_type IN ('student', 'faculty')),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES clinic_accounts(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    symptoms TEXT,
    priority INTEGER,
    scheduled_date DATE,
    scheduled_time TIME,
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'ai_evaluated', 'recommended', 'approved', 'rejected',
        'scheduled', 'reminded', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (patient_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL) OR
        (patient_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL)
    )
);

ALTER TABLE consultations
    ADD CONSTRAINT consultations_appointment_id_fkey
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- Appointment AI Evaluations
CREATE TABLE appointment_ai_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    priority_score INTEGER,
    recommended_slot TEXT,
    rationale TEXT,
    ai_log_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment Reminders
CREATE TABLE appointment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    remind_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment Check-ins
CREATE TABLE appointment_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    rfid_uid TEXT,
    check_in_time TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INCIDENTS
-- ============================================

-- Incidents
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_type TEXT NOT NULL CHECK (patient_type IN ('student', 'faculty')),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('injury', 'illness', 'emergency')),
    description TEXT NOT NULL,
    location TEXT,
    severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe', 'critical')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'closed')),
    reported_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (patient_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL) OR
        (patient_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL)
    )
);

-- Incident Responses
CREATE TABLE incident_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    responder_id UUID REFERENCES users(id),
    response_time TIMESTAMPTZ DEFAULT NOW()
);

-- Incident Follow-ups
CREATE TABLE incident_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    follow_up_date DATE,
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HEALTH CLEARANCES
-- ============================================

-- Health Clearances
CREATE TABLE health_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_type TEXT NOT NULL CHECK (requester_type IN ('student', 'faculty')),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    purpose TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'evaluating', 'approved', 'rejected')),
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (requester_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL) OR
        (requester_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL)
    )
);

-- Clearance Requests
CREATE TABLE clearance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES health_clearances(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id),
    request_details TEXT,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'evaluated', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clearance Evaluations
CREATE TABLE clearance_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES health_clearances(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES clinic_accounts(id) ON DELETE SET NULL,
    result TEXT NOT NULL CHECK (result IN ('fit', 'unfit', 'conditional')),
    medical_notes TEXT,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clearance Certificates
CREATE TABLE clearance_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES health_clearances(id) ON DELETE CASCADE,
    certificate_number TEXT UNIQUE NOT NULL,
    issued_by UUID REFERENCES users(id),
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HEALTH PROGRAMS
-- ============================================

-- Health Programs
CREATE TABLE health_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    program_type TEXT NOT NULL CHECK (program_type IN ('immunization', 'screening', 'wellness')),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    managed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Program Participants
CREATE TABLE program_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES health_programs(id) ON DELETE CASCADE,
    patient_type TEXT NOT NULL CHECK (patient_type IN ('student', 'faculty')),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (patient_type = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL) OR
        (patient_type = 'faculty' AND faculty_id IS NOT NULL AND student_id IS NULL)
    )
);

-- Program Screenings
CREATE TABLE program_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES program_participants(id) ON DELETE CASCADE,
    screening_type TEXT NOT NULL,
    result TEXT,
    performed_by UUID REFERENCES users(id),
    screened_at TIMESTAMPTZ DEFAULT NOW()
);

-- Program Immunizations
CREATE TABLE program_immunizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES program_participants(id) ON DELETE CASCADE,
    vaccine_name TEXT NOT NULL,
    dose_number INTEGER,
    administered_date DATE,
    administered_by UUID REFERENCES users(id),
    lot_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Program Analytics
CREATE TABLE program_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES health_programs(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC,
    metric_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS & AUDIT
-- ============================================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('appointment', 'clearance', 'inventory', 'incident', 'system')),
    entity_type TEXT,
    entity_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Logs
CREATE TABLE ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    prompt TEXT,
    response TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'fallback')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointment_ai_evaluations
    ADD CONSTRAINT appointment_ai_evaluations_ai_log_id_fkey
    FOREIGN KEY (ai_log_id) REFERENCES ai_logs(id) ON DELETE SET NULL;

-- Human recommendation remains distinct from the advisory AI evaluation.
CREATE TABLE appointment_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    recommended_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recommendation TEXT NOT NULL CHECK (recommendation IN ('approve', 'reject', 'reschedule')),
    notes TEXT,
    recommended_date DATE,
    recommended_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_rfid_uid ON students(rfid_uid);
CREATE INDEX idx_students_student_number ON students(student_number);
CREATE INDEX idx_faculty_user_id ON faculty(user_id);
CREATE INDEX idx_faculty_rfid_uid ON faculty(rfid_uid);
CREATE INDEX idx_faculty_employee_number ON faculty(employee_number);
CREATE INDEX idx_clinic_visits_patient ON clinic_visits(patient_type, student_id, faculty_id);
CREATE INDEX idx_clinic_visits_status ON clinic_visits(status);
CREATE INDEX idx_consultations_visit_id ON consultations(visit_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX idx_triage_consultation_id ON triage_assessments(consultation_id);
CREATE INDEX idx_diagnoses_consultation_id ON diagnoses(consultation_id);
CREATE INDEX idx_treatments_consultation_id ON treatments(consultation_id);
CREATE INDEX idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_dispensing_logs_prescription_id ON dispensing_logs(prescription_id);
CREATE INDEX idx_medicine_stock_medicine_id ON medicine_stock(medicine_id);
CREATE INDEX idx_medicine_batches_medicine_id ON medicine_batches(medicine_id);
CREATE INDEX idx_restock_requests_status ON restock_requests(status);
CREATE INDEX idx_appointments_patient ON appointments(patient_type, student_id, faculty_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointment_ai_evals_appointment_id ON appointment_ai_evaluations(appointment_id);
CREATE INDEX idx_appointment_recommendations_appointment_id ON appointment_recommendations(appointment_id);
CREATE INDEX idx_appointment_reminders_appointment_id ON appointment_reminders(appointment_id);
CREATE INDEX idx_appointment_checkins_appointment_id ON appointment_checkins(appointment_id);
CREATE INDEX idx_incidents_patient ON incidents(patient_type, student_id, faculty_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incident_responses_incident_id ON incident_responses(incident_id);
CREATE INDEX idx_health_clearances_requester ON health_clearances(requester_type, student_id, faculty_id);
CREATE INDEX idx_health_clearances_status ON health_clearances(status);
CREATE INDEX idx_clearance_requests_clearance_id ON clearance_requests(clearance_id);
CREATE INDEX idx_clearance_evaluations_clearance_id ON clearance_evaluations(clearance_id);
CREATE INDEX idx_program_participants_program_id ON program_participants(program_id);
CREATE INDEX idx_program_screenings_participant_id ON program_screenings(participant_id);
CREATE INDEX idx_notifications_receiver_id ON notifications(receiver_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_ai_logs_user_id ON ai_logs(user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE UNIQUE INDEX idx_one_active_session_per_user ON user_sessions(user_id) WHERE revoked_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_students_timestamp BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_faculty_timestamp BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_clinic_accounts_timestamp BEFORE UPDATE ON clinic_accounts FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_clinic_visits_timestamp BEFORE UPDATE ON clinic_visits FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_consultations_timestamp BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_medicines_timestamp BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_medicine_stock_timestamp BEFORE UPDATE ON medicine_stock FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_prescriptions_timestamp BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_appointments_timestamp BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_incidents_timestamp BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_health_clearances_timestamp BEFORE UPDATE ON health_clearances FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_health_programs_timestamp BEFORE UPDATE ON health_programs FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_restock_requests_timestamp BEFORE UPDATE ON restock_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_clearance_requests_timestamp BEFORE UPDATE ON clearance_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Decrement stock when dispensing
CREATE OR REPLACE FUNCTION decrement_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM medicine_stock
        WHERE id = NEW.medicine_stock_id AND quantity >= NEW.quantity
    ) THEN
        RAISE EXCEPTION 'Insufficient medicine stock';
    END IF;
    UPDATE medicine_stock
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.medicine_stock_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_dispense
    AFTER INSERT ON dispensing_logs
    FOR EACH ROW EXECUTE FUNCTION decrement_stock();

-- ============================================
-- VIEWS
-- ============================================

-- Patient Summary View (masked for non-sensitive fields)
CREATE OR REPLACE VIEW v_patient_summary AS
SELECT 
    s.id AS patient_id,
    s.student_number,
    s.first_name,
    s.last_name,
    s.department,
    s.course,
    s.year_level,
    'student' AS patient_type
FROM students s
UNION ALL
SELECT 
    f.id AS patient_id,
    f.employee_number,
    f.first_name,
    f.last_name,
    f.department,
    f.position,
    NULL,
    'faculty' AS patient_type
FROM faculty f;

-- Appointment Overview View
CREATE OR REPLACE VIEW v_appointment_overview AS
SELECT 
    a.id,
    a.patient_type,
    COALESCE(s.first_name, f.first_name) AS patient_first_name,
    COALESCE(s.last_name, f.last_name) AS patient_last_name,
    a.scheduled_date,
    a.scheduled_time,
    a.priority,
    a.status,
    a.created_at
FROM appointments a
LEFT JOIN students s ON a.student_id = s.id
LEFT JOIN faculty f ON a.faculty_id = f.id;

-- Medicine Stock Summary View
CREATE OR REPLACE VIEW v_medicine_stock_summary AS
SELECT 
    m.id AS medicine_id,
    m.generic_name,
    m.brand_name,
    m.category,
    m.unit,
    m.min_stock_level,
    COALESCE(SUM(ms.quantity), 0) AS total_quantity,
    COUNT(ms.id) AS batch_count,
    MIN(ms.expiry_date) AS nearest_expiry,
    CASE 
        WHEN COALESCE(SUM(ms.quantity), 0) <= m.min_stock_level THEN true
        ELSE false
    END AS is_low_stock
FROM medicines m
LEFT JOIN medicine_stock ms ON m.id = ms.medicine_id
WHERE m.is_active = true
GROUP BY m.id, m.generic_name, m.brand_name, m.category, m.unit, m.min_stock_level;

-- Consultation Summary View
CREATE OR REPLACE VIEW v_consultation_summary AS
SELECT 
    c.id AS consultation_id,
    cv.id AS visit_id,
    cv.patient_type,
    COALESCE(s.student_number, f.employee_number) AS patient_identifier,
    COALESCE(s.first_name, f.first_name) AS patient_first_name,
    COALESCE(s.last_name, f.last_name) AS patient_last_name,
    cv.check_in_time,
    c.chief_complaint,
    c.status AS consultation_status,
    ca.display_name AS doctor_name,
    c.created_at
FROM consultations c
JOIN clinic_visits cv ON c.visit_id = cv.id
LEFT JOIN students s ON cv.student_id = s.id
LEFT JOIN faculty f ON cv.faculty_id = f.id
LEFT JOIN clinic_accounts ca ON c.doctor_id = ca.id;
