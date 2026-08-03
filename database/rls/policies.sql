-- ============================================
-- ZenTraq Row Level Security (RLS) Policies
-- Based on SAD §11.10 Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_immunizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispensing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_clearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_immunizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if current user is a clinic staff (admin, doctor, nurse)
CREATE OR REPLACE FUNCTION is_clinic_staff()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM clinic_accounts
    WHERE user_id = auth.uid();
    
    RETURN user_role IN ('admin', 'doctor', 'nurse');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM clinic_accounts
    WHERE user_id = auth.uid();
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is doctor
CREATE OR REPLACE FUNCTION is_doctor()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM clinic_accounts
    WHERE user_id = auth.uid();
    
    RETURN user_role = 'doctor';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is nurse
CREATE OR REPLACE FUNCTION is_nurse()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM clinic_accounts
    WHERE user_id = auth.uid();
    
    RETURN user_role = 'nurse';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's student ID
CREATE OR REPLACE FUNCTION current_student_id()
RETURNS UUID AS $$
DECLARE
    s_id UUID;
BEGIN
    SELECT id INTO s_id
    FROM students
    WHERE user_id = auth.uid();
    
    RETURN s_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's faculty ID
CREATE OR REPLACE FUNCTION current_faculty_id()
RETURNS UUID AS $$
DECLARE
    f_id UUID;
BEGIN
    SELECT id INTO f_id
    FROM faculty
    WHERE user_id = auth.uid();
    
    RETURN f_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STUDENT POLICIES
-- ============================================

-- Students can view their own record
CREATE POLICY "students_view_own" ON students
    FOR SELECT USING (user_id = auth.uid());

-- Clinic staff can view all students
CREATE POLICY "staff_view_all_students" ON students
    FOR SELECT USING (is_clinic_staff());

-- Admins can manage all students
CREATE POLICY "admin_manage_students" ON students
    FOR ALL USING (is_admin());

-- Student medical history
CREATE POLICY "student_medical_history_view_own" ON student_medical_history
    FOR SELECT USING (
        student_id = current_student_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_student_medical_history" ON student_medical_history
    FOR ALL USING (is_clinic_staff());

-- Student allergies
CREATE POLICY "student_allergies_view_own" ON student_allergies
    FOR SELECT USING (
        student_id = current_student_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_student_allergies" ON student_allergies
    FOR ALL USING (is_clinic_staff());

-- Student medications
CREATE POLICY "student_medications_view_own" ON student_medications
    FOR SELECT USING (
        student_id = current_student_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_student_medications" ON student_medications
    FOR ALL USING (is_clinic_staff());

-- Student immunizations
CREATE POLICY "student_immunizations_view_own" ON student_immunizations
    FOR SELECT USING (
        student_id = current_student_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_student_immunizations" ON student_immunizations
    FOR ALL USING (is_clinic_staff());

-- Student documents
CREATE POLICY "student_documents_view_own" ON student_documents
    FOR SELECT USING (
        student_id = current_student_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_student_documents" ON student_documents
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- FACULTY POLICIES
-- ============================================

-- Faculty can view their own record
CREATE POLICY "faculty_view_own" ON faculty
    FOR SELECT USING (user_id = auth.uid());

-- Clinic staff can view all faculty
CREATE POLICY "staff_view_all_faculty" ON faculty
    FOR SELECT USING (is_clinic_staff());

-- Admins can manage all faculty
CREATE POLICY "admin_manage_faculty" ON faculty
    FOR ALL USING (is_admin());

-- Faculty medical history
CREATE POLICY "faculty_medical_history_view_own" ON faculty_medical_history
    FOR SELECT USING (
        faculty_id = current_faculty_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_faculty_medical_history" ON faculty_medical_history
    FOR ALL USING (is_clinic_staff());

-- Faculty allergies
CREATE POLICY "faculty_allergies_view_own" ON faculty_allergies
    FOR SELECT USING (
        faculty_id = current_faculty_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_faculty_allergies" ON faculty_allergies
    FOR ALL USING (is_clinic_staff());

-- Faculty medications
CREATE POLICY "faculty_medications_view_own" ON faculty_medications
    FOR SELECT USING (
        faculty_id = current_faculty_id() OR is_clinic_staff()
    );

CREATE POLICY "staff_manage_faculty_medications" ON faculty_medications
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- CLINIC ACCOUNTS POLICIES
-- ============================================

-- Users can view their own clinic account
CREATE POLICY "clinic_accounts_view_own" ON clinic_accounts
    FOR SELECT USING (user_id = auth.uid());

-- Admins can manage all clinic accounts
CREATE POLICY "admin_manage_clinic_accounts" ON clinic_accounts
    FOR ALL USING (is_admin());

-- ============================================
-- CLINIC VISITS POLICIES
-- ============================================

-- Students can view their own visits
CREATE POLICY "clinic_visits_view_own_student" ON clinic_visits
    FOR SELECT USING (
        patient_type = 'student' AND student_id = current_student_id()
    );

-- Faculty can view their own visits
CREATE POLICY "clinic_visits_view_own_faculty" ON clinic_visits
    FOR SELECT USING (
        patient_type = 'faculty' AND faculty_id = current_faculty_id()
    );

-- Clinic staff can view all visits
CREATE POLICY "staff_view_all_visits" ON clinic_visits
    FOR SELECT USING (is_clinic_staff());

-- Clinic staff can create/update visits
CREATE POLICY "staff_manage_visits" ON clinic_visits
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- CONSULTATIONS POLICIES
-- ============================================

-- Students can view their own consultations
CREATE POLICY "consultations_view_own_student" ON consultations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clinic_visits cv
            WHERE cv.id = consultations.visit_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own consultations
CREATE POLICY "consultations_view_own_faculty" ON consultations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clinic_visits cv
            WHERE cv.id = consultations.visit_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Doctors can view and manage their consultations
CREATE POLICY "doctor_manage_consultations" ON consultations
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM clinic_accounts WHERE user_id = auth.uid()
        )
    );

-- Nurses can view and create consultations (for triage)
CREATE POLICY "nurse_manage_consultations" ON consultations
    FOR ALL USING (is_nurse());

-- Admins can view all
CREATE POLICY "admin_view_consultations" ON consultations
    FOR SELECT USING (is_admin());

-- ============================================
-- TRIAGE ASSESSMENTS POLICIES
-- ============================================

-- Students can view their own triage
CREATE POLICY "triage_view_own_student" ON triage_assessments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = triage_assessments.consultation_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own triage
CREATE POLICY "triage_view_own_faculty" ON triage_assessments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = triage_assessments.consultation_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Clinic staff can manage triage
CREATE POLICY "staff_manage_triage" ON triage_assessments
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- DIAGNOSES POLICIES
-- ============================================

-- Students can view their own diagnoses
CREATE POLICY "diagnoses_view_own_student" ON diagnoses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = diagnoses.consultation_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own diagnoses
CREATE POLICY "diagnoses_view_own_faculty" ON diagnoses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = diagnoses.consultation_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Doctors can manage diagnoses
CREATE POLICY "doctor_manage_diagnoses" ON diagnoses
    FOR ALL USING (is_doctor());

-- Nurses can view diagnoses
CREATE POLICY "nurse_view_diagnoses" ON diagnoses
    FOR SELECT USING (is_nurse());

-- Admins can view all
CREATE POLICY "admin_view_diagnoses" ON diagnoses
    FOR SELECT USING (is_admin());

-- ============================================
-- TREATMENTS POLICIES
-- ============================================

-- Students can view their own treatments
CREATE POLICY "treatments_view_own_student" ON treatments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = treatments.consultation_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own treatments
CREATE POLICY "treatments_view_own_faculty" ON treatments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = treatments.consultation_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Doctors can manage treatments
CREATE POLICY "doctor_manage_treatments" ON treatments
    FOR ALL USING (is_doctor());

-- Nurses can view treatments
CREATE POLICY "nurse_view_treatments" ON treatments
    FOR SELECT USING (is_nurse());

-- Admins can view all
CREATE POLICY "admin_view_treatments" ON treatments
    FOR SELECT USING (is_admin());

-- ============================================
-- FOLLOW-UPS POLICIES
-- ============================================

-- Students can view their own follow-ups
CREATE POLICY "follow_ups_view_own_student" ON follow_ups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = follow_ups.consultation_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own follow-ups
CREATE POLICY "follow_ups_view_own_faculty" ON follow_ups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = follow_ups.consultation_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Clinic staff can manage follow-ups
CREATE POLICY "staff_manage_follow_ups" ON follow_ups
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- MEDICINES & INVENTORY POLICIES
-- ============================================

-- All authenticated users can view medicines
CREATE POLICY "medicines_view_all" ON medicines
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins can manage medicines
CREATE POLICY "admin_manage_medicines" ON medicines
    FOR ALL USING (is_admin());

-- Medicine stock - staff can view
CREATE POLICY "medicine_stock_view_staff" ON medicine_stock
    FOR SELECT USING (is_clinic_staff());

-- Admins can manage stock
CREATE POLICY "admin_manage_medicine_stock" ON medicine_stock
    FOR ALL USING (is_admin());

-- Nurses can update stock (dispensing)
CREATE POLICY "nurse_update_stock" ON medicine_stock
    FOR UPDATE USING (is_nurse());

-- Medicine batches
CREATE POLICY "medicine_batches_view_staff" ON medicine_batches
    FOR SELECT USING (is_clinic_staff());

CREATE POLICY "admin_manage_medicine_batches" ON medicine_batches
    FOR ALL USING (is_admin());

-- Suppliers
CREATE POLICY "suppliers_view_staff" ON suppliers
    FOR SELECT USING (is_clinic_staff());

CREATE POLICY "admin_manage_suppliers" ON suppliers
    FOR ALL USING (is_admin());

-- ============================================
-- PRESCRIPTIONS POLICIES
-- ============================================

-- Students can view their own prescriptions
CREATE POLICY "prescriptions_view_own_student" ON prescriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = prescriptions.consultation_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own prescriptions
CREATE POLICY "prescriptions_view_own_faculty" ON prescriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations c
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE c.id = prescriptions.consultation_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Doctors can manage prescriptions
CREATE POLICY "doctor_manage_prescriptions" ON prescriptions
    FOR ALL USING (is_doctor());

-- Nurses can view prescriptions (for dispensing)
CREATE POLICY "nurse_view_prescriptions" ON prescriptions
    FOR SELECT USING (is_nurse());

-- Admins can view all
CREATE POLICY "admin_view_prescriptions" ON prescriptions
    FOR SELECT USING (is_admin());

-- ============================================
-- DISPENSING LOGS POLICIES
-- ============================================

-- Students can view their own dispensing logs
CREATE POLICY "dispensing_view_own_student" ON dispensing_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prescriptions p
            JOIN consultations c ON p.consultation_id = c.id
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE p.id = dispensing_logs.prescription_id
            AND cv.patient_type = 'student'
            AND cv.student_id = current_student_id()
        )
    );

-- Faculty can view their own dispensing logs
CREATE POLICY "dispensing_view_own_faculty" ON dispensing_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prescriptions p
            JOIN consultations c ON p.consultation_id = c.id
            JOIN clinic_visits cv ON c.visit_id = cv.id
            WHERE p.id = dispensing_logs.prescription_id
            AND cv.patient_type = 'faculty'
            AND cv.faculty_id = current_faculty_id()
        )
    );

-- Nurses can manage dispensing logs
CREATE POLICY "nurse_manage_dispensing" ON dispensing_logs
    FOR ALL USING (is_nurse());

-- Admins can view all
CREATE POLICY "admin_view_dispensing" ON dispensing_logs
    FOR SELECT USING (is_admin());

-- ============================================
-- RESTOCK REQUESTS POLICIES
-- ============================================

-- Nurses and admins can view restock requests
CREATE POLICY "staff_view_restock" ON restock_requests
    FOR SELECT USING (is_clinic_staff());

-- Nurses can create restock requests
CREATE POLICY "nurse_create_restock" ON restock_requests
    FOR INSERT WITH CHECK (is_nurse());

-- Admins can manage restock requests
CREATE POLICY "admin_manage_restock" ON restock_requests
    FOR ALL USING (is_admin());

-- ============================================
-- APPOINTMENTS POLICIES
-- ============================================

-- Students can view and create their own appointments
CREATE POLICY "appointments_view_own_student" ON appointments
    FOR SELECT USING (
        patient_type = 'student' AND student_id = current_student_id()
    );

CREATE POLICY "appointments_create_own_student" ON appointments
    FOR INSERT WITH CHECK (
        patient_type = 'student' AND student_id = current_student_id()
    );

-- Faculty can view and create their own appointments
CREATE POLICY "appointments_view_own_faculty" ON appointments
    FOR SELECT USING (
        patient_type = 'faculty' AND faculty_id = current_faculty_id()
    );

CREATE POLICY "appointments_create_own_faculty" ON appointments
    FOR INSERT WITH CHECK (
        patient_type = 'faculty' AND faculty_id = current_faculty_id()
    );

-- Doctors can view their assigned appointments
CREATE POLICY "doctor_view_appointments" ON appointments
    FOR SELECT USING (
        doctor_id IN (
            SELECT id FROM clinic_accounts WHERE user_id = auth.uid()
        )
    );

-- Nurses and admins can manage all appointments
CREATE POLICY "staff_manage_appointments" ON appointments
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- APPOINTMENT AI EVALUATIONS POLICIES
-- ============================================

-- Staff can view AI evaluations
CREATE POLICY "staff_view_ai_evaluations" ON appointment_ai_evaluations
    FOR SELECT USING (is_clinic_staff());

-- System can insert AI evaluations
CREATE POLICY "system_insert_ai_evaluations" ON appointment_ai_evaluations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "staff_view_appointment_recommendations" ON appointment_recommendations
    FOR SELECT USING (is_clinic_staff());

CREATE POLICY "doctor_nurse_create_appointment_recommendations" ON appointment_recommendations
    FOR INSERT WITH CHECK (is_doctor() OR is_nurse());

-- ============================================
-- APPOINTMENT REMINDERS POLICIES
-- ============================================

-- Staff can manage reminders
CREATE POLICY "staff_manage_reminders" ON appointment_reminders
    FOR ALL USING (is_clinic_staff());

-- System can insert reminders
CREATE POLICY "system_insert_reminders" ON appointment_reminders
    FOR INSERT WITH CHECK (true);

-- ============================================
-- APPOINTMENT CHECK-INS POLICIES
-- ============================================

-- Students can view their own check-ins
CREATE POLICY "checkins_view_own_student" ON appointment_checkins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.id = appointment_checkins.appointment_id
            AND a.patient_type = 'student'
            AND a.student_id = current_student_id()
        )
    );

-- Faculty can view their own check-ins
CREATE POLICY "checkins_view_own_faculty" ON appointment_checkins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.id = appointment_checkins.appointment_id
            AND a.patient_type = 'faculty'
            AND a.faculty_id = current_faculty_id()
        )
    );

-- Staff can view all check-ins
CREATE POLICY "staff_view_checkins" ON appointment_checkins
    FOR SELECT USING (is_clinic_staff());

-- System can insert check-ins (RFID kiosk)
CREATE POLICY "system_insert_checkins" ON appointment_checkins
    FOR INSERT WITH CHECK (true);

-- ============================================
-- INCIDENTS POLICIES
-- ============================================

-- Students can view their own incidents
CREATE POLICY "incidents_view_own_student" ON incidents
    FOR SELECT USING (
        patient_type = 'student' AND student_id = current_student_id()
    );

-- Faculty can view their own incidents
CREATE POLICY "incidents_view_own_faculty" ON incidents
    FOR SELECT USING (
        patient_type = 'faculty' AND faculty_id = current_faculty_id()
    );

-- Clinic staff can manage all incidents
CREATE POLICY "staff_manage_incidents" ON incidents
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- INCIDENT RESPONSES POLICIES
-- ============================================

-- Students can view responses to their incidents
CREATE POLICY "incident_responses_view_own_student" ON incident_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.id = incident_responses.incident_id
            AND i.patient_type = 'student'
            AND i.student_id = current_student_id()
        )
    );

-- Faculty can view responses to their incidents
CREATE POLICY "incident_responses_view_own_faculty" ON incident_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.id = incident_responses.incident_id
            AND i.patient_type = 'faculty'
            AND i.faculty_id = current_faculty_id()
        )
    );

-- Clinic staff can manage responses
CREATE POLICY "staff_manage_incident_responses" ON incident_responses
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- INCIDENT FOLLOW-UPS POLICIES
-- ============================================

-- Students can view follow-ups for their incidents
CREATE POLICY "incident_followups_view_own_student" ON incident_followups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.id = incident_followups.incident_id
            AND i.patient_type = 'student'
            AND i.student_id = current_student_id()
        )
    );

-- Faculty can view follow-ups for their incidents
CREATE POLICY "incident_followups_view_own_faculty" ON incident_followups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.id = incident_followups.incident_id
            AND i.patient_type = 'faculty'
            AND i.faculty_id = current_faculty_id()
        )
    );

-- Clinic staff can manage follow-ups
CREATE POLICY "staff_manage_incident_followups" ON incident_followups
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- HEALTH CLEARANCES POLICIES
-- ============================================

-- Students can view their own clearances
CREATE POLICY "clearances_view_own_student" ON health_clearances
    FOR SELECT USING (
        requester_type = 'student' AND student_id = current_student_id()
    );

CREATE POLICY "clearances_create_own_student" ON health_clearances
    FOR INSERT WITH CHECK (
        requester_type = 'student' AND student_id = current_student_id()
    );

-- Faculty can view their own clearances
CREATE POLICY "clearances_view_own_faculty" ON health_clearances
    FOR SELECT USING (
        requester_type = 'faculty' AND faculty_id = current_faculty_id()
    );

CREATE POLICY "clearances_create_own_faculty" ON health_clearances
    FOR INSERT WITH CHECK (
        requester_type = 'faculty' AND faculty_id = current_faculty_id()
    );

-- Nurses can process clearances
CREATE POLICY "nurse_manage_clearances" ON health_clearances
    FOR ALL USING (is_nurse());

-- Doctors can evaluate clearances
CREATE POLICY "doctor_evaluate_clearances" ON health_clearances
    FOR UPDATE USING (is_doctor());

-- Admins can approve and issue certificates
CREATE POLICY "admin_manage_clearances" ON health_clearances
    FOR ALL USING (is_admin());

-- ============================================
-- CLEARANCE REQUESTS POLICIES
-- ============================================

-- Staff can manage clearance requests
CREATE POLICY "staff_manage_clearance_requests" ON clearance_requests
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- CLEARANCE EVALUATIONS POLICIES
-- ============================================

-- Students can view their own evaluations
CREATE POLICY "clearance_evals_view_own_student" ON clearance_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM health_clearances hc
            WHERE hc.id = clearance_evaluations.clearance_id
            AND hc.requester_type = 'student'
            AND hc.student_id = current_student_id()
        )
    );

-- Faculty can view their own evaluations
CREATE POLICY "clearance_evals_view_own_faculty" ON clearance_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM health_clearances hc
            WHERE hc.id = clearance_evaluations.clearance_id
            AND hc.requester_type = 'faculty'
            AND hc.faculty_id = current_faculty_id()
        )
    );

-- Doctors can create evaluations
CREATE POLICY "doctor_create_evaluations" ON clearance_evaluations
    FOR INSERT WITH CHECK (is_doctor());

-- Doctors can update their own evaluations
CREATE POLICY "doctor_update_own_evaluations" ON clearance_evaluations
    FOR UPDATE USING (
        doctor_id IN (
            SELECT id FROM clinic_accounts WHERE user_id = auth.uid()
        )
    );

-- Nurses and admins can view all
CREATE POLICY "staff_view_evaluations" ON clearance_evaluations
    FOR SELECT USING (is_clinic_staff());

-- ============================================
-- CLEARANCE CERTIFICATES POLICIES
-- ============================================

-- Students can view their own certificates
CREATE POLICY "certificates_view_own_student" ON clearance_certificates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM health_clearances hc
            WHERE hc.id = clearance_certificates.clearance_id
            AND hc.requester_type = 'student'
            AND hc.student_id = current_student_id()
        )
    );

-- Faculty can view their own certificates
CREATE POLICY "certificates_view_own_faculty" ON clearance_certificates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM health_clearances hc
            WHERE hc.id = clearance_certificates.clearance_id
            AND hc.requester_type = 'faculty'
            AND hc.faculty_id = current_faculty_id()
        )
    );

-- Admins can issue certificates
CREATE POLICY "admin_issue_certificates" ON clearance_certificates
    FOR ALL USING (is_admin());

-- ============================================
-- HEALTH PROGRAMS POLICIES
-- ============================================

-- Admins can manage programs
CREATE POLICY "admin_manage_programs" ON health_programs
    FOR ALL USING (is_admin());

-- Doctors and nurses can view programs
CREATE POLICY "staff_view_programs" ON health_programs
    FOR SELECT USING (is_clinic_staff());

-- ============================================
-- PROGRAM PARTICIPANTS POLICIES
-- ============================================

-- Students can view their own enrollments
CREATE POLICY "participants_view_own_student" ON program_participants
    FOR SELECT USING (
        patient_type = 'student' AND student_id = current_student_id()
    );

-- Faculty can view their own enrollments
CREATE POLICY "participants_view_own_faculty" ON program_participants
    FOR SELECT USING (
        patient_type = 'faculty' AND faculty_id = current_faculty_id()
    );

-- Staff can manage participants
CREATE POLICY "staff_manage_participants" ON program_participants
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- PROGRAM SCREENINGS POLICIES
-- ============================================

-- Students can view their own screenings
CREATE POLICY "screenings_view_own_student" ON program_screenings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM program_participants pp
            WHERE pp.id = program_screenings.participant_id
            AND pp.patient_type = 'student'
            AND pp.student_id = current_student_id()
        )
    );

-- Faculty can view their own screenings
CREATE POLICY "screenings_view_own_faculty" ON program_screenings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM program_participants pp
            WHERE pp.id = program_screenings.participant_id
            AND pp.patient_type = 'faculty'
            AND pp.faculty_id = current_faculty_id()
        )
    );

-- Staff can manage screenings
CREATE POLICY "staff_manage_screenings" ON program_screenings
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- PROGRAM IMMUNIZATIONS POLICIES
-- ============================================

-- Students can view their own immunizations
CREATE POLICY "program_immunizations_view_own_student" ON program_immunizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM program_participants pp
            WHERE pp.id = program_immunizations.participant_id
            AND pp.patient_type = 'student'
            AND pp.student_id = current_student_id()
        )
    );

-- Faculty can view their own immunizations
CREATE POLICY "program_immunizations_view_own_faculty" ON program_immunizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM program_participants pp
            WHERE pp.id = program_immunizations.participant_id
            AND pp.patient_type = 'faculty'
            AND pp.faculty_id = current_faculty_id()
        )
    );

-- Staff can manage immunizations
CREATE POLICY "staff_manage_program_immunizations" ON program_immunizations
    FOR ALL USING (is_clinic_staff());

-- ============================================
-- PROGRAM ANALYTICS POLICIES
-- ============================================

-- Staff can view analytics
CREATE POLICY "staff_view_analytics" ON program_analytics
    FOR SELECT USING (is_clinic_staff());

-- Admins can manage analytics
CREATE POLICY "admin_manage_analytics" ON program_analytics
    FOR ALL USING (is_admin());

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

-- Users can only view their own notifications
CREATE POLICY "notifications_view_own" ON notifications
    FOR SELECT USING (receiver_id = auth.uid());

-- Users can mark their own as read
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (receiver_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE USING (receiver_id = auth.uid());

-- System can insert notifications
CREATE POLICY "system_insert_notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

-- Only admins can view audit logs
CREATE POLICY "audit_logs_admin_only" ON audit_logs
    FOR SELECT USING (is_admin());

-- System can insert audit logs
CREATE POLICY "system_insert_audit_logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- ============================================
-- AI LOGS POLICIES
-- ============================================

-- Only admins can view AI logs
CREATE POLICY "ai_logs_admin_only" ON ai_logs
    FOR SELECT USING (is_admin());

-- System can insert AI logs
CREATE POLICY "system_insert_ai_logs" ON ai_logs
    FOR INSERT WITH CHECK (true);

-- ============================================
-- USER SESSIONS POLICIES
-- ============================================

-- Users can view their own sessions
CREATE POLICY "sessions_view_own" ON user_sessions
    FOR SELECT USING (user_id = auth.uid());

-- Admins can view all sessions
CREATE POLICY "admin_view_sessions" ON user_sessions
    FOR SELECT USING (is_admin());

-- System can manage sessions
CREATE POLICY "system_manage_sessions" ON user_sessions
    FOR ALL USING (true);
