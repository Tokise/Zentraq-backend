import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileText,
  HeartPulse,
  LayoutDashboard,
  ListOrdered,
  Megaphone,
  Package,
  Pill,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  GraduationCap,
  History,
  AlertTriangle,
  Syringe,
  BookOpen,
  ScrollText,
  ClipboardCheck,
  Stethoscope as StethoscopeAlt,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  target?: "_self" | "_blank"
  roles?: string[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin navigation (SAD §4.2)
// ─────────────────────────────────────────────────────────────────────────────
export const adminNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["admin"] },
    ],
  },
  {
    label: "User Management",
    items: [
      { title: "Students", href: "/admin/student-accounts", icon: GraduationCap, roles: ["admin"] },
      { title: "Faculty", href: "/admin/faculty-accounts", icon: Users, roles: ["admin"] },
      { title: "Clinic Accounts", href: "/admin/clinic-accounts", icon: UserCog, roles: ["admin"] },
    ],
  },
  {
    label: "Portal Management",
    items: [
      { title: "Announcements", href: "/admin/clinic-announcements", icon: Megaphone, roles: ["admin"] },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ShieldAlert, roles: ["admin"] },
      { title: "Roles & Permissions", href: "/admin/roles", icon: Shield, roles: ["admin"] },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Services", href: "/admin/services", icon: Activity, roles: ["admin"] },
      { title: "Health Programs", href: "/admin/services/programs", icon: FileCheck, roles: ["admin"] },
      { title: "Health Clearance", href: "/admin/services/clearance", icon: Stethoscope, roles: ["admin"] },
    ],
  },
  {
    label: "RFID",
    items: [
      { title: "RFID Registration", href: "/admin/rfid-registration", icon: UserPlus, roles: ["admin"] },
    ],
  },
  {
    label: "System",
    items: [
      { title: "System Settings", href: "/admin/settings", icon: Settings, roles: ["admin"] },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Doctor navigation (SAD §4.3)
// ─────────────────────────────────────────────────────────────────────────────
export const doctorNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "Dashboard", href: "/doctor", icon: LayoutDashboard, roles: ["doctor"] },
    ],
  },
  {
    label: "Patients",
    items: [
      { title: "Student Records", href: "/doctor/patients", icon: GraduationCap, roles: ["doctor"] },
      { title: "Faculty Records", href: "/doctor/patients/faculty", icon: Users, roles: ["doctor"] },
    ],
  },
  {
    label: "Consultations",
    items: [
      { title: "Pending Review", href: "/doctor/consultations/pending", icon: ClipboardCheck, roles: ["doctor"] },
      { title: "Active Consultations", href: "/doctor/consultations", icon: Stethoscope, roles: ["doctor"] },
      { title: "Completed", href: "/doctor/consultations/completed", icon: ClipboardList, roles: ["doctor"] },
    ],
  },
  {
    label: "Prescriptions",
    items: [
      { title: "Write Prescription", href: "/doctor/prescriptions/new", icon: Pill, roles: ["doctor"] },
      { title: "Prescription History", href: "/doctor/prescriptions", icon: Pill, roles: ["doctor"] },
    ],
  },
  {
    label: "Appointments",
    items: [
      { title: "My Schedule", href: "/doctor/appointments", icon: CalendarDays, roles: ["doctor"] },
      { title: "Appointment Requests", href: "/doctor/appointments/requests", icon: ListOrdered, roles: ["doctor"] },
    ],
  },
  {
    label: "Incidents",
    items: [
      { title: "Active Cases", href: "/doctor/incidents", icon: AlertTriangle, roles: ["doctor"] },
      { title: "Case History", href: "/doctor/incidents/history", icon: History, roles: ["doctor"] },
    ],
  },
  {
    label: "Health Clearances",
    items: [
      { title: "Medical Evaluation", href: "/doctor/clearances", icon: FileCheck, roles: ["doctor"] },
      { title: "Clearance Requests", href: "/doctor/clearances/requests", icon: FileText, roles: ["doctor"] },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "My Statistics", href: "/doctor/analytics", icon: BarChart3, roles: ["doctor"] },
      { title: "Clinic Overview", href: "/doctor/analytics/overview", icon: Activity, roles: ["doctor"] },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Nurse navigation (SAD §4.4)
// ─────────────────────────────────────────────────────────────────────────────
export const nurseNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "Dashboard", href: "/nurse", icon: LayoutDashboard, roles: ["nurse"] },
    ],
  },
  {
    label: "Patients",
    items: [
      { title: "Student Records", href: "/nurse/patients", icon: GraduationCap, roles: ["nurse"] },
      { title: "Faculty Records", href: "/nurse/patients/faculty", icon: Users, roles: ["nurse"] },
    ],
  },
  {
    label: "Consultations",
    items: [
      { title: "New Walk-in", href: "/nurse/consultations/new", icon: UserPlus, roles: ["nurse"] },
      { title: "Triage", href: "/nurse/consultations/triage", icon: ClipboardCheck, roles: ["nurse"] },
      { title: "Active", href: "/nurse/consultations", icon: StethoscopeAlt, roles: ["nurse"] },
      { title: "Completed", href: "/nurse/consultations/completed", icon: ClipboardList, roles: ["nurse"] },
    ],
  },
  {
    label: "Pharmacy",
    items: [
      { title: "Dispense Medicine", href: "/nurse/pharmacy/dispense", icon: Pill, roles: ["nurse"] },
      { title: "Inventory Status", href: "/nurse/pharmacy/stock", icon: Package, roles: ["nurse"] },
      { title: "Low Stock Alerts", href: "/nurse/pharmacy/alerts", icon: AlertTriangle, roles: ["nurse"] },
    ],
  },
  {
    label: "Appointments",
    items: [
      { title: "Requests", href: "/nurse/appointments/requests", icon: ListOrdered, roles: ["nurse"] },
      { title: "Today's Schedule", href: "/nurse/appointments/today", icon: CalendarDays, roles: ["nurse"] },
      { title: "Manage Appointments", href: "/nurse/appointments", icon: CalendarDays, roles: ["nurse"] },
    ],
  },
  {
    label: "Incidents",
    items: [
      { title: "Report Incident", href: "/nurse/incidents/new", icon: AlertTriangle, roles: ["nurse"] },
      { title: "Case Management", href: "/nurse/incidents", icon: HeartPulse, roles: ["nurse"] },
    ],
  },
  {
    label: "Health Clearances",
    items: [
      { title: "Process Requests", href: "/nurse/clearances", icon: FileCheck, roles: ["nurse"] },
      { title: "Issued Certificates", href: "/nurse/clearances/issued", icon: ScrollText, roles: ["nurse"] },
    ],
  },
  {
    label: "RFID Check-in",
    items: [
      { title: "Kiosk Status", href: "/nurse/rfid", icon: CreditCard, roles: ["nurse"] },
      { title: "Check-in Log", href: "/nurse/rfid/log", icon: ClipboardList, roles: ["nurse"] },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Student navigation (SAD §4.5)
// ─────────────────────────────────────────────────────────────────────────────
export const studentNavigation: NavGroup[] = [
  {
    label: "STUDENT",
    items: [
      { title: "My Dashboard", href: "/student", icon: LayoutDashboard },
      { title: "Request Appointment", href: "/student/appointments/new", icon: CalendarDays },
      { title: "My Appointments", href: "/student/appointments", icon: CalendarDays },
      { title: "Appointment History", href: "/student/appointments/history", icon: History },
      { title: "My Health Records", href: "/student/records", icon: HeartPulse },
      { title: "Consultations", href: "/student/records/consultations", icon: Stethoscope },
      { title: "Prescriptions", href: "/student/records/prescriptions", icon: Pill },
      { title: "My Clearances", href: "/student/clearances", icon: FileCheck },
      { title: "Request Clearance", href: "/student/clearances/request", icon: FileText },
      { title: "Announcements", href: "/student/announcements", icon: Megaphone },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Faculty navigation (SAD §4.6)
// ─────────────────────────────────────────────────────────────────────────────
export const facultyNavigation: NavGroup[] = [
  {
    label: "STUDENT",
    items: [
      { title: "My Dashboard", href: "/faculty", icon: LayoutDashboard },
      { title: "Request Appointment", href: "/faculty/appointments/new", icon: CalendarDays },
      { title: "My Appointments", href: "/faculty/appointments", icon: CalendarDays },
      { title: "Appointment History", href: "/faculty/appointments/history", icon: History },
      { title: "My Health Records", href: "/faculty/records", icon: HeartPulse },
      { title: "Consultations", href: "/faculty/records/consultations", icon: Stethoscope },
      { title: "Prescriptions", href: "/faculty/records/prescriptions", icon: Pill },
      { title: "My Clearances", href: "/faculty/clearances", icon: FileCheck },
      { title: "Request Clearance", href: "/faculty/clearances/request", icon: FileText },
      { title: "Announcements", href: "/faculty/announcements", icon: Megaphone },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
]

// Helper function to get navigation based on role
export function getNavigationForRole(role: string | null | undefined) {
  if (role === "admin") {
    return adminNavigation
  }
  if (role === "doctor") {
    return doctorNavigation
  }
  if (role === "nurse") {
    return nurseNavigation
  }
  if (role === "faculty") {
    return facultyNavigation
  }
  // Default: student navigation for student, staff fallback to nurse
  return studentNavigation
}

// For backward compatibility with imports that reference staffNavigation
export const staffNavigation: NavGroup[] = nurseNavigation

// Keep backward compatibility with existing code
export const navigation = [...adminNavigation, ...staffNavigation]

export const allNavItems = navigation.flatMap((group) => group.items)

export function getPageTitle(pathname: string): string {
  const item = allNavItems.find((nav) => nav.href === pathname)
  return item?.title ?? "Zentraq"
}