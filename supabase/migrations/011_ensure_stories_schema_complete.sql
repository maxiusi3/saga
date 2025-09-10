-- Ensure stories table has all required columns for AI processing
-- This migration ensures the schema is complete and matches the application expectations

BEGIN;

-- Ensure all AI-related columns exist (safe to run multiple times)
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_generated_title VARCHAR(255);

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_follow_up_questions JSONB;

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3,2);

-- Ensure audio_url is nullable
ALTER TABLE stories 
ALTER COLUMN audio_url DROP NOT NULL;

-- Update status constraint to include all needed states
ALTER TABLE stories 
DROP CONSTRAINT IF EXISTS stories_status_check;

ALTER TABLE stories 
ADD CONSTRAINT stories_status_check 
CHECK (status IN ('processing', 'ready', 'failed', 'draft'));

-- Add missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_stories_ai_confidence ON stories(ai_confidence_score);
CREATE INDEX IF NOT EXISTS idx_stories_content ON stories USING gin(to_tsvector('english', content));

-- Fix RLS policies for stories table (ensure they work with simplified project_roles)
DROP POLICY IF EXISTS "Users can view stories for their projects" ON stories;
DROP POLICY IF EXISTS "Storytellers can create their own stories" ON stories;
DROP POLICY IF EXISTS "Storytellers can update their own stories" ON stories;
DROP POLICY IF EXISTS "Facilitators can update stories in their projects" ON stories;

-- Create simplified stories policies that work with our current RLS setup
CREATE POLICY "Users can view stories in their projects" ON stories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "Users can create stories in their projects" ON stories
  FOR INSERT
  WITH CHECK (
    auth.uid() = storyteller_id AND
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stories.project_id
        AND p.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own stories" ON stories
  FOR UPDATE
  USING (auth.uid() = storyteller_id);

COMMIT;
