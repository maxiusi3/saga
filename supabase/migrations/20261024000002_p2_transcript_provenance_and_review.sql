-- =============================================================================
-- Migration: 20261024000002_p2_transcript_provenance_and_review.sql
-- Purpose:
--   Establish the Phase P2 faithful AI & family review data foundation
--   (T06 versioned transcripts & segments, T07 provenance-bound story
--   assertions & immutable approved revisions, T08 multi-member family review
--   decisions & disputed memory preservation).
-- =============================================================================

-- 1. T06: transcript_versions & transcript_segments
CREATE TABLE IF NOT EXISTS public.transcript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  version integer NOT NULL CHECK (version > 0),
  language text NOT NULL DEFAULT 'en',
  provider text NOT NULL,
  model text NOT NULL,
  alignment_status text NOT NULL DEFAULT 'aligned'
    CHECK (alignment_status IN ('aligned', 'legacy_unaligned', 'human_corrected')),
  content_sha256 text NOT NULL CHECK (content_sha256 ~* '^[a-f0-9]{64}$'),
  full_text text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, version)
);

CREATE INDEX IF NOT EXISTS idx_transcript_versions_story_current
  ON public.transcript_versions(story_id, is_current);

CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  transcript_version_id uuid NOT NULL REFERENCES public.transcript_versions(id) ON DELETE CASCADE,
  segment_index integer NOT NULL CHECK (segment_index >= 0),
  speaker_label text NOT NULL DEFAULT 'storyteller',
  start_ms integer CHECK (start_ms IS NULL OR start_ms >= 0),
  end_ms integer CHECK (end_ms IS NULL OR (start_ms IS NOT NULL AND end_ms >= start_ms)),
  text text NOT NULL,
  confidence numeric(5, 4) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  is_human_corrected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transcript_version_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_version
  ON public.transcript_segments(transcript_version_id, segment_index);

-- 2. T07 & T08: story_assertions (Provenance-verified core facts & family review)
CREATE TABLE IF NOT EXISTS public.story_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  transcript_version_id uuid NOT NULL REFERENCES public.transcript_versions(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.transcript_segments(id) ON DELETE SET NULL,
  assertion_type text NOT NULL
    CHECK (assertion_type IN ('person', 'relation', 'year_date', 'place', 'event', 'quote')),
  subject text NOT NULL,
  claim_text text NOT NULL,
  source_quote text,
  start_ms integer CHECK (start_ms IS NULL OR start_ms >= 0),
  end_ms integer CHECK (end_ms IS NULL OR (start_ms IS NOT NULL AND end_ms >= start_ms)),
  date_precision text NOT NULL DEFAULT 'exact'
    CHECK (date_precision IN ('exact', 'approximate_year', 'decade', 'unknown', 'not_applicable')),
  memory_attribution text NOT NULL DEFAULT 'storyteller_memory'
    CHECK (memory_attribution IN ('storyteller_memory', 'external_corroborated', 'family_supplement', 'disputed_memory')),
  verification_status text NOT NULL DEFAULT 'pending_review'
    CHECK (verification_status IN ('verified', 'unverified_rejected', 'family_supplement', 'disputed', 'pending_review', 'invalidated')),
  review_decision text NOT NULL DEFAULT 'unreviewed'
    CHECK (review_decision IN ('unreviewed', 'accepted', 'modified', 'disputed', 'skipped', 'rejected')),
  is_severe_fabrication boolean NOT NULL DEFAULT false,
  disputed_alternative_text text,
  disputed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_assertions_story_version
  ON public.story_assertions(story_id, transcript_version_id);

-- 3. T07 & T08: story_revisions (Versioned drafts & immutable approved snapshots)
CREATE TABLE IF NOT EXISTS public.story_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  transcript_version_id uuid NOT NULL REFERENCES public.transcript_versions(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'superseded', 'invalidated')),
  title text NOT NULL,
  body text NOT NULL,
  summary text NOT NULL,
  provenance_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_sha256 text NOT NULL CHECK (content_sha256 ~* '^[a-f0-9]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_story_revisions_story_status
  ON public.story_revisions(story_id, status);

-- Prevent overwriting the content of an already-approved story_revision
CREATE OR REPLACE FUNCTION public.prevent_approved_story_revision_overwrite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.transcript_version_id IS DISTINCT FROM OLD.transcript_version_id
       OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
       OR NEW.status NOT IN ('approved', 'superseded') THEN
      RAISE EXCEPTION 'Approved story revision snapshot is immutable and cannot be overwritten'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_approved_story_revision_overwrite ON public.story_revisions;
CREATE TRIGGER trg_prevent_approved_story_revision_overwrite
  BEFORE UPDATE ON public.story_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_approved_story_revision_overwrite();

-- 4. RLS & Least-Privilege Grants on P2 Tables
ALTER TABLE public.transcript_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.transcript_versions,
  public.transcript_segments,
  public.story_assertions,
  public.story_revisions
FROM anon, authenticated;

GRANT SELECT ON
  public.transcript_versions,
  public.transcript_segments,
  public.story_assertions,
  public.story_revisions
TO authenticated;

GRANT ALL ON
  public.transcript_versions,
  public.transcript_segments,
  public.story_assertions,
  public.story_revisions
TO service_role;

DROP POLICY IF EXISTS "transcript_versions_select_active_member" ON public.transcript_versions;
CREATE POLICY "transcript_versions_select_active_member" ON public.transcript_versions
  FOR SELECT TO authenticated
  USING (
    public.is_active_project_member(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.deletion_requests dr
      WHERE dr.project_id = transcript_versions.project_id
        AND dr.subject_id = transcript_versions.story_id::text
        AND dr.tombstone_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "transcript_segments_select_active_member" ON public.transcript_segments;
CREATE POLICY "transcript_segments_select_active_member" ON public.transcript_segments
  FOR SELECT TO authenticated
  USING (public.is_active_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "story_assertions_select_active_member" ON public.story_assertions;
CREATE POLICY "story_assertions_select_active_member" ON public.story_assertions
  FOR SELECT TO authenticated
  USING (
    public.is_active_project_member(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.deletion_requests dr
      WHERE dr.project_id = story_assertions.project_id
        AND dr.subject_id = story_assertions.story_id::text
        AND dr.tombstone_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "story_revisions_select_active_member" ON public.story_revisions;
CREATE POLICY "story_revisions_select_active_member" ON public.story_revisions
  FOR SELECT TO authenticated
  USING (
    public.is_active_project_member(project_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.deletion_requests dr
      WHERE dr.project_id = story_revisions.project_id
        AND dr.subject_id = story_revisions.story_id::text
        AND dr.tombstone_at IS NOT NULL
    )
  );
