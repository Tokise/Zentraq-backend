-- ============================================================
-- SECURITY MIGRATION: Harden RLS Policies & Revoke Anon Writes
-- ============================================================

-- 1. Revoke dangerous blanket permissions from anon and authenticated
REVOKE ALL ON public.clinic_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clinic_accounts FROM authenticated;

REVOKE ALL ON public.student_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.student_accounts FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.announcements FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.announcements FROM authenticated;

REVOKE ALL ON public.student_appointments FROM anon;

-- Grant minimal necessary read permissions to authenticated users
GRANT SELECT ON public.clinic_accounts TO authenticated;
GRANT SELECT ON public.student_accounts TO authenticated;
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_appointments TO authenticated;

-- 2. Helper function to check if current auth user is clinic staff (admin, doctor, nurse)
CREATE OR REPLACE FUNCTION public.is_clinic_staff()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clinic_accounts
    WHERE id = auth.uid()
    AND role::text IN ('admin', 'doctor', 'nurse')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if current auth user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clinic_accounts
    WHERE id = auth.uid()
    AND role::text = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Enable RLS on all tables
ALTER TABLE public.clinic_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

-- 4. HARDENED POLICIES FOR clinic_accounts
DROP POLICY IF EXISTS "authenticated_select_clinic_accounts" ON public.clinic_accounts;
DROP POLICY IF EXISTS "authenticated_insert_clinic_accounts" ON public.clinic_accounts;
DROP POLICY IF EXISTS "authenticated_update_clinic_accounts" ON public.clinic_accounts;
DROP POLICY IF EXISTS "authenticated_delete_clinic_accounts" ON public.clinic_accounts;

CREATE POLICY "clinic_accounts_select_policy" ON public.clinic_accounts
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_clinic_staff());

CREATE POLICY "clinic_accounts_update_policy" ON public.clinic_accounts
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- 5. HARDENED POLICIES FOR student_accounts
DROP POLICY IF EXISTS "authenticated_select_student_accounts" ON public.student_accounts;
DROP POLICY IF EXISTS "authenticated_insert_student_accounts" ON public.student_accounts;
DROP POLICY IF EXISTS "authenticated_update_student_accounts" ON public.student_accounts;
DROP POLICY IF EXISTS "anon_select_student_accounts" ON public.student_accounts;
DROP POLICY IF EXISTS "anon_insert_student_accounts" ON public.student_accounts;

CREATE POLICY "student_accounts_select_policy" ON public.student_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_clinic_staff());

CREATE POLICY "student_accounts_update_policy" ON public.student_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_clinic_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_clinic_staff());

-- 6. HARDENED POLICIES FOR announcements
DROP POLICY IF EXISTS "authenticated_select_announcements" ON public.announcements;
DROP POLICY IF EXISTS "authenticated_insert_announcements" ON public.announcements;
DROP POLICY IF EXISTS "authenticated_update_announcements" ON public.announcements;
DROP POLICY IF EXISTS "authenticated_delete_announcements" ON public.announcements;
DROP POLICY IF EXISTS "anon_select_announcements" ON public.announcements;

CREATE POLICY "announcements_select_policy" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "announcements_staff_manage_policy" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_clinic_staff())
  WITH CHECK (public.is_clinic_staff());

-- 7. HARDENED POLICIES FOR student_appointments
DROP POLICY IF EXISTS "authenticated_select_student_appointments" ON public.student_appointments;
DROP POLICY IF EXISTS "authenticated_insert_student_appointments" ON public.student_appointments;
DROP POLICY IF EXISTS "authenticated_update_student_appointments" ON public.student_appointments;
DROP POLICY IF EXISTS "authenticated_delete_student_appointments" ON public.student_appointments;

CREATE POLICY "appointments_select_policy" ON public.student_appointments
  FOR SELECT TO authenticated
  USING (student_user_id = auth.uid() OR public.is_clinic_staff());

CREATE POLICY "appointments_insert_policy" ON public.student_appointments
  FOR INSERT TO authenticated
  WITH CHECK (student_user_id = auth.uid() OR public.is_clinic_staff());

CREATE POLICY "appointments_update_policy" ON public.student_appointments
  FOR UPDATE TO authenticated
  USING (student_user_id = auth.uid() OR public.is_clinic_staff())
  WITH CHECK (student_user_id = auth.uid() OR public.is_clinic_staff());

-- 8. HARDENED POLICIES FOR consultations AND visit_logs (STAFF ONLY)
DROP POLICY IF EXISTS "staff_consultations_policy" ON public.consultations;
DROP POLICY IF EXISTS "staff_visit_logs_policy" ON public.visit_logs;

CREATE POLICY "staff_consultations_policy" ON public.consultations
  FOR ALL TO authenticated
  USING (public.is_clinic_staff())
  WITH CHECK (public.is_clinic_staff());

CREATE POLICY "staff_visit_logs_policy" ON public.visit_logs
  FOR ALL TO authenticated
  USING (public.is_clinic_staff())
  WITH CHECK (public.is_clinic_staff());
