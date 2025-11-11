-- Create story_images table for story and transcript images
CREATE TABLE IF NOT EXISTS story_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES story_transcripts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  source_type TEXT NOT NULL CHECK (source_type IN ('transcript', 'comment')),
  source_interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for primary image (only one primary per story)
CREATE UNIQUE INDEX idx_story_images_unique_primary 
  ON story_images(story_id, is_primary) 
  WHERE is_primary = TRUE;

-- Create indexes for better query performance
CREATE INDEX idx_story_images_story_id ON story_images(story_id);
CREATE INDEX idx_story_images_transcript_id ON story_images(transcript_id) WHERE transcript_id IS NOT NULL;
CREATE INDEX idx_story_images_source ON story_images(source_type, source_interaction_id) WHERE source_interaction_id IS NOT NULL;
CREATE INDEX idx_story_images_order ON story_images(story_id, order_index);

-- Enable Row Level Security
ALTER TABLE story_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view images of stories in their projects
CREATE POLICY "Users can view images of stories in their projects"
  ON story_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE s.id = story_images.story_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    )
  );

-- RLS Policy: Storytellers can insert images for their stories
CREATE POLICY "Storytellers can insert images for their stories"
  ON story_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_images.story_id
      AND s.user_id = auth.uid()
    )
  );

-- RLS Policy: Storytellers can update images for their stories
CREATE POLICY "Storytellers can update images for their stories"
  ON story_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_images.story_id
      AND s.user_id = auth.uid()
    )
  );

-- RLS Policy: Storytellers can delete images for their stories
CREATE POLICY "Storytellers can delete images for their stories"
  ON story_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_images.story_id
      AND s.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE story_images IS 'Stores images associated with stories and story transcripts';
COMMENT ON COLUMN story_images.story_id IS 'Reference to the parent story';
COMMENT ON COLUMN story_images.transcript_id IS 'Reference to specific transcript (NULL for comment-sourced images)';
COMMENT ON COLUMN story_images.storage_path IS 'Full path in Supabase Storage';
COMMENT ON COLUMN story_images.order_index IS 'Display order within the story';
COMMENT ON COLUMN story_images.is_primary IS 'Whether this is the primary/thumbnail image for the story';
COMMENT ON COLUMN story_images.source_type IS 'Source of the image: transcript (uploaded during recording) or comment (copied from interaction)';
COMMENT ON COLUMN story_images.source_interaction_id IS 'Reference to source interaction if copied from comment';

-- Create interaction_images table for comment images
CREATE TABLE IF NOT EXISTS interaction_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_interaction_images_interaction_id ON interaction_images(interaction_id);
CREATE INDEX idx_interaction_images_order ON interaction_images(interaction_id, order_index);

-- Enable Row Level Security
ALTER TABLE interaction_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view images of interactions in their projects
CREATE POLICY "Users can view images of interactions in their projects"
  ON interaction_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interactions i
      JOIN stories s ON s.id = i.story_id
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE i.id = interaction_images.interaction_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    )
  );

-- RLS Policy: Project members can insert images for interactions
CREATE POLICY "Project members can insert images for interactions"
  ON interaction_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interactions i
      JOIN stories s ON s.id = i.story_id
      JOIN project_members pm ON pm.project_id = s.project_id
      WHERE i.id = interaction_images.interaction_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    )
  );

-- RLS Policy: Users can update their own interaction images
CREATE POLICY "Users can update their own interaction images"
  ON interaction_images FOR UPDATE
  USING (uploaded_by = auth.uid());

-- RLS Policy: Users can delete their own interaction images
CREATE POLICY "Users can delete their own interaction images"
  ON interaction_images FOR DELETE
  USING (uploaded_by = auth.uid());

-- Add comments
COMMENT ON TABLE interaction_images IS 'Stores images attached to interactions (comments/followups)';
COMMENT ON COLUMN interaction_images.interaction_id IS 'Reference to the parent interaction';
COMMENT ON COLUMN interaction_images.storage_path IS 'Full path in Supabase Storage';
COMMENT ON COLUMN interaction_images.order_index IS 'Display order within the interaction';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_story_images_updated_at ON story_images;
CREATE TRIGGER update_story_images_updated_at
  BEFORE UPDATE ON story_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interaction_images_updated_at ON interaction_images;
CREATE TRIGGER update_interaction_images_updated_at
  BEFORE UPDATE ON interaction_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
