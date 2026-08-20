-- Stores resumable wizard input separately from finalized clinical records.
CREATE TABLE public.consultation_drafts (
  consultation_id UUID PRIMARY KEY REFERENCES public.consultations(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'details',
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (current_step IN ('details', 'vitals', 'notes', 'diagnosis', 'prescription', 'follow_up', 'review'))
);

ALTER TABLE public.consultation_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical operators manage consultation drafts"
  ON public.consultation_drafts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN ('admin', 'doctor', 'nurse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN ('admin', 'doctor', 'nurse')
    )
  );

CREATE INDEX consultation_drafts_updated_at_idx
  ON public.consultation_drafts (updated_at DESC);
