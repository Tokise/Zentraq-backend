export type ClinicProfile = {
  id: string
  rfid_uid: string | null
  student_number: string | null
  employee_number: string | null
  first_name: string
  last_name: string
  email: string | null
  department: string | null
  course: string | null
  year_level: string | null
  position: string | null
  active_status: boolean
  clinic_photo_url: string | null
  synced_at: string | null
  created_at: string
}

export type Appointment = {
  id: string
  patient_name: string
  time: string
  type: string
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
}

export type Consultation = {
  id: string
  patient_name: string
  chief_complaint: string
  time: string
  status: "active" | "completed" | "emergency"
}

export type CheckIn = {
  id: string
  profile_id: string | null
  patient_name: string
  rfid_uid: string | null
  status: "waiting" | "in_progress" | "completed" | "dismissed"
  created_at: string
  handled_at: string | null
  notes: string | null
}

export type InventoryAlert = {
  id: string
  medicine_name: string
  current_stock: number
  minimum_stock: number
  severity: "warning" | "critical"
}

export type EmergencyCase = {
  id: string
  patient_name: string
  complaint: string
  time: string
  priority: "high" | "critical"
}

export type Activity = {
  id: string
  action: string
  user: string
  time: string
}

export type Notification = {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "danger"
  time: string
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

export type ConsultationTrend = {
  date: string
  count: number
}
