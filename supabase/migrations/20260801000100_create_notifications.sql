-- Notification system: database-backed, user-specific notifications
-- Each notification belongs to exactly one receiver; no broadcasts unless explicitly intended.

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = ANY (ARRAY[
    'appointment', 'consultation', 'emergency', 'visit_log',
    'system', 'rfid', 'clearance', 'service'
  ]::text[])),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_resource TEXT,
  related_resource_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX idx_notifications_receiver_id ON public.notifications (receiver_id);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_receiver_unread ON public.notifications (receiver_id, is_read)
  WHERE is_deleted = false;
CREATE INDEX idx_notifications_sender_id ON public.notifications (sender_id);
CREATE INDEX idx_notifications_type ON public.notifications (type);

-- Triggers to auto-update updated_at
CREATE OR REPLACE FUNCTION public.trigger_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_notifications_updated_at();

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read (SELECT) their own notifications that are not soft-deleted.
-- The browser must never be able to query another user's notifications.
CREATE POLICY "Users can view their own non-deleted notifications"
  ON public.notifications
  FOR SELECT
  USING (receiver_id = auth.uid() AND is_deleted = false);

-- RLS: Users can update (mark read / soft delete) their own notifications.
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (receiver_id = auth.uid());

-- NOTE: INSERT is performed exclusively via Server Actions with createAdminClient()
-- (Service Role bypasses RLS). No policy is needed for INSERT because the
-- application layer (Server Actions + requireAdmin/requireClinicStaff) is the
-- sole authorized path. This follows the Principle of Least Privilege: the
-- browser-facing client never has direct INSERT access to the notifications table.
-- If RLS is disabled for INSERT, it is intentional and restricted to the service role.
-- INSERT policy (defense-in-depth): only allow if the receiver_id equals the auth user.
CREATE POLICY "Users can insert notifications for themselves only"
  ON public.notifications
  FOR INSERT
  WITH CHECK (receiver_id = auth.uid());
