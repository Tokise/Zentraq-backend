export type Complaint = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type ConsultationStatus =
  | "waiting"
  | "in_consultation"
  | "in_emergency"
  | "completed"
  | "dismissed"

export type DispositionStatus = "return_to_class" | "return_to_activity" | "sent_home"

export type CompletionReport = {
  diagnosis: string
  treatment: string
  recommendations: string
}

export type ConsultationRecord = {
  id: string
  profile_id: string | null
  patient_name: string
  student_complaint: string
  status: ConsultationStatus
  created_at: string
  handled_at: string | null
  notes: string | null
  origin: "consultation" | "emergency" | "kiosk" | null
}

export type VisitLog = {
  id: string
  consultation_id: string
  patient_name: string
  student_complaint: string
  origin: "consultation" | "emergency" | "kiosk"
  diagnosis: string | null
  treatment: string | null
  recommendations: string | null
  status: DispositionStatus
  handled_at: string | null
  created_at: string
}

export type DashboardStats = {
  patientsToday: number
  patientsTodayChange: number
  consultations: number
  consultationsChange: number
  emergencyCases: number
  emergencyCasesChange: number
  lowStockAlerts: number
  lowStockAlertsChange: number
}

export type Appointment = {
  id: string
  patient_name: string
  time: string
  type: string
  status: "completed" | "in_progress" | "scheduled"
}

export type Consultation = {
  id: string
  patient_name: string
  student_complaint: string
  time: string
  status: "completed" | "active" | "emergency"
}

export type InventoryAlert = {
  id: string
  medicine_name: string
  current_stock: number
  minimum_stock: number
  severity: "critical" | "warning"
}

export type EmergencyCase = {
  id: string
  patient_name: string
  complaint: string
  time: string
  priority: "critical" | "high"
}

export type Notification = {
  id: string
  title: string
  message: string
  type: "warning" | "danger" | "info"
  time: string
}

export type Activity = {
  id: string
  action: string
  user: string
  time: string
}

export type ConsultationTrend = {
  date: string
  count: number
}


