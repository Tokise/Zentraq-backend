-- Services module: Health Programs and Medical Clearance Services
-- Supports CRUD lifecycle: Create, Edit, Archive, Restore, Search, Pagination

CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category = ANY (ARRAY[
    'health_program', 'medical_clearance', 'consultation_service', 'other'
  ]::text[])),
  duration_minutes INTEGER,
  price NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT services_pkey PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX idx_services_category ON public.services (category);
CREATE INDEX idx_services_is_active ON public.services (is_active) WHERE is_archived = false;
CREATE INDEX idx_services_is_archived ON public.services (is_archived);
CREATE INDEX idx_services_name ON public.services (name);
CREATE INDEX idx_services_created_at ON public.services (created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.trigger_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trigger_services_updated_at();

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated clinic staff can read active (non-archived) services.
CREATE POLICY "Staff can read active services"
  ON public.services FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_archived = false AND is_active = true);

-- RLS: Staff can also read archived services (for archive view).
CREATE POLICY "Staff can read archived services"
  ON public.services FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_archived = true);

-- INSERT/UPDATE/DELETE performed exclusively via Server Actions with createAdminClient().
-- No browser-facing INSERT/UPDATE/DELETE policies (Principle of Least Privilege).
