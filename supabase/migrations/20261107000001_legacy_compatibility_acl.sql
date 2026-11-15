-- The bootstrap supplies these historical relations on new projects. Older
-- support-table migrations granted DML on every public table, including them.
-- Preserve legacy data for service-side compatibility without reopening direct
-- client access (including permissive policies retained in restored databases).
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_archive_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_members, public.story_artifacts, public.public_archive_entries, public.waitlist
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.project_members, public.story_artifacts, public.public_archive_entries, public.waitlist
  TO service_role;
