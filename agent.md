# Design System

Zentraq is a standalone Clinic Management System.

It is NOT part of a multi-system dashboard.

Do NOT generate pages that display other school subsystems such as:

- Library
- Finance
- HR
- Property
- Alumni
- Attendance

The application should behave as if the Clinic Management System is the entire product.

The Dashboard should only display clinic-related information.

---

# UI Philosophy

Design inspiration should resemble modern SaaS dashboards such as

- Linear
- Vercel Dashboard
- Clerk Dashboard
- Supabase Dashboard
- Notion
- Stripe Dashboard

The interface must feel

- Professional
- Medical
- Minimal
- Spacious
- Clean
- Enterprise

Avoid flashy UI.

Avoid unnecessary gradients.

Avoid rainbow colors.

Avoid colorful icons.

Prioritize readability over decoration.

---

# Dashboard Layout

The Dashboard should never contain cards representing different subsystems.

❌ Do NOT generate

Library

Finance

Property

Attendance

HR

etc.

Instead generate

- Welcome section
- KPI statistics
- Today's appointments
- Recent consultations
- Medicine inventory alerts
- Emergency cases
- Notifications
- Recent activities
- AI insights
- Calendar
- Charts

The Dashboard should immediately communicate the operational status of the clinic.

---

# Sidebar Structure

The sidebar should only contain Clinic Management features.

Example

Dashboard

PATIENTS

- Patients
- Medical Records
- RFID Registration

CONSULTATIONS

- Consultations
- Visit Logs
- Emergency Cases

APPOINTMENTS

- Calendar
- Queue

PHARMACY

- Medicines
- Dispensing
- Inventory

HEALTH SERVICES

- Faculty & Staff
- Health Programs
- Health Clearance

REPORTS

- Analytics
- Compliance

ADMINISTRATION

- Users
- Roles
- Audit Logs
- Settings

Never generate navigation for unrelated school systems.

---

# Icons

Use Lucide React icons.

Icons should use a single neutral color.

Never use rainbow colored icons.

Never assign random colors to each menu item.

Never generate icon backgrounds with different colors.

Preferred icon colors

Light Mode

#52525B

Dark Mode

#D4D4D8

Icons should inherit the current text color whenever possible.

Icons should communicate hierarchy rather than decoration.

---

# Color System

Use a monochromatic design.

Primary

#111111

Background

#FFFFFF

Surface

#FAFAFA

Sidebar

#FFFFFF

Borders

#E5E7EB

Hover

#F5F5F5

Muted

#71717A

Dark Background

#09090B

Dark Surface

#18181B

Dark Border

#27272A

Success

#16A34A

Warning

#D97706

Danger

#DC2626

Info

#2563EB

Status colors should only appear for badges, alerts, charts, and notifications.

Never use status colors as decorative icon colors.

---

# Cards

Cards should use

- white background
- subtle border
- rounded corners
- minimal shadow

Avoid large shadows.

Avoid glassmorphism.

Avoid neumorphism.

---

# Statistics Cards

Dashboard statistics should use simple cards.

Example

Patients Today

124

+8%

Instead of decorative illustrations.

Cards should prioritize information density.

---

# Tables

Use modern data tables.

Features

- Search
- Filters
- Pagination
- Column sorting
- Bulk actions
- Row actions

Avoid overly colorful table headers.

---

# Buttons

Primary

Black

Secondary

White with border

Destructive

Red

Success

Green

Avoid gradients.

Avoid glowing buttons.

---

# Charts

Charts should use restrained colors.

Preferred palette

Gray

Black

Emerald

Blue

Do not generate charts with many unrelated colors.

---

# Typography

Font

Geist
or

Inter

Hierarchy

Page Title

32px

Section Title

20px

Card Title

16px

Body

14px

Caption

12px

Use consistent spacing.

Avoid oversized typography.

---

# Animations

Animations should be subtle.

Use

- fade
- slide
- scale

Avoid

- bouncing
- spinning
- excessive motion

Keep transitions below 200ms whenever appropriate.

---

# Responsive Design

Support

Desktop

Tablet

Mobile

Sidebar should collapse automatically on smaller screens.

Tables should become responsive without horizontal overflow whenever possible.

---

# Accessibility

Maintain proper color contrast.

Support keyboard navigation.

Use semantic HTML.

Include ARIA labels where appropriate.

Focus states must always be visible.

---

# AI UI Rules

Whenever generating a new page, always ask:

Does this look like software a real clinic would purchase?

If not,

simplify it.

Remove unnecessary colors.

Remove decorative elements.

Prioritize usability.

# Consistency Rules

Every page in Zentraq must feel like it was designed by the same designer.

Never redesign components for different pages.

Always reuse

- Cards
- Buttons
- Inputs
- Tables
- Dialogs
- Badges
- Charts
- Forms
- Navigation

Spacing, border radius, shadows, typography, and colors must remain consistent throughout the application.

When implementing a new feature, extend the existing design system instead of creating a new visual style.

# RFID Integration

Zentraq shall implement RFID as the primary patient identification method.

RFID is not an attendance system.

RFID acts as the patient's digital identity within the Clinic Management System.

When an RFID card is scanned, the system should automatically retrieve the associated profile and display all relevant clinic information without requiring manual search.

RFID should support:

- Student Identification
- Faculty Identification
- Staff Identification

Every RFID scan should be logged in the audit trail.

The RFID reader must communicate with a Supabase Edge Function.

The Edge Function is responsible for:

- validating requests
- locating the RFID owner
- returning authorized profile data
- preventing unauthorized access
- logging scan history

The browser must never query sensitive RFID data directly.

---

# RFID Registration

The preferred source of RFID registration is the official School Enrollment System.

The Enrollment System should expose an API that registers:

- RFID UID
- Student ID
- Faculty ID
- Employee ID

If the Enrollment API is unavailable, Zentra shall provide a fallback registration module.

The fallback registration process shall:

- register the RFID UID
- collect clinic-specific profile information
- capture a new clinic profile photo
- link the RFID to the user's clinic profile

The fallback registration is a one-time process.

Once linked, future RFID scans should immediately identify the user.

---

# RFID-Based Workflow

Whenever an RFID card is scanned, the system should automatically:

1. Identify the profile.
2. Open the patient's dashboard.
3. Load active appointments.
4. Load medical records.
5. Load consultation history.
6. Load laboratory results.
7. Load health clearances.
8. Display allergies and medical alerts.
9. Allow doctors or nurses to continue their workflow without manual data entry.

Manual searching should only be used as a fallback when RFID identification fails.

# External System Integration

Zentraq is the authoritative source for all clinic-related data.

External systems, such as the School Enrollment System, are considered identity providers only.

The Enrollment System should expose an API that provides identity information for students, faculty, and staff.

Zentraq shall never depend on the Enrollment API for real-time RFID identification.

Instead, identity information must be synchronized into Zentra's local database.

After synchronization, all RFID lookups, searches, and clinic workflows shall use the local database.

This ensures:

- Fast RFID identification
- Offline resilience if external systems are unavailable
- Reduced API requests
- Independent clinic operations
- Better system performance

---

# Identity Synchronization

Identity synchronization should occur only when necessary.

Supported synchronization methods include:

- Initial registration
- Manual administrator synchronization
- Scheduled synchronization
- Event-based synchronization (if supported by the external system)

Only identity-related fields may be synchronized.

Examples include:

- Student Number
- Employee Number
- RFID UID
- First Name
- Last Name
- Email Address
- Department
- Course
- Year Level
- Position
- Active Status

Clinic-owned data must never be overwritten by synchronization.

Examples of clinic-owned data include:

- Medical Records
- Consultation History
- Prescriptions
- Laboratory Results
- Health Clearances
- Appointments
- Vital Signs
- AI Assessments
- Clinic Profile Photos
- Audit Logs

---

# RFID Identification

RFID identification must always use Zentra's local database.

The RFID workflow shall be:

RFID Reader
→ Supabase Edge Function
→ Zentra Database
→ Patient Identification
→ Open Patient Dashboard

The system must not perform an external Enrollment API request during every RFID scan.

---

# Enrollment API Failure

If the Enrollment API is unavailable or not provided by another subsystem, Zentraq shall operate independently.

The system shall provide a one-time Clinic Registration module.

The registration module shall:

- Register the RFID UID
- Capture clinic-specific profile information
- Capture a dedicated clinic profile photo
- Link the RFID card to a local clinic profile

Once registered, all future RFID scans shall use the locally stored profile without requiring any external dependency.

---

# Data Ownership

The School Enrollment System owns academic identity data.

Zentra owns healthcare and clinic data.

No external system shall modify clinic-managed records.

Synchronization is one-way unless explicitly configured otherwise.