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

// Admin navigation structure
export const adminNavigation: NavGroup[] = [
  {
    label: "RFID",
    items: [
      { title: "RFID Registration", href: "/admin/rfid-registration", icon: UserPlus, roles: ["admin"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Student Accounts", href: "/admin/student-accounts", icon: GraduationCap, roles: ["admin"] },
      { title: "Clinic Accounts", href: "/admin/clinic-accounts", icon: Users, roles: ["admin"] },
      { title: "Faculty Accounts", href: "/admin/faculty-accounts", icon: Users, roles: ["admin"] },
    ],
  },
  {
    label: "Account Creations",
    items: [
      { title: "Create Clinic Account", href: "/admin/clinic-accounts/create", icon: UserCog, roles: ["admin"] },
      { title: "Create Faculty Accounts", href: "/admin/faculty-accounts/create", icon: UserCog, roles: ["admin"] },

    ],
  },
  {
    label: "Portal Management",
    items: [
      { title: "Announcements", href: "/admin/clinic-announcements", icon: Bell, roles: ["admin"] },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ShieldAlert, roles: ["admin"] },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Health Programs", href: "/admin/services/programs", icon: Activity, roles: ["admin"] },
      { title: "Health Clearance", href: "/admin/services/clearance", icon: FileCheck, roles: ["admin"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Analytics", href: "/reports/analytics", icon: BarChart3 },
      { title: "Compliance", href: "/reports/compliance", icon: ShieldCheck },
    ],
  },
]

// Nurse/Doctor navigation structure
export const staffNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Patients",
    items: [
      { title: "Patients", href: "/patients", icon: Users },
      { title: "Medical Records", href: "/patients/medical-records", icon: FileText },
      { title: "RFID Kiosk Mode", href: "/rfid-kiosk", icon: CreditCard, target: "_blank" },
    ],
  },
  {
    label: "Consultations",
    items: [
      { title: "Consultations", href: "/consultations", icon: Stethoscope },
      { title: "Visit Logs", href: "/consultations/visit-logs", icon: ClipboardList },
      { title: "Emergency Cases", href: "/consultations/emergency", icon: HeartPulse },
    ],
  },
  {
    label: "Appointments",
    items: [
      { title: "Calendar", href: "/appointments/calendar", icon: CalendarDays },
      { title: "Queue", href: "/appointments/queue", icon: ListOrdered },
      { title: "Cleared", href: "/appointments/cleared", icon: FileCheck },
    ],
  },
  {
    label: "Pharmacy",
    items: [
      { title: "Medicines", href: "/pharmacy/medicines", icon: Pill },
      { title: "Dispensing", href: "/pharmacy/dispensing", icon: Package },
      { title: "Inventory", href: "/pharmacy/inventory", icon: Package },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Analytics", href: "/reports/analytics", icon: BarChart3 },
      { title: "Compliance", href: "/reports/compliance", icon: ShieldCheck },
    ],
  },
]

// Student navigation structure
export const studentNavigation: NavGroup[] = [
  {
    label: "STUDENT",
    items: [
      { title: "Dashboard", href: "/student", icon: LayoutDashboard },
      { title: "Announcements", href: "/student/announcements", icon: Megaphone },
      { title: "Book Appointment", href: "/student/appointments", icon: CalendarDays },
      { title: "Settings", href: "/student/settings", icon: Settings },
    ],
  },
]

// Helper function to get navigation based on role
export function getNavigationForRole(role: string | null | undefined) {
  if (role === "admin") {
    return adminNavigation
  }
  // nurse, doctor, and any other staff roles
  return staffNavigation
}

// Keep backward compatibility with existing code
export const navigation = [...adminNavigation, ...staffNavigation]

export const allNavItems = navigation.flatMap((group) => group.items)

export function getPageTitle(pathname: string): string {
  const item = allNavItems.find((nav) => nav.href === pathname)
  return item?.title ?? "Zentraq"
}