-- Add AI-related fields to stories table
-- This migration adds the missing fields needed for AI-generated content

-- Add content field for story text content
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Add AI-generated fields
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_generated_title VARCHAR(255);

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_follow_up_questions JSONB;

ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3,2);

-- Make audio_url nullable since we might have text-only stories
ALTER TABLE stories 
ALTER COLUMN audio_url DROP NOT NULL;

-- Update the status check constraint to include more states
ALTER TABLE stories 
DROP CONSTRAINT IF EXISTS stories_status_check;

ALTER TABLE stories 
ADD CONSTRAINT stories_status_check 
CHECK (status IN ('processing', 'ready', 'failed', 'draft'));

-- Add indexes for better performance on AI fields
CREATE INDEX IF NOT EXISTS idx_stories_ai_confidence ON stories(ai_confidence_score);
CREATE INDEX IF NOT EXISTS idx_stories_content ON stories USING gin(to_tsvector('english', content));

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stories_updated_at 
    BEFORE UPDATE ON stories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
