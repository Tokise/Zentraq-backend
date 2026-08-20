-- Faculty Accounts module
-- Mirrors the student_accounts pattern: auth user linked to a faculty profile.
-- Faculty are clinic staff with role 'doctor' or 'nurse' in clinic_accounts.

CREATE TABLE public.faculty_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  rfid_uid TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  employee_number TEXT UNIQUE,
  department TEXT,
  position TEXT,
  specialization TEXT,
  clinic_license TEXT,
  phone TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  current_session_token TEXT,
  CONSTRAINT faculty_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_faculty_accounts_user_id ON public.faculty_accounts (user_id);
CREATE INDEX idx_faculty_accounts_email ON public.faculty_accounts (email);
CREATE INDEX idx_faculty_accounts_employee_number ON public.faculty_accounts (employee_number);
CREATE INDEX idx_faculty_accounts_department ON public.faculty_accounts (department);
CREATE INDEX idx_faculty_accounts_active_status ON public.faculty_accounts (active_status) WHERE archived_at IS NULL;
CREATE INDEX idx_faculty_accounts_archived_at ON public.faculty_accounts (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX idx_faculty_accounts_rfid_uid ON public.faculty_accounts (rfid_uid);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.trigger_faculty_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER faculty_accounts_updated_at
  BEFORE UPDATE ON public.faculty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_faculty_accounts_updated_at();

-- Enable RLS
ALTER TABLE public.faculty_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read faculty accounts (for internal clinic use).
CREATE POLICY "Authenticated users can read faculty accounts"
  ON public.faculty_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE performed exclusively via Server Actions with createAdminClient().
-- No browser-facing INSERT/UPDATE/DELETE policies (Principle of Least Privilege).
