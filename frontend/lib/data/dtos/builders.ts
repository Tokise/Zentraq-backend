// ============================================
// ZenTraq DTO Builders
// Based on SAD §13.3 Server Action Standards - Return DTOs only
// ============================================

import type {
    Student,
    Faculty,
    ClinicVisit,
    Consultation,
    TriageAssessment,
    Diagnosis,
    Treatment,
    FollowUp,
    Medicine,
    MedicineStock,
    Prescription,
    DispensingLog,
    RestockRequest,
    Appointment,
    AppointmentAIEvaluation,
    Incident,
    IncidentResponse,
    IncidentFollowup,
    HealthClearance,
    ClearanceEvaluation,
    ClearanceCertificate,
    HealthProgram,
    ProgramParticipant,
    ProgramScreening,
    Notification,
    AuditLog,
    AILog,
    // DTO types
    StudentPublicDTO,
    StudentSensitiveDTO,
    FacultyPublicDTO,
    FacultySensitiveDTO,
    ConsultationDTO,
    TriageAssessmentDTO,
    DiagnosisDTO,
    TreatmentDTO,
    PrescriptionDTO,
    AppointmentDTO,
    AppointmentAIEvaluationDTO,
    MedicineDTO,
    IncidentDTO,
    HealthClearanceDTO,
    ClearanceEvaluationDTO,
    ClearanceCertificateDTO,
    NotificationDTO,
    AuditLogDTO,
    AILogDTO,
} from '@/types';

// Masking functions imported for reference but DTOs built directly
// import { createStudentPublicDTO, createFacultyPublicDTO } from '@/lib/data/masks/field-masks';

// ──────────────────────────────────────────────
// Student DTO Builders
// ──────────────────────────────────────────────

export function toStudentPublicDTO(student: Student): StudentPublicDTO {
    return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        department: student.department,
        course: student.course,
        year_level: student.year_level,
        status: student.status,
        profile_photo_url: student.profile_photo_url,
    };
}

export function toStudentSensitiveDTO(
    student: Student,
    medicalHistory: Array<{ id: string; condition_name: string; diagnosed_date: string | null; status: string; notes: string | null }> = [],
    allergies: Array<{ id: string; allergen: string; reaction: string | null; severity: string | null; notes: string | null }> = [],
    medications: Array<{ id: string; medicine_name: string; dosage: string | null; frequency: string | null; start_date: string | null; end_date: string | null }> = [],
    immunizations: Array<{ id: string; vaccine_name: string; administered_date: string | null; dose_number: number | null; lot_number: string | null }> = []
): StudentSensitiveDTO {
    return {
        ...toStudentPublicDTO(student),
        student_number: student.student_number,
        email: student.email,
        phone: student.phone,
        address: student.address,
        birth_date: student.birth_date,
        gender: student.gender,
        blood_type: student.blood_type,
        emergency_contact_name: student.emergency_contact_name,
        emergency_contact_phone: student.emergency_contact_phone,
        guardian_name: student.guardian_name,
        guardian_phone: student.guardian_phone,
        rfid_uid: student.rfid_uid,
        medical_history: medicalHistory.map(toStudentMedicalHistoryDTO),
        allergies: allergies.map(toStudentAllergyDTO),
        medications: medications.map(toStudentMedicationDTO),
        immunizations: immunizations.map(toStudentImmunizationDTO),
    };
}

function toStudentMedicalHistoryDTO(h: { id: string; condition_name: string; diagnosed_date: string | null; status: string; notes: string | null }) {
    return {
        id: h.id,
        condition_name: h.condition_name,
        diagnosed_date: h.diagnosed_date,
        status: h.status,
        notes: h.notes,
    };
}

function toStudentAllergyDTO(a: { id: string; allergen: string; reaction: string | null; severity: string | null; notes: string | null }) {
    return {
        id: a.id,
        allergen: a.allergen,
        reaction: a.reaction,
        severity: a.severity,
        notes: a.notes,
    };
}

function toStudentMedicationDTO(m: { id: string; medicine_name: string; dosage: string | null; frequency: string | null; start_date: string | null; end_date: string | null }) {
    return {
        id: m.id,
        medicine_name: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        start_date: m.start_date,
        end_date: m.end_date,
    };
}

function toStudentImmunizationDTO(i: { id: string; vaccine_name: string; administered_date: string | null; dose_number: number | null; lot_number: string | null }) {
    return {
        id: i.id,
        vaccine_name: i.vaccine_name,
        administered_date: i.administered_date,
        dose_number: i.dose_number,
        lot_number: i.lot_number,
    };
}

// ──────────────────────────────────────────────
// Faculty DTO Builders
// ──────────────────────────────────────────────

export function toFacultyPublicDTO(faculty: Faculty): FacultyPublicDTO {
    return {
        id: faculty.id,
        first_name: faculty.first_name,
        last_name: faculty.last_name,
        department: faculty.department,
        position: faculty.position,
        status: faculty.status,
    };
}

export function toFacultySensitiveDTO(
    faculty: Faculty,
    medicalHistory: Array<{ id: string; condition_name: string; diagnosed_date: string | null; status: string; notes: string | null }> = [],
    allergies: Array<{ id: string; allergen: string; reaction: string | null; severity: string | null; notes: string | null }> = [],
    medications: Array<{ id: string; medicine_name: string; dosage: string | null; frequency: string | null; start_date: string | null; end_date: string | null }> = []
): FacultySensitiveDTO {
    return {
        ...toFacultyPublicDTO(faculty),
        employee_number: faculty.employee_number,
        email: faculty.email,
        phone: faculty.phone,
        address: faculty.address,
        rfid_uid: faculty.rfid_uid,
        medical_history: medicalHistory.map(toFacultyMedicalHistoryDTO),
        allergies: allergies.map(toFacultyAllergyDTO),
        medications: medications.map(toFacultyMedicationDTO),
    };
}

function toFacultyMedicalHistoryDTO(h: { id: string; condition_name: string; diagnosed_date: string | null; status: string; notes: string | null }) {
    return {
        id: h.id,
        condition_name: h.condition_name,
        diagnosed_date: h.diagnosed_date,
        status: h.status,
        notes: h.notes,
    };
}

function toFacultyAllergyDTO(a: { id: string; allergen: string; reaction: string | null; severity: string | null; notes: string | null }) {
    return {
        id: a.id,
        allergen: a.allergen,
        reaction: a.reaction,
        severity: a.severity,
        notes: a.notes,
    };
}

function toFacultyMedicationDTO(m: { id: string; medicine_name: string; dosage: string | null; frequency: string | null; start_date: string | null; end_date: string | null }) {
    return {
        id: m.id,
        medicine_name: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        start_date: m.start_date,
        end_date: m.end_date,
    };
}

// ──────────────────────────────────────────────
// Consultation DTO Builders
// ──────────────────────────────────────────────

export function toConsultationDTO(
    consultation: Consultation & {
        visit?: ClinicVisit;
        doctor?: { display_name: string };
        nurse?: { display_name: string };
        triage?: TriageAssessment;
        diagnoses?: Diagnosis[];
        treatments?: Treatment[];
        prescriptions?: (Prescription & { medicine?: Medicine })[];
    }
): ConsultationDTO {
    return {
        id: consultation.id,
        visit_id: consultation.visit_id,
        patient_complaint: consultation.patient_complaint,
        consultation_notes: consultation.consultation_notes,
        status: consultation.status,
        created_at: consultation.created_at,
        completed_at: consultation.completed_at,
        doctor_name: consultation.doctor?.display_name || null,
        nurse_name: consultation.nurse?.display_name || null,
        triage: consultation.triage ? toTriageAssessmentDTO(consultation.triage) : null,
        diagnoses: consultation.diagnoses?.map(toDiagnosisDTO) || [],
        treatments: consultation.treatments?.map(toTreatmentDTO) || [],
        prescriptions: consultation.prescriptions?.map(toPrescriptionDTO) || [],
    };
}

export function toTriageAssessmentDTO(triage: TriageAssessment): TriageAssessmentDTO {
    return {
        id: triage.id,
        temperature: triage.temperature,
        blood_pressure: triage.blood_pressure,
        heart_rate: triage.heart_rate,
        respiratory_rate: triage.respiratory_rate,
        oxygen_saturation: triage.oxygen_saturation,
        weight: triage.weight,
        height: triage.height,
        symptoms: triage.symptoms,
        triage_level: triage.triage_level,
        notes: triage.notes,
        created_at: triage.created_at,
    };
}

export function toDiagnosisDTO(diagnosis: Diagnosis): DiagnosisDTO {
    return {
        id: diagnosis.id,
        icd10_code: diagnosis.icd10_code,
        description: diagnosis.description,
        is_primary: diagnosis.is_primary,
    };
}

export function toTreatmentDTO(treatment: Treatment): TreatmentDTO {
    return {
        id: treatment.id,
        treatment_plan: treatment.treatment_plan,
        instructions: treatment.instructions,
        follow_up_days: treatment.follow_up_days,
    };
}

export function toPrescriptionDTO(prescription: Prescription & { medicine?: Medicine }): PrescriptionDTO {
    return {
        id: prescription.id,
        medicine_name: prescription.medicine?.generic_name || 'Unknown',
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration_days: prescription.duration_days,
        quantity: prescription.quantity,
        instructions: prescription.instructions,
        status: prescription.status,
    };
}

// ──────────────────────────────────────────────
// Appointment DTO Builders
// ──────────────────────────────────────────────

export function toAppointmentDTO(
    appointment: Appointment & {
        student?: Student;
        faculty?: Faculty;
        doctor?: { display_name: string };
        ai_evaluation?: AppointmentAIEvaluation;
    }
): AppointmentDTO {
    const patient = appointment.student || appointment.faculty;
    return {
        id: appointment.id,
        patient_type: appointment.patient_type,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown',
        patient_identifier: appointment.student?.student_number || appointment.faculty?.employee_number || '',
        reason: appointment.reason,
        symptoms: appointment.symptoms,
        priority: appointment.priority,
        scheduled_date: appointment.scheduled_date,
        scheduled_time: appointment.scheduled_time,
        status: appointment.status,
        doctor_name: appointment.doctor?.display_name || null,
        ai_evaluation: appointment.ai_evaluation ? toAppointmentAIEvaluationDTO(appointment.ai_evaluation) : null,
        created_at: appointment.created_at,
    };
}

export function toAppointmentAIEvaluationDTO(evaluation: AppointmentAIEvaluation): AppointmentAIEvaluationDTO {
    return {
        priority_score: evaluation.priority_score,
        recommended_slot: evaluation.recommended_slot,
        rationale: evaluation.rationale,
    };
}

// ──────────────────────────────────────────────
// Medicine DTO Builders
// ──────────────────────────────────────────────

export function toMedicineDTO(
    medicine: Medicine & {
        stock?: MedicineStock[];
    }
): MedicineDTO {
    const totalStock = medicine.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
    const nearestExpiry = medicine.stock?.reduce((nearest, s) => {
        if (!s.expiry_date) return nearest;
        if (!nearest) return s.expiry_date;
        return s.expiry_date < nearest ? s.expiry_date : nearest;
    }, null as string | null) || null;

    return {
        id: medicine.id,
        generic_name: medicine.generic_name,
        brand_name: medicine.brand_name,
        category: medicine.category,
        unit: medicine.unit,
        min_stock_level: medicine.min_stock_level,
        is_controlled: medicine.is_controlled,
        total_stock: totalStock,
        is_low_stock: totalStock <= medicine.min_stock_level,
        nearest_expiry: nearestExpiry,
    };
}

// ──────────────────────────────────────────────
// Incident DTO Builders
// ──────────────────────────────────────────────

export function toIncidentDTO(
    incident: Incident & {
        student?: Student;
        faculty?: Faculty;
        reporter?: { email: string };
    }
): IncidentDTO {
    const patient = incident.student || incident.faculty;
    return {
        id: incident.id,
        patient_type: incident.patient_type,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown',
        incident_type: incident.incident_type,
        description: incident.description,
        location: incident.location,
        severity: incident.severity,
        status: incident.status,
        reported_by_name: incident.reporter?.email || null,
        created_at: incident.created_at,
    };
}

// ──────────────────────────────────────────────
// Health Clearance DTO Builders
// ──────────────────────────────────────────────

export function toHealthClearanceDTO(
    clearance: HealthClearance & {
        student?: Student;
        faculty?: Faculty;
        evaluation?: ClearanceEvaluation & { doctor?: { display_name: string } };
        certificate?: ClearanceCertificate & { issuer?: { email: string } };
    }
): HealthClearanceDTO {
    const requester = clearance.student || clearance.faculty;
    return {
        id: clearance.id,
        requester_type: clearance.requester_type,
        requester_name: requester ? `${requester.first_name} ${requester.last_name}` : 'Unknown',
        purpose: clearance.purpose,
        status: clearance.status,
        expires_at: clearance.expires_at,
        evaluation: clearance.evaluation ? toClearanceEvaluationDTO(clearance.evaluation) : null,
        certificate: clearance.certificate ? toClearanceCertificateDTO(clearance.certificate) : null,
        created_at: clearance.created_at,
    };
}

export function toClearanceEvaluationDTO(evaluation: ClearanceEvaluation & { doctor?: { display_name: string } }): ClearanceEvaluationDTO {
    return {
        result: evaluation.result,
        medical_notes: evaluation.medical_notes,
        evaluated_at: evaluation.evaluated_at,
        doctor_name: evaluation.doctor?.display_name || null,
    };
}

export function toClearanceCertificateDTO(cert: ClearanceCertificate & { issuer?: { email: string } }): ClearanceCertificateDTO {
    return {
        certificate_number: cert.certificate_number,
        issued_at: cert.issued_at,
        issued_by_name: cert.issuer?.email || null,
    };
}

// ──────────────────────────────────────────────
// Notification DTO Builder
// ──────────────────────────────────────────────

export function toNotificationDTO(notification: Notification): NotificationDTO {
    return {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        entity_type: notification.entity_type,
        entity_id: notification.entity_id,
        read_at: notification.read_at,
        created_at: notification.created_at,
    };
}

// ──────────────────────────────────────────────
// Audit Log DTO Builder
// ──────────────────────────────────────────────

export function toAuditLogDTO(auditLog: AuditLog & { user?: { email: string } }): AuditLogDTO {
    return {
        id: auditLog.id,
        action: auditLog.action,
        entity_type: auditLog.entity_type,
        entity_id: auditLog.entity_id,
        user_email: auditLog.user?.email || null,
        ip_address: auditLog.ip_address,
        created_at: auditLog.created_at,
    };
}

// ──────────────────────────────────────────────
// AI Log DTO Builder
// ──────────────────────────────────────────────

export function toAILogDTO(aiLog: AILog): AILogDTO {
    return {
        id: aiLog.id,
        action_type: aiLog.action_type,
        entity_type: aiLog.entity_type,
        entity_id: aiLog.entity_id,
        status: aiLog.status,
        created_at: aiLog.created_at,
    };
}

// ──────────────────────────────────────────────
// Pagination Helper
// ──────────────────────────────────────────────

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export function createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number
): PaginatedResult<T> {
    return {
        data,
        total,
        page,
        page_size: pageSize,
        total_pages: Math.ceil(total / pageSize),
    };
}
