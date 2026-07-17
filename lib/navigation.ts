import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileText,
  HeartPulse,
  LayoutDashboard,
  ListOrdered,
  Package,
  Pill,
  Settings,
  Shield,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  target?: "_self" | "_blank"
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    label: "",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "PATIENTS",
    items: [
      { title: "Patients", href: "/patients", icon: Users },
      { title: "Medical Records", href: "/patients/medical-records", icon: FileText },
      { title: "RFID Registration", href: "/patients/rfid-registration", icon: UserPlus },
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
      { title: "Calendar", href: "/appointments/calendar", icon: Calendar },
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
      { title: "Users", href: "/admin/users", icon: Users },
      { title: "Roles", href: "/admin/roles", icon: Shield },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardList },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
]

export const allNavItems = navigation.flatMap((group) => group.items)

export function getPageTitle(pathname: string): string {
  const item = allNavItems.find((nav) => nav.href === pathname)
  return item?.title ?? "Zentraq"
}
