-- Create story_transcripts table for follow-up recordings
CREATE TABLE IF NOT EXISTS story_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  audio_url TEXT,
  audio_duration INTEGER, -- in seconds
  transcript TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_story_sequence UNIQUE(story_id, sequence_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_story_transcripts_story_id ON story_transcripts(story_id);
CREATE INDEX IF NOT EXISTS idx_story_transcripts_recorded_at ON story_transcripts(recorded_at);
CREATE INDEX IF NOT EXISTS idx_story_transcripts_sequence ON story_transcripts(story_id, sequence_number);

-- Add columns to stories table
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS has_multiple_transcripts BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transcript_count INTEGER DEFAULT 1;

-- Create function to update transcript count
CREATE OR REPLACE FUNCTION update_story_transcript_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stories 
    SET 
      transcript_count = (SELECT COUNT(*) + 1 FROM story_transcripts WHERE story_id = NEW.story_id),
      has_multiple_transcripts = TRUE
    WHERE id = NEW.story_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stories 
    SET 
      transcript_count = (SELECT COUNT(*) + 1 FROM story_transcripts WHERE story_id = OLD.story_id),
      has_multiple_transcripts = (SELECT COUNT(*) > 0 FROM story_transcripts WHERE story_id = OLD.story_id)
    WHERE id = OLD.story_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update transcript count
DROP TRIGGER IF EXISTS trigger_update_transcript_count ON story_transcripts;
CREATE TRIGGER trigger_update_transcript_count
AFTER INSERT OR DELETE ON story_transcripts
FOR EACH ROW
EXECUTE FUNCTION update_story_transcript_count();

-- Enable Row Level Security
ALTER TABLE story_transcripts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same as stories table)
CREATE POLICY "Users can view transcripts of stories in their projects"
  ON story_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE s.id = story_transcripts.story_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transcripts for stories they created"
  ON story_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_transcripts.story_id
      AND s.storyteller_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own transcripts"
  ON story_transcripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_transcripts.story_id
      AND s.storyteller_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own transcripts"
  ON story_transcripts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_transcripts.story_id
      AND s.storyteller_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE story_transcripts IS 'Stores additional recording segments for stories that require multiple recordings';
COMMENT ON COLUMN story_transcripts.sequence_number IS 'Order of the recording segment, starting from 1 (0 is the original story)';
