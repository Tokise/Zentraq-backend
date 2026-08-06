// ============================================
// ZenTraq Type Definitions
// Based on SAD §11 Database Schema & §12 Folder Structure
// ============================================

// ──────────────────────────────────────────────
// Core Auth Types
// ──────────────────────────────────────────────

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'student' | 'faculty' | 'staff';

export interface User {
    id: string;
    email: string;
    email_verified: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Role {
    id: string;
    name: UserRole;
    description: string | null;
    created_at: string;
}

export interface Permission {
    id: string;
    code: string;
    description: string | null;
}

export interface UserRoleAssignment {
    user_id: string;
    role_id: string;
    assigned_at: string;
}

export interface RolePermission {
    role_id: string;
    permission_id: string;
}

// ──────────────────────────────────────────────
// Patient Types (Student & Faculty)
// ──────────────────────────────────────────────

export interface Student {
    id: string;
    user_id: string | null;
    student_number: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    department: string | null;
    course: string | null;
    year_level: number | null;
    section: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    birth_date: string | null;
    gender: string | null;
    blood_type: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    rfid_uid: string | null;
    status: string;
    profile_photo_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface StudentMedicalHistory {
    id: string;
    student_id: string;
    condition_name: string;
    diagnosed_date: string | null;
    status: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface StudentAllergy {
    id: string;
    student_id: string;
    allergen: string;
    reaction: string | null;
    severity: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

export interface StudentMedication {
    id: string;
    student_id: string;
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    start_date: string | null;
    end_date: string | null;
    prescribed_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface StudentImmunization {
    id: string;
    student_id: string;
    vaccine_name: string;
    administered_date: string | null;
    dose_number: number | null;
    lot_number: string | null;
    administered_by: string | null;
    notes: string | null;
    created_at: string;
}

export interface StudentDocument {
    id: string;
    student_id: string;
    document_type: string;
    file_url: string;
    file_name: string | null;
    mime_type: string | null;
    file_size: number | null;
    uploaded_by: string | null;
    created_at: string;
}

export interface Faculty {
    id: string;
    user_id: string | null;
    employee_number: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    department: string | null;
    position: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    rfid_uid: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface FacultyMedicalHistory {
    id: string;
    faculty_id: string;
    condition_name: string;
    diagnosed_date: string | null;
    status: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface FacultyAllergy {
    id: string;
    faculty_id: string;
    allergen: string;
    reaction: string | null;
    severity: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

export interface FacultyMedication {
    id: string;
    faculty_id: string;
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    start_date: string | null;
    end_date: string | null;
    prescribed_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

// ──────────────────────────────────────────────
// Clinic Accounts
// ──────────────────────────────────────────────

export type ClinicRole = 'admin' | 'doctor' | 'nurse';

export interface ClinicAccount {
    id: string;
    user_id: string;
    role: ClinicRole;
    display_name: string;
    license_number: string | null;
    current_session_token: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ──────────────────────────────────────────────
// Clinic Visits & Consultations
// ──────────────────────────────────────────────

export type VisitType = 'walk-in' | 'appointment' | 'rfid';
export type VisitStatus = 'in-progress' | 'completed' | 'cancelled';
export type PatientType = 'student' | 'faculty';

export interface ClinicVisit {
    id: string;
    patient_type: PatientType;
    student_id: string | null;
    faculty_id: string | null;
    visit_type: VisitType;
    check_in_time: string;
    check_out_time: string | null;
    status: VisitStatus;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export type ConsultationStatus = 'in-progress' | 'completed';

export interface Consultation {
    id: string;
    visit_id: string;
    appointment_id: string | null;
    doctor_id: string | null;
    nurse_id: string | null;
    chief_complaint: string | null;
    consultation_notes: string | null;
    status: ConsultationStatus;
    created_at: string;
    completed_at: string | null;
    updated_at: string;
}

export interface TriageAssessment {
    id: string;
    consultation_id: string;
    nurse_id: string | null;
    temperature: number | null;
    blood_pressure: string | null;
    heart_rate: number | null;
    respiratory_rate: number | null;
    oxygen_saturation: number | null;
    weight: number | null;
    height: number | null;
    symptoms: string | null;
    triage_level: 'red' | 'yellow' | 'green' | null;
    notes: string | null;
    created_at: string;
}

export interface Diagnosis {
    id: string;
    consultation_id: string;
    icd10_code: string | null;
    description: string | null;
    is_primary: boolean;
    created_by: string | null;
    created_at: string;
}

export interface Treatment {
    id: string;
    consultation_id: string;
    treatment_plan: string | null;
    instructions: string | null;
    follow_up_days: number | null;
    created_by: string | null;
    created_at: string;
}

export interface FollowUp {
    id: string;
    consultation_id: string;
    scheduled_date: string;
    reason: string | null;
    status: 'scheduled' | 'completed' | 'cancelled';
    completed_at: string | null;
    created_at: string;
}

// ──────────────────────────────────────────────
// Pharmacy / Medicine Inventory
// ──────────────────────────────────────────────

export interface Medicine {
    id: string;
    generic_name: string;
    brand_name: string | null;
    category: string | null;
    unit: string;
    min_stock_level: number;
    is_controlled: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MedicineStock {
    id: string;
    medicine_id: string;
    quantity: number;
    batch_number: string | null;
    expiry_date: string | null;
    location: string | null;
    updated_at: string;
}

export interface MedicineBatch {
    id: string;
    medicine_id: string;
    batch_number: string;
    quantity: number;
    expiry_date: string;
    supplier_id: string | null;
    received_date: string;
    created_at: string;
}

export interface Supplier {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    is_active: boolean;
    created_at: string;
}

export type PrescriptionStatus = 'pending' | 'dispensed' | 'cancelled';

export interface Prescription {
    id: string;
    consultation_id: string;
    medicine_id: string;
    dosage: string | null;
    frequency: string | null;
    duration_days: number | null;
    quantity: number | null;
    instructions: string | null;
    prescribed_by: string | null;
    status: PrescriptionStatus;
    created_at: string;
    updated_at: string;
}

export interface DispensingLog {
    id: string;
    prescription_id: string;
    medicine_stock_id: string;
    dispensed_by: string | null;
    quantity: number;
    dispensed_at: string;
}

export type RestockStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface RestockRequest {
    id: string;
    medicine_id: string;
    quantity: number;
    requested_by: string | null;
    status: RestockStatus;
    approved_by: string | null;
    supplier_id: string | null;
    created_at: string;
    updated_at: string;
}

// ──────────────────────────────────────────────
// Appointments
// ──────────────────────────────────────────────

export type AppointmentStatus =
    | 'pending'
    | 'ai_evaluated'
    | 'recommended'
    | 'approved'
    | 'rejected'
    | 'scheduled'
    | 'reminded'
    | 'checked_in'
    | 'in_consultation'
    | 'completed'
    | 'cancelled'
    | 'no_show';

export interface Appointment {
    id: string;
    patient_type: PatientType;
    student_id: string | null;
    faculty_id: string | null;
    doctor_id: string | null;
    reason: string;
    symptoms: string | null;
    priority: number | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    status: AppointmentStatus;
    created_at: string;
    updated_at: string;
}

export interface AppointmentAIEvaluation {
    id: string;
    appointment_id: string;
    priority_score: number | null;
    recommended_slot: string | null;
    rationale: string | null;
    ai_log_id: string | null;
    created_at: string;
}

export interface AppointmentReminder {
    id: string;
    appointment_id: string;
    remind_at: string;
    sent_at: string | null;
    status: 'scheduled' | 'sent' | 'failed';
    created_at: string;
}

export interface AppointmentCheckin {
    id: string;
    appointment_id: string;
    rfid_uid: string | null;
    check_in_time: string;
}

// ──────────────────────────────────────────────
// Incidents
// ──────────────────────────────────────────────

export type IncidentType = 'injury' | 'illness' | 'emergency';
export type IncidentSeverity = 'minor' | 'moderate' | 'severe' | 'critical';
export type IncidentStatus = 'open' | 'in-progress' | 'closed';

export interface Incident {
    id: string;
    patient_type: PatientType;
    student_id: string | null;
    faculty_id: string | null;
    incident_type: IncidentType;
    description: string;
    location: string | null;
    severity: IncidentSeverity | null;
    status: IncidentStatus;
    reported_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface IncidentResponse {
    id: string;
    incident_id: string;
    action_taken: string;
    responder_id: string | null;
    response_time: string;
}

export interface IncidentFollowup {
    id: string;
    incident_id: string;
    follow_up_date: string | null;
    notes: string | null;
    completed: boolean;
    created_at: string;
}

// ──────────────────────────────────────────────
// Health Clearances
// ──────────────────────────────────────────────

export type ClearanceStatus = 'pending' | 'evaluating' | 'approved' | 'rejected';
export type ClearanceResult = 'fit' | 'unfit' | 'conditional';
export type RequesterType = 'student' | 'faculty';

export interface HealthClearance {
    id: string;
    requester_type: RequesterType;
    student_id: string | null;
    faculty_id: string | null;
    purpose: string | null;
    status: ClearanceStatus;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ClearanceRequest {
    id: string;
    clearance_id: string;
    requested_by: string | null;
    request_details: string | null;
    status: 'submitted' | 'processing' | 'evaluated' | 'completed';
    created_at: string;
    updated_at: string;
}

export interface ClearanceEvaluation {
    id: string;
    clearance_id: string;
    doctor_id: string | null;
    result: ClearanceResult;
    medical_notes: string | null;
    evaluated_at: string;
}

export interface ClearanceCertificate {
    id: string;
    clearance_id: string;
    certificate_number: string;
    issued_by: string | null;
    issued_at: string;
}

// ──────────────────────────────────────────────
// Health Programs
// ──────────────────────────────────────────────

export type ProgramType = 'immunization' | 'screening' | 'wellness';

export interface HealthProgram {
    id: string;
    name: string;
    description: string | null;
    program_type: ProgramType;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    managed_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProgramParticipant {
    id: string;
    program_id: string;
    patient_type: PatientType;
    student_id: string | null;
    faculty_id: string | null;
    enrolled_at: string;
}

export interface ProgramScreening {
    id: string;
    participant_id: string;
    screening_type: string;
    result: string | null;
    performed_by: string | null;
    screened_at: string;
}

export interface ProgramImmunization {
    id: string;
    participant_id: string;
    vaccine_name: string;
    dose_number: number | null;
    administered_date: string | null;
    administered_by: string | null;
    lot_number: string | null;
    created_at: string;
}

export interface ProgramAnalytics {
    id: string;
    program_id: string;
    metric_name: string;
    metric_value: number | null;
    metric_date: string | null;
    created_at: string;
}

// ──────────────────────────────────────────────
// Notifications & Audit
// ──────────────────────────────────────────────

export type NotificationType = 'appointment' | 'clearance' | 'inventory' | 'incident' | 'system';

export interface Notification {
    id: string;
    sender_id: string | null;
    receiver_id: string;
    title: string;
    message: string;
    type: NotificationType;
    entity_type: string | null;
    entity_id: string | null;
    read_at: string | null;
    created_at: string;
}

export interface AuditLog {
    id: string;
    user_id: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export type AILogStatus = 'success' | 'failed' | 'fallback';

export interface AILog {
    id: string;
    user_id: string | null;
    action_type: string;
    entity_type: string | null;
    entity_id: string | null;
    prompt: string | null;
    response: string | null;
    status: AILogStatus;
    created_at: string;
}

export interface UserSession {
    id: string;
    user_id: string;
    session_token: string;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
}

// ──────────────────────────────────────────────
// DTO Types (Data Transfer Objects)
// ──────────────────────────────────────────────

export interface StudentPublicDTO {
    id: string;
    first_name: string;
    last_name: string;
    department: string | null;
    course: string | null;
    year_level: number | null;
    status: string;
    profile_photo_url: string | null;
}

export interface StudentSensitiveDTO extends StudentPublicDTO {
    student_number: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    birth_date: string | null;
    gender: string | null;
    blood_type: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    rfid_uid: string | null;
    medical_history: StudentMedicalHistoryDTO[];
    allergies: StudentAllergyDTO[];
    medications: StudentMedicationDTO[];
    immunizations: StudentImmunizationDTO[];
}

export interface StudentMedicalHistoryDTO {
    id: string;
    condition_name: string;
    diagnosed_date: string | null;
    status: string;
    notes: string | null;
}

export interface StudentAllergyDTO {
    id: string;
    allergen: string;
    reaction: string | null;
    severity: string | null;
    notes: string | null;
}

export interface StudentMedicationDTO {
    id: string;
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    start_date: string | null;
    end_date: string | null;
}

export interface StudentImmunizationDTO {
    id: string;
    vaccine_name: string;
    administered_date: string | null;
    dose_number: number | null;
    lot_number: string | null;
}

export interface FacultyPublicDTO {
    id: string;
    first_name: string;
    last_name: string;
    department: string | null;
    position: string | null;
    status: string;
}

export interface FacultySensitiveDTO extends FacultyPublicDTO {
    employee_number: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    rfid_uid: string | null;
    medical_history: FacultyMedicalHistoryDTO[];
    allergies: FacultyAllergyDTO[];
    medications: FacultyMedicationDTO[];
}

export interface FacultyMedicalHistoryDTO {
    id: string;
    condition_name: string;
    diagnosed_date: string | null;
    status: string;
    notes: string | null;
}

export interface FacultyAllergyDTO {
    id: string;
    allergen: string;
    reaction: string | null;
    severity: string | null;
    notes: string | null;
}

export interface FacultyMedicationDTO {
    id: string;
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    start_date: string | null;
    end_date: string | null;
}

export interface ConsultationDTO {
    id: string;
    visit_id: string;
    chief_complaint: string | null;
    consultation_notes: string | null;
    status: ConsultationStatus;
    created_at: string;
    completed_at: string | null;
    doctor_name: string | null;
    nurse_name: string | null;
    triage: TriageAssessmentDTO | null;
    diagnoses: DiagnosisDTO[];
    treatments: TreatmentDTO[];
    prescriptions: PrescriptionDTO[];
}

export interface TriageAssessmentDTO {
    id: string;
    temperature: number | null;
    blood_pressure: string | null;
    heart_rate: number | null;
    respiratory_rate: number | null;
    oxygen_saturation: number | null;
    weight: number | null;
    height: number | null;
    symptoms: string | null;
    triage_level: 'red' | 'yellow' | 'green' | null;
    notes: string | null;
    created_at: string;
}

export interface DiagnosisDTO {
    id: string;
    icd10_code: string | null;
    description: string | null;
    is_primary: boolean;
}

export interface TreatmentDTO {
    id: string;
    treatment_plan: string | null;
    instructions: string | null;
    follow_up_days: number | null;
}

export interface PrescriptionDTO {
    id: string;
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    duration_days: number | null;
    quantity: number | null;
    instructions: string | null;
    status: PrescriptionStatus;
}

export interface AppointmentDTO {
    id: string;
    patient_type: PatientType;
    patient_name: string;
    patient_identifier: string;
    reason: string;
    symptoms: string | null;
    priority: number | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    status: AppointmentStatus;
    doctor_name: string | null;
    ai_evaluation: AppointmentAIEvaluationDTO | null;
    created_at: string;
}

export interface AppointmentAIEvaluationDTO {
    priority_score: number | null;
    recommended_slot: string | null;
    rationale: string | null;
}

export interface MedicineDTO {
    id: string;
    generic_name: string;
    brand_name: string | null;
    category: string | null;
    unit: string;
    min_stock_level: number;
    is_controlled: boolean;
    total_stock: number;
    is_low_stock: boolean;
    nearest_expiry: string | null;
}

export interface IncidentDTO {
    id: string;
    patient_type: PatientType;
    patient_name: string;
    incident_type: IncidentType;
    description: string;
    location: string | null;
    severity: IncidentSeverity | null;
    status: IncidentStatus;
    reported_by_name: string | null;
    created_at: string;
}

export interface HealthClearanceDTO {
    id: string;
    requester_type: RequesterType;
    requester_name: string;
    purpose: string | null;
    status: ClearanceStatus;
    expires_at: string | null;
    evaluation: ClearanceEvaluationDTO | null;
    certificate: ClearanceCertificateDTO | null;
    created_at: string;
}

export interface ClearanceEvaluationDTO {
    result: ClearanceResult;
    medical_notes: string | null;
    evaluated_at: string;
    doctor_name: string | null;
}

export interface ClearanceCertificateDTO {
    certificate_number: string;
    issued_at: string;
    issued_by_name: string | null;
}

export interface NotificationDTO {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    entity_type: string | null;
    entity_id: string | null;
    read_at: string | null;
    created_at: string;
}

export interface AuditLogDTO {
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    user_email: string | null;
    ip_address: string | null;
    created_at: string;
}

export interface AILogDTO {
    id: string;
    action_type: string;
    entity_type: string | null;
    entity_id: string | null;
    status: AILogStatus;
    created_at: string;
}

// ──────────────────────────────────────────────
// Action Result Types
// ──────────────────────────────────────────────

export interface ActionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    details?: unknown;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

// ──────────────────────────────────────────────
// Form Input Types
// ──────────────────────────────────────────────

export interface CreateStudentInput {
    student_number: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    department?: string;
    course?: string;
    year_level?: number;
    section?: string;
    phone?: string;
    email?: string;
    address?: string;
    birth_date?: string;
    gender?: string;
    blood_type?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
    rfid_uid?: string;
}

export interface CreateFacultyInput {
    employee_number: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    department?: string;
    position?: string;
    phone?: string;
    email?: string;
    address?: string;
    rfid_uid?: string;
}

export interface CreateClinicVisitInput {
    patient_type: PatientType;
    student_id?: string;
    faculty_id?: string;
    visit_type: VisitType;
}

export interface CreateTriageAssessmentInput {
    consultation_id: string;
    temperature?: number;
    blood_pressure?: string;
    heart_rate?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
    symptoms?: string;
    triage_level?: 'red' | 'yellow' | 'green';
    notes?: string;
}

export interface CreateConsultationInput {
    visit_id: string;
    appointment_id?: string;
    doctor_id?: string;
    nurse_id?: string;
    chief_complaint?: string;
}

export interface CreatePrescriptionInput {
    consultation_id: string;
    medicine_id: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    quantity: number;
    instructions?: string;
}

export interface CreateAppointmentInput {
    patient_type: PatientType;
    student_id?: string;
    faculty_id?: string;
    reason: string;
    symptoms?: string;
}

export interface CreateIncidentInput {
    patient_type: PatientType;
    student_id?: string;
    faculty_id?: string;
    incident_type: IncidentType;
    description: string;
    location?: string;
    severity?: IncidentSeverity;
}

export interface CreateHealthClearanceInput {
    requester_type: RequesterType;
    student_id?: string;
    faculty_id?: string;
    purpose?: string;
}

export interface CreateHealthProgramInput {
    name: string;
    description?: string;
    program_type: ProgramType;
    start_date?: string;
    end_date?: string;
    managed_by?: string;
}

// Dashboard view models. These are presentation DTOs used while a dashboard
// is populated from server-side aggregates rather than raw database rows.
export interface DashboardStats {
    patientsToday: number;
    patientsTodayChange: number;
    consultations: number;
    consultationsChange: number;
    emergencyCases: number;
    emergencyCasesChange: number;
    lowStockAlerts: number;
    lowStockAlertsChange: number;
}

export interface DashboardAppointment {
    id: string;
    patient_name: string;
    time: string;
    type: string;
    status: string;
}

export interface DashboardConsultation {
    id: string;
    patient_name: string;
    student_complaint: string;
    time: string;
    status: string;
}

export interface InventoryAlert {
    id: string;
    medicine_name: string;
    current_stock: number;
    minimum_stock: number;
    severity: "warning" | "critical";
}

export interface EmergencyCase {
    id: string;
    patient_name: string;
    complaint: string;
    time: string;
    priority: "high" | "critical";
}

export interface DashboardNotification {
    id: string;
    title: string;
    message: string;
    type: "warning" | "danger" | "info";
    time: string;
}

export interface Activity {
    id: string;
    action: string;
    user: string;
    time: string;
}

export interface ConsultationTrend {
    date: string;
    count: number;
}
