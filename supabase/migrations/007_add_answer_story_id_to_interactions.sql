-- Add answer_story_id column to interactions table
-- This allows tracking which story answers a follow-up question

ALTER TABLE interactions 
ADD COLUMN IF NOT EXISTS answer_story_id UUID REFERENCES stories(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_interactions_answer_story_id ON interactions(answer_story_id);

-- Add comment for documentation
COMMENT ON COLUMN interactions.answer_story_id IS 'References the story that answers this follow-up question';
