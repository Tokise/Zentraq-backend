-- ============================================
-- ZenTraq Admin Module Tables & Schema Fixes
-- Fixes:
--   1. Creates missing `settings` table
--   2. Creates missing `services` table
--   3. Aligns `permissions` schema with application code
--   4. Resolves `announcements` RLS function conflict
-- ============================================

-- ============================================
-- 0. HELPER FUNCTIONS (defined first so policies below can reference them)
-- ============================================

-- The `is_admin()` function checks clinic_accounts.role == 'admin'.
-- This matches the definition in database/rls/policies.sql. It is recreated here
-- so this migration is self-contained and does not depend on RLS policy ordering.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM clinic_accounts
    WHERE user_id = auth.uid();

    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    category TEXT NOT NULL DEFAULT 'system',
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Settings are managed exclusively via Server Actions using the service role.
-- No `authenticated` role policies are created — the browser never queries this table directly.
CREATE POLICY "settings_admin_all" ON settings
    FOR ALL TO authenticated USING (is_admin());

CREATE TRIGGER set_settings_timestamp
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Seed default settings
INSERT INTO settings (key, value, category, description, is_public) VALUES
    ('clinic_info', jsonb_build_object(
        'name', 'University Health Services Clinic',
        'address', '',
        'phone', '',
        'email', ''
    ), 'clinic_info', 'Clinic name, address, and contact information', FALSE),
    ('school_info', jsonb_build_object(
        'name', '',
        'academic_year', '',
        'semester', ''
    ), 'school_info', 'School information for certificates and reports', FALSE),
    ('operating_hours', jsonb_build_object(
        'monday_open', '08:00', 'monday_close', '17:00',
        'tuesday_open', '08:00', 'tuesday_close', '17:00',
        'wednesday_open', '08:00', 'wednesday_close', '17:00',
        'thursday_open', '08:00', 'thursday_close', '17:00',
        'friday_open', '08:00', 'friday_close', '17:00',
        'saturday_open', '', 'saturday_close', '',
        'sunday_open', '', 'sunday_close', ''
    ), 'operating_hours', 'Clinic operating hours per day', FALSE),
    ('notification_prefs', jsonb_build_object(
        'appointment_reminders', TRUE,
        'clearance_updates', TRUE,
        'inventory_alerts', TRUE,
        'incident_alerts', TRUE
    ), 'notification_prefs', 'System notification preferences', FALSE),
    ('rfid', jsonb_build_object(
        'student_id_prefix', '23011',
        'kiosk_enabled', TRUE,
        'auto_checkin', TRUE
    ), 'rfid', 'RFID system configuration', FALSE),
    ('password_policy', jsonb_build_object(
        'min_length', 12,
        'require_uppercase', TRUE,
        'require_lowercase', TRUE,
        'require_number', TRUE,
        'require_special', TRUE
    ), 'password_policy', 'Password complexity requirements', FALSE),
    ('security', jsonb_build_object(
        'session_timeout_minutes', 60,
        'max_login_attempts', 5,
        'one_device_login', TRUE,
        'audit_log_retention_days', 365
    ), 'security', 'Security configuration', FALSE),
    ('system', jsonb_build_object(
        'maintenance_mode', FALSE,
        'version', '1.0.0',
        'timezone', 'Asia/Manila'
    ), 'system', 'System configuration', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. SERVICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other'
        CHECK (category IN ('health_program', 'medical_clearance', 'consultation_service', 'other')),
    duration_minutes INTEGER,
    price NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_is_archived ON services(is_archived);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Services are managed exclusively via Server Actions using the service role.
-- No `authenticated` role policies are created — the browser never queries this table directly.
CREATE POLICY "services_admin_all" ON services
    FOR ALL TO authenticated USING (is_admin());

CREATE TRIGGER set_services_timestamp
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================
-- 3. ROLES & PERMISSIONS SCHEMA ALIGNMENT
-- ============================================
-- The application code (actions/admin/useraccess/roles.ts) expects:
--   roles: id, name, description, is_deletable, created_at, updated_at
--   permissions: id, name, resource, action, description
-- The original schema (001) only had:
--   roles: id, name, description, created_at
--   permissions: id, code, description
-- This migration adds the missing columns and backfills them.

-- Roles: add is_deletable and updated_at
ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS is_deletable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Protect the five seeded system roles from deletion
UPDATE roles SET is_deletable = FALSE
WHERE name IN ('admin', 'doctor', 'nurse', 'student', 'faculty');

DROP TRIGGER IF EXISTS set_roles_timestamp ON roles;
CREATE TRIGGER set_roles_timestamp
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Permissions: add name, resource, action
ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS resource TEXT,
    ADD COLUMN IF NOT EXISTS action TEXT;

-- Backfill name/resource/action from code (e.g. "appointment.view" → resource="appointment", action="view")
UPDATE permissions
SET
    name = COALESCE(name, code),
    resource = COALESCE(resource, split_part(code, '.', 1)),
    action = COALESCE(action, split_part(code, '.', 2))
WHERE name IS NULL OR resource IS NULL OR action IS NULL;

-- Ensure name is unique for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_name_unique ON permissions(name) WHERE name IS NOT NULL;

-- Seed standard permissions if the table is empty
INSERT INTO permissions (code, name, resource, action, description) VALUES
    ('appointment.view', 'appointment.view', 'appointment', 'view', 'View appointments'),
    ('appointment.create', 'appointment.create', 'appointment', 'create', 'Create appointments'),
    ('appointment.approve', 'appointment.approve', 'appointment', 'approve', 'Approve appointments'),
    ('appointment.reject', 'appointment.reject', 'appointment', 'reject', 'Reject appointments'),
    ('record.view', 'record.view', 'record', 'view', 'View medical records'),
    ('record.update', 'record.update', 'record', 'update', 'Update medical records'),
    ('record.create', 'record.create', 'record', 'create', 'Create medical records'),
    ('consultation.view', 'consultation.view', 'consultation', 'view', 'View consultations'),
    ('consultation.create', 'consultation.create', 'consultation', 'create', 'Create consultations'),
    ('consultation.update', 'consultation.update', 'consultation', 'update', 'Update consultations'),
    ('inventory.view', 'inventory.view', 'inventory', 'view', 'View medicine inventory'),
    ('inventory.manage', 'inventory.manage', 'inventory', 'manage', 'Manage medicine inventory'),
    ('inventory.dispense', 'inventory.dispense', 'inventory', 'dispense', 'Dispense medicine'),
    ('prescription.write', 'prescription.write', 'prescription', 'write', 'Write prescriptions'),
    ('prescription.view', 'prescription.view', 'prescription', 'view', 'View prescriptions'),
    ('incident.view', 'incident.view', 'incident', 'view', 'View incidents'),
    ('incident.manage', 'incident.manage', 'incident', 'manage', 'Manage incidents'),
    ('clearance.view', 'clearance.view', 'clearance', 'view', 'View health clearances'),
    ('clearance.process', 'clearance.process', 'clearance', 'process', 'Process health clearances'),
    ('clearance.approve', 'clearance.approve', 'clearance', 'approve', 'Approve health clearances'),
    ('report.view', 'report.view', 'report', 'view', 'View reports'),
    ('report.generate', 'report.generate', 'report', 'generate', 'Generate reports'),
    ('user.manage', 'user.manage', 'user', 'manage', 'Manage user accounts'),
    ('role.assign', 'role.assign', 'role', 'assign', 'Assign roles'),
    ('system.config', 'system.config', 'system', 'config', 'Configure system settings'),
    ('audit.view', 'audit.view', 'audit', 'view', 'View audit logs'),
    ('rfid.register', 'rfid.register', 'rfid', 'register', 'Register RFID cards'),
    ('rfid.checkin', 'rfid.checkin', 'rfid', 'checkin', 'RFID check-in')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 3b. BACKFILL PRESET PERMISSIONS FOR SEEDED ROLES
-- ============================================
-- The five seeded roles (admin, doctor, nurse, student, faculty) were created
-- in migration 002 without role_permissions assignments. This backfill assigns
-- their predefined permission sets (SAD §4.7 Global Permission Matrix) so the
-- permission assignment modal shows them pre-populated — no manual assignment needed.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    -- admin
    'appointment.view', 'appointment.create', 'appointment.approve', 'appointment.reject',
    'record.view', 'consultation.view', 'inventory.view', 'inventory.manage',
    'prescription.view', 'incident.view', 'incident.manage', 'clearance.view',
    'clearance.process', 'clearance.approve', 'report.view', 'report.generate',
    'user.manage', 'role.assign', 'system.config', 'audit.view',
    'rfid.register', 'rfid.checkin'
)
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    -- doctor
    'appointment.view', 'record.view', 'record.update', 'consultation.view',
    'consultation.create', 'consultation.update', 'inventory.view', 'prescription.view',
    'prescription.write', 'incident.view', 'incident.manage', 'clearance.view',
    'report.view', 'rfid.checkin'
)
WHERE r.name = 'doctor'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    -- nurse
    'appointment.view', 'appointment.create', 'appointment.approve', 'appointment.reject',
    'record.view', 'record.update', 'consultation.view', 'consultation.create',
    'consultation.update', 'inventory.view', 'inventory.dispense', 'prescription.view',
    'incident.view', 'incident.manage', 'clearance.view', 'clearance.process',
    'report.view', 'rfid.checkin'
)
WHERE r.name = 'nurse'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    -- student
    'appointment.view', 'appointment.create', 'record.view', 'consultation.view',
    'prescription.view', 'clearance.view', 'rfid.checkin'
)
WHERE r.name = 'student'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    -- faculty
    'appointment.view', 'appointment.create', 'record.view', 'consultation.view',
    'prescription.view', 'clearance.view', 'rfid.checkin'
)
WHERE r.name = 'faculty'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 4. ANNOUNCEMENTS RLS FUNCTION RESOLUTION
-- ============================================
-- Migration 002 created `is_current_admin()` (SQL SECURITY DEFINER) for announcements.
-- This migration is self-contained: it (re)creates the function so the policy below
-- does not depend on migration 002 having been applied.
-- The function checks the user_roles → roles mapping for the 'admin' role.

CREATE OR REPLACE FUNCTION is_current_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Ensure the announcements table has proper RLS policies.
-- The `authenticated_users_view_announcements` policy allows all authenticated users to
-- READ announcements (public announcements are not sensitive). Management is admin-only.
DROP POLICY IF EXISTS "authenticated_users_view_announcements" ON announcements;
CREATE POLICY "authenticated_users_view_announcements" ON announcements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_manage_announcements" ON announcements;
CREATE POLICY "admins_manage_announcements" ON announcements
    FOR ALL TO authenticated USING (is_current_admin());

-- ============================================
-- 5. END OF MIGRATION
-- ============================================
