import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  FileText,
  HeartPulse,
  History,
  LayoutDashboard,
  Megaphone,
  Package,
  Pill,
  Scan,
  Shield,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  target?: "_self" | "_blank";
  roles?: string[];
};
export type NavGroup = {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

// Creates the role-specific dashboard section.
const dashboard = (role: "admin" | "doctor" | "nurse"): NavGroup => ({
  label: "Dashboard",
  collapsible: false,
  items: [
    {
      title: "Dashboard",
      href: `/${role}`,
      icon: LayoutDashboard,
      roles: [role],
    },
  ],
});

export const adminNavigation: NavGroup[] = [
  dashboard("admin"),
  {
    label: "System",
    items: [
      { title: "Announcements", href: "/admin/announcement", icon: Megaphone },
      { title: "RFID Kiosk", href: "/admin/rfid-kiosk", icon: Scan },
      {
        title: "RFID Registration",
        href: "/admin/rfid-registration",
        icon: UserPlus,
      },
    ],
  },
  {
    label: "Medical Records",
    items: [
      {
        title: "Student Records",
        href: "/admin/records/view",
        icon: HeartPulse,
      },
      {
        title: "Employee Records",
        href: "/admin/staffhealth/record",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Consultations",
    items: [
      { title: "Visit", href: "/admin/visits", icon: Stethoscope },
      { title: "Visit History", href: "/admin/visits/history", icon: History },
      {
        title: "Follow-ups",
        href: "/admin/visits/followup",
        icon: ClipboardCheck,
      },
    ],
  },
    {
    label: "Reports",
    items: [
      {
        title: "Reports & Analytics",
        href: "/admin/reports/generate",
        icon: BarChart3,
      },
      { title: "Export Data", href: "/admin/reports/export", icon: FileText },
      {
        title: "Report Templates",
        href: "/admin/reports/templates",
        icon: FileCheck,
      },
      {
        title: "Compliance Checklist",
        href: "/admin/reports/checklist",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Medicine",
    items: [
      {
        title: "Inventory Status",
        href: "/admin/medicine/stock",
        icon: Package,
      },
      {
        title: "Restock Medicine",
        href: "/admin/medicine/restock",
        icon: Package,
      },
      {
        title: "Dispense Medicine",
        href: "/admin/medicine/dispense",
        icon: Pill,
      },
      {
        title: "Dispense Log",
        href: "/admin/medicine/dispense_log",
        icon: History,
      },
      {
        title: "Low Stock Alerts",
        href: "/admin/medicine/low_stock_alerts",
        icon: AlertTriangle,
      },
      {
        title: "Expiry Monitoring",
        href: "/admin/medicine/expiry",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Appointments",
    items: [
      {
        title: "Calendar",
        href: "/admin/appointments/calendar",
        icon: CalendarDays,
      },
      {
        title: "My Schedule",
        href: "/admin/my-schedule",
        icon: CalendarDays,
      },
      {
        title: "Book Appointment",
        href: "/admin/appointments/book",
        icon: UserPlus,
      },
      {
        title: "Reschedule",
        href: "/admin/appointments/reschedule",
        icon: CalendarDays,
      },
      { title: "Waitlist", href: "/admin/appointments/waitlist", icon: Users },
      {
        title: "Reminders",
        href: "/admin/appointments/reminders",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Incidents",
    items: [
      {
        title: "Incident Log",
        href: "/admin/incidents/log",
        icon: AlertTriangle,
      },
      {
        title: "Report Incident",
        href: "/admin/incidents/report",
        icon: UserPlus,
      },
      {
        title: "Case Status",
        href: "/admin/incidents/status",
        icon: ClipboardCheck,
      },
      { title: "Referrals", href: "/admin/incidents/referral", icon: FileText },
      {
        title: "Emergency Contacts",
        href: "/admin/incidents/emergency_contacts",
        icon: Users,
      },
    ],
  },

  {
    label: "Health Programs",
    items: [
      {
        title: "Health Programs",
        href: "/admin/healthprograms/list",
        icon: HeartPulse,
      },
      {
        title: "Program Setup",
        href: "/admin/healthprograms/programs",
        icon: ClipboardCheck,
      },
      {
        title: "Participants",
        href: "/admin/healthprograms/participants",
        icon: Users,
      },
      {
        title: "Enrollment",
        href: "/admin/healthprograms/enrollment",
        icon: UserPlus,
      },
      {
        title: "Program Schedule",
        href: "/admin/healthprograms/schedule",
        icon: CalendarDays,
      },
      {
        title: "Program Reports",
        href: "/admin/healthprograms/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Clearances",
    items: [
      {
        title: "Clearance Requests",
        href: "/admin/clearance/request",
        icon: FileText,
      },
      {
        title: "Issue Clearance",
        href: "/admin/clearance/issue",
        icon: FileCheck,
      },
      {
        title: "Clearance History",
        href: "/admin/clearance/history",
        icon: History,
      },
      {
        title: "Requirements",
        href: "/admin/clearance/requirements",
        icon: ClipboardCheck,
      },
      {
        title: "Certificate Templates",
        href: "/admin/clearance/templates",
        icon: FileText,
      },
    ],
  },

  {
    label: "Access Control",
    items: [
      { title: "Roles", href: "/admin/useraccess/roles", icon: Shield },
      {
        title: "Permissions",
        href: "/admin/useraccess/permissions",
        icon: Shield,
      },
      {
        title: "User Approval",
        href: "/admin/useraccess/approval",
        icon: UserCheck,
      },
      {
        title: "Password Reset",
        href: "/admin/useraccess/password_reset",
        icon: UserCog,
      },
      {
        title: "Audit Trail",
        href: "/admin/reports/audit_trail",
        icon: ShieldAlert,
      },
    ],
  },
];

export const doctorNavigation: NavGroup[] = [
  dashboard("doctor"),
  {
    label: "System",
    items: [
      {
        title: "Announcements",
        href: "/doctor/announcements",
        icon: Megaphone,
      },
      { title: "RFID Kiosk", href: "/doctor/rfid-kiosk", icon: Scan },
    ],
  },
  {
    label: "Medical Records",
    items: [
      {
        title: "Student Records",
        href: "/doctor/records/view",
        icon: HeartPulse,
      },
      {
        title: "Employee Records",
        href: "/doctor/staffhealth/record",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Consultations",
    items: [
      { title: "Visit", href: "/doctor/visits", icon: Stethoscope },
      { title: "Visit History", href: "/doctor/visits/history", icon: History },
      {
        title: "Follow-ups",
        href: "/doctor/visits/followup",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Appointments",
    items: [
      {
        title: "Calendar",
        href: "/doctor/appointments/calendar",
        icon: CalendarDays,
      },
      {
        title: "My Schedule",
        href: "/doctor/my-schedule",
        icon: CalendarDays,
      },
      {
        title: "Reschedule",
        href: "/doctor/appointments/reschedule",
        icon: CalendarDays,
      },
      {
        title: "Reminders",
        href: "/doctor/appointments/reminders",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Health Programs",
    items: [
      {
        title: "Health Programs",
        href: "/doctor/healthprograms/list",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Clearances",
    items: [
      {
        title: "Clearance History",
        href: "/doctor/clearance/history",
        icon: History,
      },
      {
        title: "Evaluate Clearances",
        href: "/doctor/clearance/issue",
        icon: FileCheck,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        title: "Clinic Analytics",
        href: "/doctor/reports/generate",
        icon: BarChart3,
      },
    ],
  },
];

export const nurseNavigation: NavGroup[] = [
  dashboard("nurse"),
  {
    label: "System",
    items: [
      {
        title: "Announcements",
        href: "/nurse/announcements",
        icon: Megaphone,
      },
      { title: "RFID Kiosk", href: "/nurse/rfid-kiosk", icon: Scan },
    ],
  },
  {
    label: "Medical Records",
    items: [
      {
        title: "Student Records",
        href: "/nurse/records/view",
        icon: HeartPulse,
      },
      {
        title: "Employee Records",
        href: "/nurse/staffhealth/record",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Consultations",
    items: [
      { title: "Visit", href: "/nurse/visits", icon: Stethoscope },
      { title: "Visit History", href: "/nurse/visits/history", icon: History },
    ],
  },

  {
    label: "Clearances",
    items: [
      {
        title: "Clearance History",
        href: "/nurse/clearance/history",
        icon: History,
      },
    ],
  },
  {
    label: "Appointments",
    items: [
      {
        title: "Calendar",
        href: "/nurse/appointments/calendar",
        icon: CalendarDays,
      },
      {
        title: "My Schedule",
        href: "/nurse/my-schedule",
        icon: CalendarDays,
      },
      {
        title: "Appointments",
        href: "/nurse/appointments",
        icon: ClipboardCheck,
      },
      {
        title: "Reminders",
        href: "/nurse/appointments/reminders",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Health Programs",
    items: [
      {
        title: "Health Programs",
        href: "/nurse/healthprograms/list",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        title: "Clinic Analytics",
        href: "/nurse/reports/view_only",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Medicine",
    items: [
      {
        title: "Inventory Status",
        href: "/nurse/medicine/stock",
        icon: Package,
      },
      {
        title: "Restock Medicine",
        href: "/nurse/medicine/restock",
        icon: Package,
      },
      {
        title: "Dispense Medicine",
        href: "/nurse/medicine/dispense",
        icon: Pill,
      },
      {
        title: "Dispense Log",
        href: "/nurse/medicine/dispense_log",
        icon: History,
      },
      {
        title: "Low Stock Alerts",
        href: "/nurse/medicine/low_stock_alerts",
        icon: AlertTriangle,
      },
      {
        title: "Expiry Monitoring",
        href: "/nurse/medicine/expiry",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Incidents",
    items: [
      {
        title: "Incident Log",
        href: "/nurse/incidents/log",
        icon: AlertTriangle,
      },
      {
        title: "Report Incident",
        href: "/nurse/incidents/report",
        icon: UserPlus,
      },
      {
        title: "Case Status",
        href: "/nurse/incidents/status",
        icon: ClipboardCheck,
      },
      { title: "Referrals", href: "/nurse/incidents/referral", icon: FileText },
      {
        title: "Emergency Contacts",
        href: "/nurse/incidents/emergency_contacts",
        icon: Users,
      },
      {
        title: "Incident Dashboard",
        href: "/nurse/incidents",
        icon: AlertTriangle,
      },
    ],
  },
];

export const studentNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "My Dashboard", href: "/student", icon: LayoutDashboard },
      {
        title: "Announcements",
        href: "/student/announcements",
        icon: Megaphone,
      },
    ],
    collapsible: false,
  },
  {
    label: "Appointments",
    items: [
      {
        title: "Request Appointment",
        href: "/student/appointments/book",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Health Records",
    items: [
      {
        title: "My Health Records",
        href: "/student/records/my_record",
        icon: HeartPulse,
      },
      {
        title: "Consultations",
        href: "/student/visits/my_history",
        icon: Stethoscope,
      },
    ],
  },
  {
    label: "Clearances",
    items: [
      {
        title: "My Clearances",
        href: "/student/clearance/my_history",
        icon: FileCheck,
      },
      {
        title: "Request Clearance",
        href: "/student/clearance/request",
        icon: FileText,
      },
    ],
  },
];
export const facultyNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "My Dashboard", href: "/faculty", icon: LayoutDashboard },
      {
        title: "Announcements",
        href: "/faculty/announcements",
        icon: Megaphone,
      },
    ],
    collapsible: false,
  },
  {
    label: "Appointments",
    items: [
      {
        title: "Request Appointment",
        href: "/faculty/appointments/book",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Health Records",
    items: [
      {
        title: "My Health Records",
        href: "/faculty/staffhealth/my_record",
        icon: HeartPulse,
      },
      {
        title: "Consultations",
        href: "/faculty/visits/my_history",
        icon: Stethoscope,
      },
    ],
  },
  {
    label: "Clearances",
    items: [
      {
        title: "My Clearances",
        href: "/faculty/clearance/my_history",
        icon: FileCheck,
      },
      {
        title: "Request Clearance",
        href: "/faculty/clearance/request",
        icon: FileText,
      },
    ],
  },
];
export const staffNavigation: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "My Dashboard", href: "/staff", icon: LayoutDashboard },
      {
        title: "Announcements",
        href: "/staff/announcements",
        icon: Megaphone,
      },
    ],
    collapsible: false,
  },
  {
    label: "Appointments",
    items: [
      {
        title: "Request Appointment",
        href: "/staff/appointments/book",
        icon: CalendarDays,
      },
      {
        title: "My Appointments",
        href: "/staff/appointments/reschedule",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Health Records",
    items: [
      {
        title: "My Health Records",
        href: "/staff/staffhealth/my_record",
        icon: HeartPulse,
      },
      {
        title: "Consultations",
        href: "/staff/visits/my_history",
        icon: Stethoscope,
      },
    ],
  },
  {
    label: "Clearances",
    items: [
      {
        title: "My Clearances",
        href: "/staff/clearance/my_history",
        icon: FileCheck,
      },
      {
        title: "Request Clearance",
        href: "/staff/clearance/request",
        icon: FileText,
      },
    ],
  },
];

// Builds the private patient navigation for a clinic login linked to Staff.
function clinicianMyHealthNavigation(
  role: "admin" | "doctor" | "nurse",
): NavGroup {
  return {
    label: "My Health",
    items: [
      {
        title: "My Health Records",
        href: `/${role}/my-health`,
        icon: HeartPulse,
      },
      {
        title: "My Consultations",
        href: `/${role}/my-health/consultations`,
        icon: Stethoscope,
      },
    ],
  };
}

// Returns the navigation that is permitted for the active portal role.
export function getNavigationForRole(
  role: string | null | undefined,
  hasPatientProfile = false,
) {
  if (role === "admin") {
    return hasPatientProfile
      ? [...adminNavigation, clinicianMyHealthNavigation("admin")]
      : adminNavigation;
  }
  if (role === "doctor") {
    return hasPatientProfile
      ? [...doctorNavigation, clinicianMyHealthNavigation("doctor")]
      : doctorNavigation;
  }
  if (role === "nurse") {
    return hasPatientProfile
      ? [...nurseNavigation, clinicianMyHealthNavigation("nurse")]
      : nurseNavigation;
  }
  if (role === "faculty") {
    return facultyNavigation;
  }
  if (role === "staff") {
    return staffNavigation;
  }
  return studentNavigation;
}
export const navigation = [
  ...adminNavigation,
  ...doctorNavigation,
  ...nurseNavigation,
  ...studentNavigation,
  ...facultyNavigation,
  ...staffNavigation,
  clinicianMyHealthNavigation("admin"),
  clinicianMyHealthNavigation("doctor"),
  clinicianMyHealthNavigation("nurse"),
];
export const allNavItems = navigation.flatMap((group) => group.items);
// Resolves a human-readable page title from a static route.
export function getPageTitle(pathname: string): string {
  const item = allNavItems.find((nav) => nav.href === pathname);
  return item?.title ?? "Zentraq";
}
