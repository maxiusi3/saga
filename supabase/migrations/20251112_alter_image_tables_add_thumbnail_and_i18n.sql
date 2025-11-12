-- Alter image tables to add thumbnail path, i18n description and copyright flag

ALTER TABLE IF EXISTS story_images
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS copyright_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_story_images_thumbnail ON story_images(thumbnail_path);

ALTER TABLE IF EXISTS interaction_images
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS copyright_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_interaction_images_thumbnail ON interaction_images(thumbnail_path);

