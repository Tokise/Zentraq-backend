// ============================================
// ZenTraq Supabase Query Helpers
// Based on SAD §13.4 Database Standards - Never SELECT *
// ============================================

import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Column Selection Constants (Data Minimization)
// ──────────────────────────────────────────────

export const STUDENT_PUBLIC_COLUMNS = `
  id,
  student_number,
  first_name,
  last_name,
  middle_name,
  department,
  course,
  year_level,
  section,
  status,
  profile_photo_url,
  created_at,
  updated_at
`;

export const STUDENT_SENSITIVE_COLUMNS = `
  ${STUDENT_PUBLIC_COLUMNS},
  user_id,
  phone,
  email,
  address,
  birth_date,
  gender,
  blood_type,
  emergency_contact_name,
  emergency_contact_phone,
  guardian_name,
  guardian_phone,
  rfid_uid
`;

export const FACULTY_PUBLIC_COLUMNS = `
  id,
  employee_number,
  first_name,
  last_name,
  middle_name,
  department,
  position,
  status,
  created_at,
  updated_at
`;

export const FACULTY_SENSITIVE_COLUMNS = `
  ${FACULTY_PUBLIC_COLUMNS},
  user_id,
  phone,
  email,
  address,
  rfid_uid
`;

export const CLINIC_ACCOUNT_COLUMNS = `
  id,
  user_id,
  role,
  display_name,
  license_number,
  is_active,
  created_at,
  updated_at
`;

export const CLINIC_VISIT_COLUMNS = `
  id,
  patient_type,
  student_id,
  faculty_id,
  visit_type,
  check_in_time,
  check_out_time,
  status,
  created_by,
  created_at,
  updated_at
`;

export const CONSULTATION_COLUMNS = `
  id,
  visit_id,
  appointment_id,
  doctor_id,
  nurse_id,
  chief_complaint,
  consultation_notes,
  status,
  created_at,
  completed_at,
  updated_at
`;

export const TRIAGE_ASSESSMENT_COLUMNS = `
  id,
  consultation_id,
  nurse_id,
  temperature,
  blood_pressure,
  heart_rate,
  respiratory_rate,
  oxygen_saturation,
  weight,
  height,
  symptoms,
  triage_level,
  notes,
  created_at
`;

export const DIAGNOSIS_COLUMNS = `
  id,
  consultation_id,
  icd10_code,
  description,
  is_primary,
  created_by,
  created_at
`;

export const TREATMENT_COLUMNS = `
  id,
  consultation_id,
  treatment_plan,
  instructions,
  follow_up_days,
  created_by,
  created_at
`;

export const FOLLOW_UP_COLUMNS = `
  id,
  consultation_id,
  scheduled_date,
  reason,
  status,
  completed_at,
  created_at
`;

export const MEDICINE_COLUMNS = `
  id,
  generic_name,
  brand_name,
  category,
  unit,
  min_stock_level,
  is_controlled,
  is_active,
  created_at,
  updated_at
`;

export const MEDICINE_STOCK_COLUMNS = `
  id,
  medicine_id,
  quantity,
  batch_number,
  expiry_date,
  location,
  updated_at
`;

export const PRESCRIPTION_COLUMNS = `
  id,
  consultation_id,
  medicine_id,
  dosage,
  frequency,
  duration_days,
  quantity,
  instructions,
  prescribed_by,
  status,
  created_at,
  updated_at
`;

export const DISPENSING_LOG_COLUMNS = `
  id,
  prescription_id,
  medicine_stock_id,
  dispensed_by,
  quantity,
  dispensed_at
`;

export const RESTOCK_REQUEST_COLUMNS = `
  id,
  medicine_id,
  quantity,
  requested_by,
  status,
  approved_by,
  supplier_id,
  created_at,
  updated_at
`;

export const APPOINTMENT_COLUMNS = `
  id,
  patient_type,
  student_id,
  faculty_id,
  doctor_id,
  reason,
  symptoms,
  priority,
  scheduled_date,
  scheduled_time,
  status,
  created_at,
  updated_at
`;

export const APPOINTMENT_AI_EVAL_COLUMNS = `
  id,
  appointment_id,
  priority_score,
  recommended_slot,
  rationale,
  ai_log_id,
  created_at
`;

export const APPOINTMENT_REMINDER_COLUMNS = `
  id,
  appointment_id,
  remind_at,
  sent_at,
  status,
  created_at
`;

export const APPOINTMENT_CHECKIN_COLUMNS = `
  id,
  appointment_id,
  rfid_uid,
  check_in_time
`;

export const INCIDENT_COLUMNS = `
  id,
  patient_type,
  student_id,
  faculty_id,
  incident_type,
  description,
  location,
  severity,
  status,
  reported_by,
  created_at,
  updated_at
`;

export const INCIDENT_RESPONSE_COLUMNS = `
  id,
  incident_id,
  action_taken,
  responder_id,
  response_time
`;

export const INCIDENT_FOLLOWUP_COLUMNS = `
  id,
  incident_id,
  follow_up_date,
  notes,
  completed,
  created_at
`;

export const HEALTH_CLEARANCE_COLUMNS = `
  id,
  requester_type,
  student_id,
  faculty_id,
  purpose,
  status,
  expires_at,
  created_at,
  updated_at
`;

export const CLEARANCE_REQUEST_COLUMNS = `
  id,
  clearance_id,
  requested_by,
  request_details,
  status,
  created_at,
  updated_at
`;

export const CLEARANCE_EVALUATION_COLUMNS = `
  id,
  clearance_id,
  doctor_id,
  result,
  medical_notes,
  evaluated_at
`;

export const CLEARANCE_CERTIFICATE_COLUMNS = `
  id,
  clearance_id,
  certificate_number,
  issued_by,
  issued_at
`;

export const HEALTH_PROGRAM_COLUMNS = `
  id,
  name,
  description,
  program_type,
  start_date,
  end_date,
  is_active,
  managed_by,
  created_at,
  updated_at
`;

export const PROGRAM_PARTICIPANT_COLUMNS = `
  id,
  program_id,
  patient_type,
  student_id,
  faculty_id,
  enrolled_at
`;

export const PROGRAM_SCREENING_COLUMNS = `
  id,
  participant_id,
  screening_type,
  result,
  performed_by,
  screened_at
`;

export const PROGRAM_IMMUNIZATION_COLUMNS = `
  id,
  participant_id,
  vaccine_name,
  dose_number,
  administered_date,
  administered_by,
  lot_number,
  created_at
`;

export const NOTIFICATION_COLUMNS = `
  id,
  sender_id,
  receiver_id,
  title,
  message,
  type,
  entity_type,
  entity_id,
  read_at,
  created_at
`;

export const AUDIT_LOG_COLUMNS = `
  id,
  user_id,
  action,
  entity_type,
  entity_id,
  metadata,
  ip_address,
  user_agent,
  created_at
`;

export const AI_LOG_COLUMNS = `
  id,
  user_id,
  action_type,
  entity_type,
  entity_id,
  prompt,
  response,
  status,
  created_at
`;

// ──────────────────────────────────────────────
// Query Builder Helpers
// ──────────────────────────────────────────────

/**
 * Gets a server-side Supabase client
 */
export async function getSupabase(): Promise<SupabaseClient> {
    const { createClient } = await import('@/utils/supabase/server');
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    return createClient(cookieStore);
}

/**
 * Builds a select query with explicit columns
 */
export function selectColumns(columns: string) {
    return columns.trim();
}

/**
 * Student Queries
 */
export const studentQueries = {
    async findById(supabase: SupabaseClient, id: string, includeSensitive = false) {
        const columns = includeSensitive ? STUDENT_SENSITIVE_COLUMNS : STUDENT_PUBLIC_COLUMNS;
        return supabase.from('students').select(columns).eq('id', id).single();
    },

    async findByUserId(supabase: SupabaseClient, userId: string, includeSensitive = false) {
        const columns = includeSensitive ? STUDENT_SENSITIVE_COLUMNS : STUDENT_PUBLIC_COLUMNS;
        return supabase.from('students').select(columns).eq('user_id', userId).single();
    },

    async findByRFID(supabase: SupabaseClient, rfidUid: string, includeSensitive = false) {
        const columns = includeSensitive ? STUDENT_SENSITIVE_COLUMNS : STUDENT_PUBLIC_COLUMNS;
        return supabase.from('students').select(columns).eq('rfid_uid', rfidUid).single();
    },

    async findByStudentNumber(supabase: SupabaseClient, studentNumber: string, includeSensitive = false) {
        const columns = includeSensitive ? STUDENT_SENSITIVE_COLUMNS : STUDENT_PUBLIC_COLUMNS;
        return supabase.from('students').select(columns).eq('student_number', studentNumber).single();
    },

    async list(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
        department?: string;
        course?: string;
        yearLevel?: number;
        status?: string;
        search?: string;
    }) {
        const { page = 1, pageSize = 20, department, course, yearLevel, status, search } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('students').select(STUDENT_PUBLIC_COLUMNS, { count: 'exact' });

        if (department) query = query.eq('department', department);
        if (course) query = query.eq('course', course);
        if (yearLevel) query = query.eq('year_level', yearLevel);
        if (status) query = query.eq('status', status);
        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,student_number.ilike.%${search}%`);
        }

        return query.range(from, to).order('last_name', { ascending: true });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('students').insert(data).select(STUDENT_SENSITIVE_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('students').update(data).eq('id', id).select(STUDENT_SENSITIVE_COLUMNS).single();
    },
};

/**
 * Faculty Queries
 */
export const facultyQueries = {
    async findById(supabase: SupabaseClient, id: string, includeSensitive = false) {
        const columns = includeSensitive ? FACULTY_SENSITIVE_COLUMNS : FACULTY_PUBLIC_COLUMNS;
        return supabase.from('faculty').select(columns).eq('id', id).single();
    },

    async findByUserId(supabase: SupabaseClient, userId: string, includeSensitive = false) {
        const columns = includeSensitive ? FACULTY_SENSITIVE_COLUMNS : FACULTY_PUBLIC_COLUMNS;
        return supabase.from('faculty').select(columns).eq('user_id', userId).single();
    },

    async findByRFID(supabase: SupabaseClient, rfidUid: string, includeSensitive = false) {
        const columns = includeSensitive ? FACULTY_SENSITIVE_COLUMNS : FACULTY_PUBLIC_COLUMNS;
        return supabase.from('faculty').select(columns).eq('rfid_uid', rfidUid).single();
    },

    async findByEmployeeNumber(supabase: SupabaseClient, employeeNumber: string, includeSensitive = false) {
        const columns = includeSensitive ? FACULTY_SENSITIVE_COLUMNS : FACULTY_PUBLIC_COLUMNS;
        return supabase.from('faculty').select(columns).eq('employee_number', employeeNumber).single();
    },

    async list(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
        department?: string;
        status?: string;
        search?: string;
    }) {
        const { page = 1, pageSize = 20, department, status, search } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('faculty').select(FACULTY_PUBLIC_COLUMNS, { count: 'exact' });

        if (department) query = query.eq('department', department);
        if (status) query = query.eq('status', status);
        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%`);
        }

        return query.range(from, to).order('last_name', { ascending: true });
    },
};

/**
 * Clinic Visit Queries
 */
export const clinicVisitQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('clinic_visits').select(CLINIC_VISIT_COLUMNS).eq('id', id).single();
    },

    async findByPatient(supabase: SupabaseClient, patientType: 'student' | 'faculty', patientId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
    }) {
        const { page = 1, pageSize = 20, status } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('clinic_visits').select(CLINIC_VISIT_COLUMNS, { count: 'exact' });

        if (patientType === 'student') {
            query = query.eq('patient_type', 'student').eq('student_id', patientId);
        } else {
            query = query.eq('patient_type', 'faculty').eq('faculty_id', patientId);
        }

        if (status) query = query.eq('status', status);

        return query.range(from, to).order('check_in_time', { ascending: false });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('clinic_visits').insert(data).select(CLINIC_VISIT_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('clinic_visits').update(data).eq('id', id).select(CLINIC_VISIT_COLUMNS).single();
    },
};

/**
 * Consultation Queries
 */
export const consultationQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('consultations').select(CONSULTATION_COLUMNS).eq('id', id).single();
    },

    async findByVisitId(supabase: SupabaseClient, visitId: string) {
        return supabase.from('consultations').select(CONSULTATION_COLUMNS).eq('visit_id', visitId).single();
    },

    async findByDoctor(supabase: SupabaseClient, doctorId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
    }) {
        const { page = 1, pageSize = 20, status } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('consultations').select(CONSULTATION_COLUMNS, { count: 'exact' })
            .eq('doctor_id', doctorId);

        if (status) query = query.eq('status', status);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('consultations').insert(data).select(CONSULTATION_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('consultations').update(data).eq('id', id).select(CONSULTATION_COLUMNS).single();
    },
};

/**
 * Triage Assessment Queries
 */
export const triageQueries = {
    async findByConsultationId(supabase: SupabaseClient, consultationId: string) {
        return supabase.from('triage_assessments').select(TRIAGE_ASSESSMENT_COLUMNS).eq('consultation_id', consultationId).single();
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('triage_assessments').insert(data).select(TRIAGE_ASSESSMENT_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('triage_assessments').update(data).eq('id', id).select(TRIAGE_ASSESSMENT_COLUMNS).single();
    },
};

/**
 * Medicine Queries
 */
export const medicineQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('medicines').select(MEDICINE_COLUMNS).eq('id', id).single();
    },

    async list(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
        category?: string;
        isActive?: boolean;
        search?: string;
    }) {
        const { page = 1, pageSize = 50, category, isActive = true, search } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('medicines').select(MEDICINE_COLUMNS, { count: 'exact' });

        if (category) query = query.eq('category', category);
        if (isActive !== undefined) query = query.eq('is_active', isActive);
        if (search) {
            query = query.or(`generic_name.ilike.%${search}%,brand_name.ilike.%${search}%`);
        }

        return query.range(from, to).order('generic_name', { ascending: true });
    },

    async getStockSummary(supabase: SupabaseClient) {
        return supabase.from('v_medicine_stock_summary').select('*');
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('medicines').insert(data).select(MEDICINE_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('medicines').update(data).eq('id', id).select(MEDICINE_COLUMNS).single();
    },
};

/**
 * Medicine Stock Queries
 */
export const medicineStockQueries = {
    async findByMedicineId(supabase: SupabaseClient, medicineId: string) {
        return supabase.from('medicine_stock').select(MEDICINE_STOCK_COLUMNS).eq('medicine_id', medicineId);
    },

    async updateQuantity(supabase: SupabaseClient, stockId: string, quantity: number) {
        return supabase.from('medicine_stock').update({ quantity, updated_at: new Date().toISOString() }).eq('id', stockId).select(MEDICINE_STOCK_COLUMNS).single();
    },

    async getLowStock(supabase: SupabaseClient) {
        return supabase
            .from('v_medicine_stock_summary')
            .select('*')
            .eq('is_low_stock', true);
    },
};

/**
 * Prescription Queries
 */
export const prescriptionQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('prescriptions').select(PRESCRIPTION_COLUMNS).eq('id', id).single();
    },

    async findByConsultationId(supabase: SupabaseClient, consultationId: string) {
        return supabase.from('prescriptions').select(PRESCRIPTION_COLUMNS).eq('consultation_id', consultationId);
    },

    async findByPatient(supabase: SupabaseClient, patientType: 'student' | 'faculty', patientId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
    }) {
        const { page = 1, pageSize = 20, status } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // Join through consultations -> clinic_visits to filter by patient
        let query = supabase
            .from('prescriptions')
            .select(`
        ${PRESCRIPTION_COLUMNS},
        consultations!inner (
          visit_id,
          clinic_visits!inner (patient_type, student_id, faculty_id)
        )
      `, { count: 'exact' });

        if (patientType === 'student') {
            query = query.eq('consultations.clinic_visits.patient_type', 'student')
                .eq('consultations.clinic_visits.student_id', patientId);
        } else {
            query = query.eq('consultations.clinic_visits.patient_type', 'faculty')
                .eq('consultations.clinic_visits.faculty_id', patientId);
        }

        if (status) query = query.eq('status', status);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('prescriptions').insert(data).select(PRESCRIPTION_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('prescriptions').update(data).eq('id', id).select(PRESCRIPTION_COLUMNS).single();
    },
};

/**
 * Appointment Queries
 */
export const appointmentQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('appointments').select(APPOINTMENT_COLUMNS).eq('id', id).single();
    },

    async findByPatient(supabase: SupabaseClient, patientType: 'student' | 'faculty', patientId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
    }) {
        const { page = 1, pageSize = 20, status } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('appointments').select(APPOINTMENT_COLUMNS, { count: 'exact' });

        if (patientType === 'student') {
            query = query.eq('patient_type', 'student').eq('student_id', patientId);
        } else {
            query = query.eq('patient_type', 'faculty').eq('faculty_id', patientId);
        }

        if (status) query = query.eq('status', status);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async findByDoctor(supabase: SupabaseClient, doctorId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
        date?: string;
    }) {
        const { page = 1, pageSize = 20, status, date } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('appointments').select(APPOINTMENT_COLUMNS, { count: 'exact' })
            .eq('doctor_id', doctorId);

        if (status) query = query.eq('status', status);
        if (date) query = query.eq('scheduled_date', date);

        return query.range(from, to).order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true });
    },

    async findPendingReview(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
    }) {
        const { page = 1, pageSize = 50 } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        return supabase
            .from('appointments')
            .select(APPOINTMENT_COLUMNS, { count: 'exact' })
            .in('status', ['pending', 'ai_evaluated', 'recommended'])
            .range(from, to)
            .order('created_at', { ascending: true });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('appointments').insert(data).select(APPOINTMENT_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('appointments').update(data).eq('id', id).select(APPOINTMENT_COLUMNS).single();
    },

    async getSchedule(supabase: SupabaseClient, date: string) {
        return supabase
            .from('v_appointment_overview')
            .select('*')
            .eq('scheduled_date', date)
            .order('scheduled_time', { ascending: true });
    },
};

/**
 * Incident Queries
 */
export const incidentQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('incidents').select(INCIDENT_COLUMNS).eq('id', id).single();
    },

    async findByPatient(supabase: SupabaseClient, patientType: 'student' | 'faculty', patientId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
    }) {
        const { page = 1, pageSize = 20, status } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('incidents').select(INCIDENT_COLUMNS, { count: 'exact' });

        if (patientType === 'student') {
            query = query.eq('patient_type', 'student').eq('student_id', patientId);
        } else {
            query = query.eq('patient_type', 'faculty').eq('faculty_id', patientId);
        }

        if (status) query = query.eq('status', status);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async listAll(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
        severity?: string;
    }) {
        const { page = 1, pageSize = 50, status, severity } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('incidents').select(INCIDENT_COLUMNS, { count: 'exact' });

        if (status) query = query.eq('status', status);
        if (severity) query = query.eq('severity', severity);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('incidents').insert(data).select(INCIDENT_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('incidents').update(data).eq('id', id).select(INCIDENT_COLUMNS).single();
    },
};

/**
 * Health Clearance Queries
 */
export const clearanceQueries = {
    async findById(supabase: SupabaseClient, id: string) {
        return supabase.from('health_clearances').select(HEALTH_CLEARANCE_COLUMNS).eq('id', id).single();
    },

    async findByPatient(supabase: SupabaseClient, patientType: 'student' | 'faculty', patientId: string) {
        let query = supabase.from('health_clearances').select(HEALTH_CLEARANCE_COLUMNS);

        if (patientType === 'student') {
            query = query.eq('requester_type', 'student').eq('student_id', patientId);
        } else {
            query = query.eq('requester_type', 'faculty').eq('faculty_id', patientId);
        }

        return query.order('created_at', { ascending: false });
    },

    async findPendingApproval(supabase: SupabaseClient) {
        return supabase
            .from('health_clearances')
            .select(HEALTH_CLEARANCE_COLUMNS)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('health_clearances').insert(data).select(HEALTH_CLEARANCE_COLUMNS).single();
    },

    async update(supabase: SupabaseClient, id: string, data: Record<string, unknown>) {
        return supabase.from('health_clearances').update(data).eq('id', id).select(HEALTH_CLEARANCE_COLUMNS).single();
    },
};

/**
 * Notification Queries
 */
export const notificationQueries = {
    async findByReceiver(supabase: SupabaseClient, receiverId: string, options?: {
        page?: number;
        pageSize?: number;
        unreadOnly?: boolean;
    }) {
        const { page = 1, pageSize = 20, unreadOnly = false } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('notifications').select(NOTIFICATION_COLUMNS, { count: 'exact' })
            .eq('receiver_id', receiverId);

        if (unreadOnly) query = query.is('read_at', null);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async markAsRead(supabase: SupabaseClient, notificationId: string) {
        return supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .select(NOTIFICATION_COLUMNS)
            .single();
    },

    async markAllAsRead(supabase: SupabaseClient, receiverId: string) {
        return supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('receiver_id', receiverId)
            .is('read_at', null);
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('notifications').insert(data).select(NOTIFICATION_COLUMNS).single();
    },
};

/**
 * Audit Log Queries
 */
export const auditLogQueries = {
    async list(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
        userId?: string;
        action?: string;
        entityType?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const { page = 1, pageSize = 50, userId, action, entityType, startDate, endDate } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('audit_logs').select(AUDIT_LOG_COLUMNS, { count: 'exact' });

        if (userId) query = query.eq('user_id', userId);
        if (action) query = query.eq('action', action);
        if (entityType) query = query.eq('entity_type', entityType);
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        return query.range(from, to).order('created_at', { ascending: false });
    },
};

/**
 * AI Log Queries
 */
export const aiLogQueries = {
    async list(supabase: SupabaseClient, options?: {
        page?: number;
        pageSize?: number;
        actionType?: string;
        entityType?: string;
        userId?: string;
    }) {
        const { page = 1, pageSize = 50, actionType, entityType, userId } = options || {};
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('ai_logs').select(AI_LOG_COLUMNS, { count: 'exact' });

        if (actionType) query = query.eq('action_type', actionType);
        if (entityType) query = query.eq('entity_type', entityType);
        if (userId) query = query.eq('user_id', userId);

        return query.range(from, to).order('created_at', { ascending: false });
    },

    async create(supabase: SupabaseClient, data: Record<string, unknown>) {
        return supabase.from('ai_logs').insert(data).select(AI_LOG_COLUMNS).single();
    },
};