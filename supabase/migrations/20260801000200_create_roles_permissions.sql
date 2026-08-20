-- Roles and Permissions system for RBAC
-- Roles are stored as named entities; clinic_accounts.role references these.
-- Permissions are granular actions on resources.

CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_deletable BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- Indexes
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions (role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions (permission_id);
CREATE INDEX idx_roles_name ON public.roles (name);
CREATE INDEX idx_permissions_resource ON public.permissions (resource);
CREATE INDEX idx_permissions_action ON public.permissions (action);

-- Updated_at trigger for roles
CREATE OR REPLACE FUNCTION public.trigger_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_roles_updated_at();

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can read roles and permissions (for UI display).
CREATE POLICY "Authenticated users can read roles"
  ON public.roles FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read permissions"
  ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE on roles/permissions is performed exclusively via Server Actions
-- with createAdminClient() (Service Role). No browser-facing INSERT/UPDATE/DELETE policies.
-- This enforces the Principle of Least Privilege at the database layer.

-- Seed default roles aligned with existing UserRole type
INSERT INTO public.roles (name, description, is_deletable) VALUES
  ('admin', 'Full system administrator with all permissions', false),
  ('doctor', 'Clinical doctor with full clinical access', true),
  ('nurse', 'Clinic nurse with standard clinical access', true),
  ('receptionist', 'Front desk receptionist', true),
  ('student', 'Student patient', true),
  ('faculty', 'Faculty member', true);

-- Seed default permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('view_consultations', 'consultations', 'read', 'Can view consultation queue and records'),
  ('manage_consultations', 'consultations', 'write', 'Can create and update consultations'),
  ('view_appointments', 'appointments', 'read', 'Can view appointment queues'),
  ('manage_appointments', 'appointments', 'write', 'Can create, update, and cancel appointments'),
  ('view_medical_records', 'medical_records', 'read', 'Can view medical records and visit logs'),
  ('manage_medical_records', 'medical_records', 'write', 'Can create and modify medical records'),
  ('manage_students', 'students', 'write', 'Can create, edit, and archive student accounts'),
  ('manage_faculty', 'faculty', 'write', 'Can create, edit, and manage faculty accounts'),
  ('manage_clinic_accounts', 'clinic_accounts', 'write', 'Can create and remove clinic staff accounts'),
  ('manage_roles', 'roles', 'write', 'Can create, update, and delete roles'),
  ('manage_permissions', 'permissions', 'write', 'Can assign and remove permissions from roles'),
  ('manage_services', 'services', 'write', 'Can create, edit, archive, and restore services'),
  ('manage_settings', 'settings', 'write', 'Can modify system configuration and settings'),
  ('send_notifications', 'notifications', 'write', 'Can create and send notifications to specific users'),
  ('manage_inventory', 'inventory', 'write', 'Can manage clinic inventory and medication'),
  ('view_reports', 'reports', 'read', 'Can view analytics and reports');
