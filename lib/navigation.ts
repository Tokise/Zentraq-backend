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
  Search,
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
    label: "Records",
    items: [
      { title: "Search Patients", href: "/admin/records/search", icon: Search, roles: ["admin"] },
      { title: "Medical Records", href: "/admin/records/view", icon: HeartPulse, roles: ["admin"] },
    ],
  },
  { label: "Clinical Operations", items: [
    { title: "Visits", href: "/admin/visits/history", icon: Stethoscope, roles: ["admin"] },
    { title: "Follow-ups", href: "/admin/visits/followup", icon: ClipboardCheck, roles: ["admin"] },
    { title: "Medicine", href: "/admin/medicine/stock", icon: Pill, roles: ["admin"] },
    { title: "Appointments", href: "/admin/appointments/calendar", icon: CalendarDays, roles: ["admin"] },
    { title: "Incidents", href: "/admin/incidents/log", icon: AlertTriangle, roles: ["admin"] },
  ] },
  {
    label: "Portal Management",
    items: [
      { title: "Announcements", href: "/admin/announcement", icon: Megaphone, roles: ["admin"] },
      { title: "Audit Logs", href: "/admin/useraccess/activity_logs", icon: ShieldAlert, roles: ["admin"] },
      { title: "Roles & Permissions", href: "/admin/useraccess/roles", icon: Shield, roles: ["admin"] },
      { title: "User Approvals", href: "/admin/useraccess/approval", icon: UserCheck, roles: ["admin"] },
      { title: "Password Resets", href: "/admin/useraccess/password_reset", icon: UserCog, roles: ["admin"] },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Health Programs", href: "/admin/healthprograms/list", icon: FileCheck, roles: ["admin"] },
      { title: "Program Schedule", href: "/admin/healthprograms/schedule", icon: CalendarDays, roles: ["admin"] },
      { title: "Program Reports", href: "/admin/healthprograms/reports", icon: BarChart3, roles: ["admin"] },
      { title: "Staff Health", href: "/admin/staffhealth/record", icon: HeartPulse, roles: ["admin"] },
      { title: "Clearances", href: "/admin/clearance/request", icon: FileText, roles: ["admin"] },
      { title: "Reports", href: "/admin/reports/generate", icon: BarChart3, roles: ["admin"] },
    ],
  },
  {
    label: "RFID",
    items: [
      { title: "RFID Registration", href: "/admin/rfid-registration", icon: UserPlus, roles: ["admin"] },
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
    label: "Records",
    items: [
      { title: "Search Patients", href: "/doctor/records/search", icon: Search, roles: ["doctor"] },
    ],
  },
  { label: "Clinical", items: [
    { title: "Visits", href: "/doctor/visits/history", icon: Stethoscope, roles: ["doctor"] },
    { title: "Appointments", href: "/doctor/appointments/calendar", icon: CalendarDays, roles: ["doctor"] },
    { title: "Clearances", href: "/doctor/clearance/history", icon: FileCheck, roles: ["doctor"] },
    { title: "Reports", href: "/doctor/reports/generate", icon: BarChart3, roles: ["doctor"] },
    { title: "Export Data", href: "/doctor/reports/export", icon: FileText, roles: ["doctor"] },
  ] },
  {
    label: "Incidents",
    items: [
      { title: "Case Status", href: "/doctor/incidents/status", icon: AlertTriangle, roles: ["doctor"] },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Health Programs", href: "/doctor/healthprograms/list", icon: FileCheck, roles: ["doctor"] },
      { title: "Program Participants", href: "/doctor/healthprograms/participants", icon: Users, roles: ["doctor"] },
      { title: "Program Reports", href: "/doctor/healthprograms/reports", icon: BarChart3, roles: ["doctor"] },
      { title: "Staff Health Record", href: "/doctor/staffhealth/record", icon: HeartPulse, roles: ["doctor"] },
      { title: "Staff Consultations", href: "/doctor/staffhealth/consultation", icon: Stethoscope, roles: ["doctor"] },
      { title: "Certificates", href: "/doctor/staffhealth/certificate_request", icon: FileText, roles: ["doctor"] },
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
    label: "Visits",
    items: [
      { title: "New Walk-in", href: "/nurse/visits/new_entry", icon: UserPlus, roles: ["nurse"] },
    ],
  },
  { label: "Records", items: [{ title: "Patient Records", href: "/nurse/records/search", icon: Search, roles: ["nurse"] }] },
  {
    label: "Medicine",
    items: [
      { title: "Dispense Medicine", href: "/nurse/medicine/dispense", icon: Pill, roles: ["nurse"] },
      { title: "Inventory Status", href: "/nurse/medicine/stock", icon: Package, roles: ["nurse"] },
      { title: "Low Stock Alerts", href: "/nurse/medicine/low_stock_alerts", icon: AlertTriangle, roles: ["nurse"] },
    ],
  },
  {
    label: "Appointments",
    items: [
      { title: "Today's Schedule", href: "/nurse/appointments/calendar", icon: CalendarDays, roles: ["nurse"] },
    ],
  },
  {
    label: "Incidents",
    items: [
      { title: "Report Incident", href: "/nurse/incidents/report", icon: AlertTriangle, roles: ["nurse"] },
    ],
  },
  { label: "Clearances", items: [{ title: "Clearance Requests", href: "/nurse/clearance/history", icon: FileCheck, roles: ["nurse"] }] },
  {
    label: "Services",
    items: [
      { title: "Health Programs", href: "/nurse/healthprograms/list", icon: FileCheck, roles: ["nurse"] },
      { title: "Program Participants", href: "/nurse/healthprograms/participants", icon: Users, roles: ["nurse"] },
      { title: "Staff Health Record", href: "/nurse/staffhealth/record", icon: HeartPulse, roles: ["nurse"] },
      { title: "Staff Consultations", href: "/nurse/staffhealth/consultation", icon: Stethoscope, roles: ["nurse"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "View Reports", href: "/nurse/reports/view_only", icon: BarChart3, roles: ["nurse"] },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Student navigation (SAD §4.5)
// ─────────────────────────────────────────────────────────────────────────────
export const studentNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "My Dashboard", href: "/student", icon: LayoutDashboard },
      { title: "Announcements", href: "/student/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Appointments",
    items: [
      { title: "Request Appointment", href: "/student/appointments/book", icon: CalendarDays },
    ],
  },
  {
    label: "Health Records",
    items: [
      { title: "My Health Records", href: "/student/records/my_record", icon: HeartPulse },
      { title: "Consultations", href: "/student/visits/my_history", icon: Stethoscope },
    ],
  },
  {
    label: "Clearances",
    items: [
      { title: "My Clearances", href: "/student/clearance/my_history", icon: FileCheck },
      { title: "Request Clearance", href: "/student/clearance/request", icon: FileText },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Faculty navigation (SAD §4.6)
// ─────────────────────────────────────────────────────────────────────────────
export const facultyNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "My Dashboard", href: "/faculty", icon: LayoutDashboard },
      { title: "Announcements", href: "/faculty/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Appointments",
    items: [
      { title: "Request Appointment", href: "/faculty/appointments/book", icon: CalendarDays },
    ],
  },
  {
    label: "Health Records",
    items: [
      { title: "My Health Records", href: "/faculty/staffhealth/my_record", icon: HeartPulse },
      { title: "Consultations", href: "/faculty/visits/my_history", icon: Stethoscope },
    ],
  },
  {
    label: "Clearances",
    items: [
      { title: "My Clearances", href: "/faculty/clearance/my_history", icon: FileCheck },
      { title: "Request Clearance", href: "/faculty/clearance/request", icon: FileText },
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
