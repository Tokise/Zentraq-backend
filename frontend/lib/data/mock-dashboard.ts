import type {
  Activity,
  DashboardAppointment,
  DashboardConsultation,
  ConsultationTrend,
  DashboardStats,
  EmergencyCase,
  InventoryAlert,
  DashboardNotification,
} from "@/types"

export const dashboardStats: DashboardStats = {
  patientsToday: 124,
  patientsTodayChange: 8,
  consultations: 47,
  consultationsChange: 12,
  emergencyCases: 3,
  emergencyCasesChange: -1,
  lowStockAlerts: 5,
  lowStockAlertsChange: 2,
}

export const todaysAppointments: DashboardAppointment[] = [
  { id: "1", patient_name: "Maria Santos", time: "08:30 AM", type: "General Checkup", status: "completed" },
  { id: "2", patient_name: "Juan Dela Cruz", time: "09:00 AM", type: "Follow-up", status: "in_progress" },
  { id: "3", patient_name: "Ana Reyes", time: "09:30 AM", type: "Health Clearance", status: "scheduled" },
  { id: "4", patient_name: "Carlos Mendoza", time: "10:00 AM", type: "Vaccination", status: "scheduled" },
  { id: "5", patient_name: "Sofia Garcia", time: "10:30 AM", type: "Consultation", status: "scheduled" },
]

export const recentConsultations: DashboardConsultation[] = [
  { id: "1", patient_name: "Maria Santos", patient_complaint: "Headache, mild fever", time: "08:45 AM", status: "completed" },
  { id: "2", patient_name: "Juan Dela Cruz", patient_complaint: "Sprained ankle", time: "09:15 AM", status: "active" },
  { id: "3", patient_name: "Pedro Lim", patient_complaint: "Allergic reaction", time: "08:00 AM", status: "emergency" },
  { id: "4", patient_name: "Lisa Tan", patient_complaint: "Sore throat", time: "07:30 AM", status: "completed" },
]

export const inventoryAlerts: InventoryAlert[] = [
  { id: "1", medicine_name: "Paracetamol 500mg", current_stock: 12, minimum_stock: 50, severity: "critical" },
  { id: "2", medicine_name: "Amoxicillin 250mg", current_stock: 28, minimum_stock: 40, severity: "warning" },
  { id: "3", medicine_name: "Ibuprofen 400mg", current_stock: 35, minimum_stock: 50, severity: "warning" },
]

export const emergencyCases: EmergencyCase[] = [
  { id: "1", patient_name: "Pedro Lim", complaint: "Severe allergic reaction", time: "08:00 AM", priority: "critical" },
  { id: "2", patient_name: "Rosa Villanueva", complaint: "Chest pain", time: "07:45 AM", priority: "high" },
  { id: "3", patient_name: "Miguel Torres", complaint: "High fever (40°C)", time: "07:20 AM", priority: "high" },
]

export const notifications: DashboardNotification[] = [
  { id: "1", title: "Low Stock Alert", message: "Paracetamol 500mg is critically low (12 units remaining)", type: "warning", time: "10 min ago" },
  { id: "2", title: "Emergency Case", message: "Pedro Lim admitted for allergic reaction", type: "danger", time: "1 hour ago" },
  { id: "3", title: "Appointment Reminder", message: "5 appointments scheduled for this afternoon", type: "info", time: "2 hours ago" },
]

export const recentActivities: Activity[] = [
  { id: "1", action: "Completed consultation for Maria Santos", user: "Dr. Reyes", time: "08:45 AM" },
  { id: "2", action: "Dispensed Amoxicillin to Juan Dela Cruz", user: "Nurse Garcia", time: "09:20 AM" },
  { id: "3", action: "Registered new RFID card for Ana Reyes", user: "Admin Lim", time: "08:30 AM" },
  { id: "4", action: "Updated inventory for Paracetamol", user: "Pharmacy Staff", time: "07:00 AM" },
]

export const consultationTrend: ConsultationTrend[] = [
  { date: "Mon", count: 32 },
  { date: "Tue", count: 45 },
  { date: "Wed", count: 38 },
  { date: "Thu", count: 52 },
  { date: "Fri", count: 47 },
  { date: "Sat", count: 18 },
  { date: "Sun", count: 8 },
]

export const aiInsights = [
  "Patient volume is 8% higher than last week. Consider adding afternoon clinic hours.",
  "3 emergency cases today — above the weekly average of 1.2 per day.",
  "Paracetamol stock will run out in ~2 days at current dispensing rate.",
]
