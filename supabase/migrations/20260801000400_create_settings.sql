-- Admin Settings module: Key-value configuration store for system-wide settings
-- Categories: clinic_info, school_info, operating_hours, notification_prefs, rfid, password_policy, security, system

CREATE TABLE public.settings (
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT NOT NULL CHECK (category = ANY (ARRAY[
    'clinic_info', 'school_info', 'operating_hours', 'notification_prefs',
    'rfid', 'password_policy', 'security', 'system'
  ]::text[])),
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT settings_pkey PRIMARY KEY (key)
);

-- Indexes
CREATE INDEX idx_settings_category ON public.settings (category);
CREATE INDEX idx_settings_updated_at ON public.settings (updated_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.trigger_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_settings_updated_at();

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read public settings (e.g., operating hours displayed on kiosk).
CREATE POLICY "Anyone can read public settings"
  ON public.settings FOR SELECT
  USING (is_public = true);

-- RLS: Authenticated users can read non-public settings (needed for admin UI).
CREATE POLICY "Authenticated users can read all settings"
  ON public.settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE performed exclusively via Server Actions with createAdminClient().
-- No browser-facing INSERT/UPDATE/DELETE policies (Principle of Least Privilege).

-- Seed default settings
INSERT INTO public.settings (key, value, category, description, is_public) VALUES
  ('clinic_name', '"Cruz Clinic"', 'clinic_info', 'Name of the clinic', true),
  ('clinic_address', '"123 Healing Street, Manila"', 'clinic_info', 'Physical address of the clinic', true),
  ('clinic_phone', '"(02) 1234-5678"', 'clinic_info', 'Contact phone number', true),
  ('school_name', '"Manila University"', 'school_info', 'Name of the affiliated school', true),
  ('school_address', '"University Avenue, Manila"', 'school_info', 'School physical address', true),
  ('operating_hours', '{"monday": {"open": "08:00", "close": "17:00"}, "tuesday": {"open": "08:00", "close": "17:00"}, "wednesday": {"open": "08:00", "close": "17:00"}, "thursday": {"open": "08:00", "close": "17:00"}, "friday": {"open": "08:00", "close": "16:00"}}', 'operating_hours', 'Clinic operating hours by day of week', true),
  ('notification_preferences', '{"email_notifications": true, "in_app_notifications": true, "low_stock_alerts": true}', 'notification_prefs', 'Global notification preferences', false),
  ('rfid_settings', '{"auto_assign": true, "require_rfid_for_checkin": false}', 'rfid', 'RFID registration and check-in settings', false),
  ('password_policy', '{"min_length": 12, "require_uppercase": true, "require_lowercase": true, "require_number": true, "require_special": true, "password_expiry_days": 90}', 'password_policy', 'Password security policy', false),
  ('security_settings', '{"session_timeout_minutes": 180, "max_login_attempts": 5, "lockout_duration_minutes": 30, "one_device_login": true}', 'security', 'Security and session management settings', false),
  ('system_info', '{"version": "1.0.0", "maintenance_mode": false, "environment": "production"}', 'system', 'System version and environment info', true);
