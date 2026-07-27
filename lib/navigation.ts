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
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
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

export const navigation: NavGroup[] = [
  {
    label: "",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },

    ],
  },
  {
    label: "PATIENTS",
    items: [
      { title: "Patients", href: "/patients", icon: Users },
      { title: "Medical Records", href: "/patients/medical-records", icon: FileText },
      {
        title: "RFID Registration",
        href: "/patients/rfid-registration",
        icon: UserPlus,
        roles: ["admin"],
      },
      {
        title: "RFID Kiosk Mode",
        href: "/rfid-kiosk",
        icon: CreditCard,
        target: "_blank",
      },
    ],
  },
  {
    label: "CONSULTATIONS",
    items: [
      { title: "Consultations", href: "/consultations", icon: Stethoscope },
      { title: "Visit Logs", href: "/consultations/visit-logs", icon: ClipboardList },
      { title: "Emergency Cases", href: "/consultations/emergency", icon: HeartPulse },
    ],
  },
  {
    label: "APPOINTMENTS",
    items: [
      { title: "Calendar", href: "/appointments/calendar", icon: CalendarDays },
      { title: "Queue", href: "/appointments/queue", icon: ListOrdered },
    ],
  },
  {
    label: "PHARMACY",
    items: [
      { title: "Medicines", href: "/pharmacy/medicines", icon: Pill },
      { title: "Dispensing", href: "/pharmacy/dispensing", icon: Package },
      { title: "Inventory", href: "/pharmacy/inventory", icon: Package },
    ],
  },
  {
    label: "HEALTH SERVICES",
    items: [
      { title: "Faculty & Staff", href: "/health-services/faculty-staff", icon: Users },
      { title: "Health Programs", href: "/health-services/programs", icon: Activity },
      { title: "Health Clearance", href: "/health-services/clearance", icon: FileCheck },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { title: "Analytics", href: "/reports/analytics", icon: BarChart3 },
      { title: "Compliance", href: "/reports/compliance", icon: ShieldCheck },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      {
        title: "Clinic Accounts",
        href: "/admin/operators",
        icon: Users,
        roles: ["admin"],
      },
      {
        title: "Announcements",
        href: "/admin/announcements",
        icon: Bell,
        roles: ["admin"],
      },
      {
        title: "Users Management",
        href: "/admin/users",
        icon: Users,
        roles: ["admin"],
      },
    ],
  },
]

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

export const allNavItems = navigation.flatMap((group) => group.items)

export function getPageTitle(pathname: string): string {
  const item = allNavItems.find((nav) => nav.href === pathname)
  return item?.title ?? "Zentraq"
}