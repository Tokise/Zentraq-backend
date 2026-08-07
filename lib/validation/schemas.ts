// ============================================
// ZenTraq Zod Validation Schemas
// Based on SAD §13.3 Server Action Standards - Input Validation
// ============================================

import { z } from 'zod';

// ──────────────────────────────────────────────
// Common Schemas
// ──────────────────────────────────────────────

export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const PaginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
});

export const DateRangeSchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});

/**
 * Validates that the correct patient reference (student_id or faculty_id)
 * is provided based on the patient_type field.
 */
export function validatePatientReference(
    patient_type: 'student' | 'faculty',
    student_id?: string | null,
    faculty_id?: string | null
): string | null {
    if (patient_type === 'student' && !student_id) {
        return 'student_id is required when patient_type is "student"';
    }
    if (patient_type === 'faculty' && !faculty_id) {
        return 'faculty_id is required when patient_type is "faculty"';
    }
    return null;
}

// ──────────────────────────────────────────────
// Student Schemas
// ──────────────────────────────────────────────

export const CreateStudentSchema = z.object({
    student_number: z.string().min(1, 'Student number is required').max(50),
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    middle_name: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
    course: z.string().max(100).optional(),
    year_level: z.number().int().min(1).max(10).optional(),
    section: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    birth_date: z.string().date().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    blood_type: z.enum(['A+' as const, 'A-' as const, 'B+' as const, 'B-' as const, 'AB+' as const, 'AB-' as const, 'O+' as const, 'O-' as const]).optional(),
    emergency_contact_name: z.string().max(100).optional(),
    emergency_contact_phone: z.string().max(20).optional(),
    guardian_name: z.string().max(100).optional(),
    guardian_phone: z.string().max(20).optional(),
    rfid_uid: z.string().max(50).optional(),
});

export const UpdateStudentSchema = CreateStudentSchema.partial();

export const StudentMedicalHistorySchema = z.object({
    student_id: UUIDSchema,
    condition_name: z.string().min(1, 'Condition name is required').max(200),
    diagnosed_date: z.string().date().optional(),
    status: z.enum(['active', 'resolved', 'chronic']).default('active'),
    notes: z.string().max(2000).optional(),
});

export const StudentAllergySchema = z.object({
    student_id: UUIDSchema,
    allergen: z.string().min(1, 'Allergen is required').max(200),
    reaction: z.string().max(500).optional(),
    severity: z.enum(['mild', 'moderate', 'severe']).optional(),
    notes: z.string().max(1000).optional(),
});

export const StudentMedicationSchema = z.object({
    student_id: UUIDSchema,
    medicine_name: z.string().min(1, 'Medicine name is required').max(200),
    dosage: z.string().max(100).optional(),
    frequency: z.string().max(100).optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    prescribed_by: UUIDSchema.optional(),
    notes: z.string().max(1000).optional(),
});

export const StudentImmunizationSchema = z.object({
    student_id: UUIDSchema,
    vaccine_name: z.string().min(1, 'Vaccine name is required').max(200),
    administered_date: z.string().date().optional(),
    dose_number: z.number().int().min(1).optional(),
    lot_number: z.string().max(100).optional(),
    administered_by: UUIDSchema.optional(),
    notes: z.string().max(1000).optional(),
});

// ──────────────────────────────────────────────
// Faculty Schemas
// ──────────────────────────────────────────────

export const CreateFacultySchema = z.object({
    employee_number: z.string().min(1, 'Employee number is required').max(50),
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    middle_name: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
    position: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    rfid_uid: z.string().max(50).optional(),
});

export const UpdateFacultySchema = CreateFacultySchema.partial();

export const FacultyMedicalHistorySchema = z.object({
    faculty_id: UUIDSchema,
    condition_name: z.string().min(1, 'Condition name is required').max(200),
    diagnosed_date: z.string().date().optional(),
    status: z.enum(['active', 'resolved', 'chronic']).default('active'),
    notes: z.string().max(2000).optional(),
});

export const FacultyAllergySchema = z.object({
    faculty_id: UUIDSchema,
    allergen: z.string().min(1, 'Allergen is required').max(200),
    reaction: z.string().max(500).optional(),
    severity: z.enum(['mild', 'moderate', 'severe']).optional(),
    notes: z.string().max(1000).optional(),
});

export const FacultyMedicationSchema = z.object({
    faculty_id: UUIDSchema,
    medicine_name: z.string().min(1, 'Medicine name is required').max(200),
    dosage: z.string().max(100).optional(),
    frequency: z.string().max(100).optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    prescribed_by: UUIDSchema.optional(),
    notes: z.string().max(1000).optional(),
});

// ──────────────────────────────────────────────
// Clinic Visit & Consultation Schemas
// ──────────────────────────────────────────────

export const CreateClinicVisitSchema = z.object({
    patient_type: z.enum(['student', 'faculty']),
    student_id: UUIDSchema.optional(),
    faculty_id: UUIDSchema.optional(),
    visit_type: z.enum(['walk-in', 'appointment', 'rfid']),
});

export const CreateTriageAssessmentSchema = z.object({
    consultation_id: UUIDSchema,
    temperature: z.number().min(30).max(45).optional(),
    blood_pressure: z.string().max(20).optional(),
    heart_rate: z.number().int().min(30).max(250).optional(),
    respiratory_rate: z.number().int().min(5).max(60).optional(),
    oxygen_saturation: z.number().int().min(50).max(100).optional(),
    weight: z.number().min(1).max(300).optional(),
    height: z.number().min(30).max(250).optional(),
    symptoms: z.string().max(2000).optional(),
    triage_level: z.enum(['red', 'yellow', 'green']).optional(),
    notes: z.string().max(2000).optional(),
});

export const CreateConsultationSchema = z.object({
    visit_id: UUIDSchema,
    appointment_id: UUIDSchema.optional(),
    doctor_id: UUIDSchema.optional(),
    nurse_id: UUIDSchema.optional(),
    chief_complaint: z.string().max(1000).optional(),
});

export const UpdateConsultationSchema = z.object({
    chief_complaint: z.string().max(1000).optional(),
    consultation_notes: z.string().max(5000).optional(),
    status: z.enum(['in-progress', 'completed']).optional(),
});

export const SetVitalsDispositionSchema = z.object({
    consultation_id: UUIDSchema,
    disposition: z.enum(['required', 'not_required']),
    skip_reason: z.string().trim().min(3).max(500).optional(),
}).superRefine((value, context) => {
    if (value.disposition === 'not_required' && !value.skip_reason) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['skip_reason'],
            message: 'A reason is required when vital signs are not needed',
        });
    }
});

export const ConsultationIdSchema = z.object({
    consultation_id: UUIDSchema,
});

export const DiagnosisSchema = z.object({
    consultation_id: UUIDSchema,
    icd10_code: z.string().max(20).optional(),
    description: z.string().max(500).optional(),
    is_primary: z.boolean().default(true),
});

export const TreatmentSchema = z.object({
    consultation_id: UUIDSchema,
    treatment_plan: z.string().max(2000).optional(),
    instructions: z.string().max(2000).optional(),
    follow_up_days: z.number().int().min(1).max(365).optional(),
});

export const FollowUpSchema = z.object({
    consultation_id: UUIDSchema,
    scheduled_date: z.string().date(),
    reason: z.string().max(500).optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
});

// ──────────────────────────────────────────────
// Pharmacy / Medicine Inventory Schemas
// ──────────────────────────────────────────────

export const CreateMedicineSchema = z.object({
    generic_name: z.string().min(1, 'Generic name is required').max(200),
    brand_name: z.string().max(200).optional(),
    category: z.string().max(100).optional(),
    unit: z.string().min(1, 'Unit is required').max(50),
    min_stock_level: z.number().int().min(0).default(10),
    is_controlled: z.boolean().default(false),
    is_active: z.boolean().default(true),
});

export const UpdateMedicineSchema = CreateMedicineSchema.partial();

export const CreateMedicineStockSchema = z.object({
    medicine_id: UUIDSchema,
    quantity: z.number().int().min(0),
    batch_number: z.string().max(100).optional(),
    expiry_date: z.string().date().optional(),
    location: z.string().max(100).optional(),
});

export const UpdateMedicineStockSchema = z.object({
    quantity: z.number().int().min(0).optional(),
    batch_number: z.string().max(100).optional(),
    expiry_date: z.string().date().optional(),
    location: z.string().max(100).optional(),
});

export const CreatePrescriptionSchema = z.object({
    quantity: z.number().int().min(1),
    instructions: z.string().max(1000).optional(),
});

export const UpdatePrescriptionSchema = z.object({
    status: z.enum(['pending', 'dispensed', 'cancelled']).optional(),
    dosage: z.string().max(100).optional(),
    frequency: z.string().max(100).optional(),
    duration_days: z.number().int().min(1).max(365).optional(),
    quantity: z.number().int().min(1).optional(),
    instructions: z.string().max(1000).optional(),
});

export const DispenseMedicineSchema = z.object({
    prescription_id: UUIDSchema,
    medicine_stock_id: UUIDSchema,
    quantity: z.number().int().min(1),
});

export const CreateRestockRequestSchema = z.object({
    medicine_id: UUIDSchema,
    quantity: z.number().int().min(1),
    supplier_id: UUIDSchema.optional(),
});

export const UpdateRestockRequestSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'fulfilled']),
    approved_by: UUIDSchema.optional(),
    supplier_id: UUIDSchema.optional(),
});

// ──────────────────────────────────────────────
// Appointment Schemas
// ──────────────────────────────────────────────

export const CreateAppointmentSchema = z.object({
    patient_type: z.enum(['student', 'faculty', 'staff']),
    student_id: UUIDSchema.optional(),
    faculty_id: UUIDSchema.optional(),
    reason: z.string().min(1, 'Reason is required').max(500),
    symptoms: z.string().max(2000).optional(),
}).refine(
    (data) => (data.patient_type === 'student' && data.student_id) ||
        (data.patient_type === 'faculty' && data.faculty_id) ||
        (data.patient_type === 'staff' && data.faculty_id),
    { message: 'Either student_id or faculty_id is required based on patient_type', path: ['patient_type'] }
);

export const UpdateAppointmentSchema = z.object({
    doctor_id: UUIDSchema.optional(),
    reason: z.string().max(500).optional(),
    symptoms: z.string().max(2000).optional(),
    priority: z.number().int().min(1).max(5).optional(),
    scheduled_date: z.string().date().optional(),
    scheduled_time: z.string().time().optional(),
    status: z.enum([
        'pending', 'ai_evaluated', 'recommended', 'approved', 'rejected',
        'scheduled', 'reminded', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'
    ]).optional(),
});

export const AppointmentAIEvaluationSchema = z.object({
    appointment_id: UUIDSchema,
    priority_score: z.number().int().min(1).max(5).optional(),
    recommended_slot: z.string().max(100).optional(),
    rationale: z.string().max(1000).optional(),
    ai_log_id: UUIDSchema.optional(),
});

export const AppointmentRecommendationSchema = z.object({
    appointment_id: UUIDSchema,
    recommendation: z.enum(['approve', 'reject', 'reschedule']),
    notes: z.string().max(1000).optional(),
    recommended_date: z.string().date().optional(),
    recommended_time: z.string().time().optional(),
});

export const AppointmentReviewSchema = z.object({
    appointment_id: UUIDSchema,
    decision: z.enum(['approved', 'rejected']),
    rejection_reason: z.string().max(1000).optional(),
});

export const AppointmentCheckinSchema = z.object({
    appointment_id: UUIDSchema,
    rfid_uid: z.string().max(50).optional(),
});

// ──────────────────────────────────────────────
// Incident Schemas
// ──────────────────────────────────────────────

export const CreateIncidentSchema = z.object({
    patient_type: z.enum(['student', 'faculty']),
    student_id: UUIDSchema.optional(),
    faculty_id: UUIDSchema.optional(),
    incident_type: z.enum(['injury', 'illness', 'emergency']),
    description: z.string().min(1, 'Description is required').max(3000),
    location: z.string().max(200).optional(),
    severity: z.enum(['minor', 'moderate', 'severe', 'critical']).optional(),
}).refine(
    (data) => (data.patient_type === 'student' && data.student_id) ||
        (data.patient_type === 'faculty' && data.faculty_id),
    { message: 'Either student_id or faculty_id is required based on patient_type', path: ['patient_type'] }
);

export const UpdateIncidentSchema = z.object({
    incident_type: z.enum(['injury', 'illness', 'emergency']).optional(),
    description: z.string().max(3000).optional(),
    location: z.string().max(200).optional(),
    severity: z.enum(['minor', 'moderate', 'severe', 'critical']).optional(),
    status: z.enum(['open', 'in-progress', 'closed']).optional(),
});

export const IncidentResponseSchema = z.object({
    incident_id: UUIDSchema,
    action_taken: z.string().min(1, 'Action taken is required').max(3000),
});

export const IncidentFollowupSchema = z.object({
    incident_id: UUIDSchema,
    follow_up_date: z.string().date().optional(),
    notes: z.string().max(2000).optional(),
    completed: z.boolean().default(false),
});

// ──────────────────────────────────────────────
// Health Clearance Schemas
// ──────────────────────────────────────────────

export const CreateHealthClearanceSchema = z.object({
    requester_type: z.enum(['student', 'faculty', 'staff']),
    student_id: UUIDSchema.optional(),
    faculty_id: UUIDSchema.optional(),
    purpose: z.string().max(500).optional(),
}).refine(
    (data) => (data.requester_type === 'student' && data.student_id) ||
        (data.requester_type === 'faculty' && data.faculty_id) ||
        (data.requester_type === 'staff' && data.faculty_id),
    { message: 'Either student_id or faculty_id is required based on requester_type', path: ['requester_type'] }
);

export const UpdateHealthClearanceSchema = z.object({
    purpose: z.string().max(500).optional(),
    status: z.enum(['pending', 'evaluating', 'approved', 'rejected']).optional(),
    expires_at: z.string().date().optional(),
});

export const ClearanceRequestSchema = z.object({
    clearance_id: UUIDSchema,
    request_details: z.string().max(2000).optional(),
    status: z.enum(['submitted', 'processing', 'evaluated', 'completed']).default('submitted'),
});

export const ClearanceEvaluationSchema = z.object({
    clearance_id: UUIDSchema,
    result: z.enum(['fit', 'unfit', 'conditional']),
    medical_notes: z.string().max(3000).optional(),
});

export const IssueCertificateSchema = z.object({
    clearance_id: UUIDSchema,
    certificate_number: z.string().min(1, 'Certificate number is required').max(100),
});

// ──────────────────────────────────────────────
// Health Program Schemas
// ──────────────────────────────────────────────

export const CreateHealthProgramSchema = z.object({
    name: z.string().min(1, 'Program name is required').max(200),
    description: z.string().max(2000).optional(),
    program_type: z.enum(['immunization', 'screening', 'wellness']),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    managed_by: UUIDSchema.optional(),
});

export const UpdateHealthProgramSchema = CreateHealthProgramSchema.partial();

export const EnrollParticipantSchema = z.object({
    program_id: UUIDSchema,
    patient_type: z.enum(['student', 'faculty']),
    student_id: UUIDSchema.optional(),
    faculty_id: UUIDSchema.optional(),
}).refine(
    (data) => (data.patient_type === 'student' && data.student_id) ||
        (data.patient_type === 'faculty' && data.faculty_id),
    { message: 'Either student_id or faculty_id is required based on patient_type', path: ['patient_type'] }
);

export const ProgramScreeningSchema = z.object({
    participant_id: UUIDSchema,
    screening_type: z.string().min(1, 'Screening type is required').max(200),
    result: z.string().max(1000).optional(),
    performed_by: UUIDSchema.optional(),
});

export const ProgramImmunizationSchema = z.object({
    participant_id: UUIDSchema,
    vaccine_name: z.string().min(1, 'Vaccine name is required').max(200),
    dose_number: z.number().int().min(1).optional(),
    administered_date: z.string().date().optional(),
    administered_by: UUIDSchema.optional(),
    lot_number: z.string().max(100).optional(),
});

// ──────────────────────────────────────────────
// Notification Schemas
// ──────────────────────────────────────────────

export const CreateNotificationSchema = z.object({
    sender_id: UUIDSchema.optional(),
    receiver_id: UUIDSchema,
    title: z.string().min(1, 'Title is required').max(200),
    message: z.string().min(1, 'Message is required').max(2000),
    type: z.enum(['appointment', 'clearance', 'inventory', 'incident', 'system']),
    entity_type: z.string().max(100).optional(),
    entity_id: UUIDSchema.optional(),
});

export const MarkNotificationReadSchema = z.object({
    notification_id: UUIDSchema,
});

// ──────────────────────────────────────────────
// User Management Schemas
// ──────────────────────────────────────────────

export const CreateUserSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['admin', 'doctor', 'nurse', 'student', 'faculty']),
    // Role-specific fields
    student_number: z.string().optional(),
    employee_number: z.string().optional(),
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    // Optional fields
    department: z.string().max(100).optional(),
    course: z.string().max(100).optional(),
    year_level: z.number().int().min(1).max(10).optional(),
    position: z.string().max(100).optional(),
    license_number: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
});

export const AssignRoleSchema = z.object({
    user_id: UUIDSchema,
    role_id: UUIDSchema,
});

export const RevokeSessionSchema = z.object({
    session_id: UUIDSchema,
});

// ──────────────────────────────────────────────
// RFID Schemas
// ──────────────────────────────────────────────

export const RFIDCheckinSchema = z.object({
    rfid_uid: z.string().min(1, 'RFID UID is required').max(50),
});

export const RegisterRFIDSchema = z.object({
    user_id: UUIDSchema,
    rfid_uid: z.string().min(1, 'RFID UID is required').max(50),
    patient_type: z.enum(['student', 'faculty']),
});

// ──────────────────────────────────────────────
// Report/Analytics Schemas
// ──────────────────────────────────────────────

export const GenerateReportSchema = z.object({
    report_type: z.enum(['operational', 'medical', 'compliance', 'ai-insights']),
    parameters: z.record(z.string(), z.unknown()).optional(),
    date_range: DateRangeSchema.optional(),
});

export const ExportReportSchema = z.object({
    report_id: UUIDSchema,
    format: z.enum(['pdf', 'csv']),
});

// ──────────────────────────────────────────────
// Type Exports
// ──────────────────────────────────────────────

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
export type CreateFacultyInput = z.infer<typeof CreateFacultySchema>;
export type UpdateFacultyInput = z.infer<typeof UpdateFacultySchema>;
export type CreateClinicVisitInput = z.infer<typeof CreateClinicVisitSchema>;
export type CreateTriageAssessmentInput = z.infer<typeof CreateTriageAssessmentSchema>;
export type CreateConsultationInput = z.infer<typeof CreateConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof UpdateConsultationSchema>;
export type CreateMedicineInput = z.infer<typeof CreateMedicineSchema>;
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentSchema>;
export type CreateHealthClearanceInput = z.infer<typeof CreateHealthClearanceSchema>;
export type CreateHealthProgramInput = z.infer<typeof CreateHealthProgramSchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type RFIDCheckinInput = z.infer<typeof RFIDCheckinSchema>;
