-- Publishes queue changes to authenticated clinical workspaces.
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_queue_entries;
