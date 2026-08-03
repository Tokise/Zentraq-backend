-- Frontend support objects omitted from the initial SAD schema.
-- Run this once after 001_initial_schema.sql and before using the UI.

INSERT INTO roles (name, description) VALUES
  ('admin', 'System administrator'),
  ('doctor', 'Licensed physician'),
  ('nurse', 'Clinic nurse'),
  ('student', 'Student patient'),
  ('faculty', 'Faculty patient')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_current_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "authenticated_users_view_announcements" ON announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_manage_announcements" ON announcements
  FOR ALL TO authenticated USING (is_current_admin());

CREATE TRIGGER set_announcements_timestamp
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
