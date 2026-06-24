-- Supabase Storage Policies for Saga Project
-- Run this script in your Supabase SQL editor to set up storage policies

-- Create the 'saga' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saga',
  'saga',
  false, -- Private bucket
  52428800, -- 50MB limit per file
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: Users can upload files to their own folders
DROP POLICY IF EXISTS "Users can upload files to their own folders" ON storage.objects;
CREATE POLICY "Users can upload files to their own folders"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own files
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own files
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Project members can view files in shared project folders
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
CREATE POLICY "Project members can view project files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND (
    -- User's own files
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Project files that user has access to
    EXISTS (
      SELECT 1 FROM project_roles pr
      JOIN projects p ON pr.project_id = p.id
      WHERE pr.user_id = auth.uid()
      AND (storage.foldername(name))[2] = 'projects'
      AND (storage.foldername(name))[3] = p.id::text
    )
  )
);

-- Policy: Project facilitators can upload files to project folders
DROP POLICY IF EXISTS "Project facilitators can upload project files" ON storage.objects;
CREATE POLICY "Project facilitators can upload project files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND (
    -- User's own files
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Project files for facilitators
    (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role IN ('facilitator', 'co_facilitator')
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

-- Policy: Storytellers can upload files to their own project stories
DROP POLICY IF EXISTS "Storytellers can upload story files" ON storage.objects;
CREATE POLICY "Storytellers can upload story files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND (
    -- User's own files
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Story files for storytellers
    (
      (storage.foldername(name))[2] = 'projects'
      AND EXISTS (
        SELECT 1 FROM project_roles pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'storyteller'
        AND (storage.foldername(name))[3] = p.id::text
      )
    )
  )
);

-- Skipping storage.objects RLS enablement on managed Supabase projects.
-- Supabase owns storage.objects and has RLS enabled by default; hosted project
-- postgres users cannot ALTER this table's ownership-level settings.

-- Example file path structure:
-- User files: {user_id}/profile/avatar.jpg
-- Project files: {user_id}/projects/{project_id}/stories/{story_id}/audio.mp3
-- Project exports: {user_id}/projects/{project_id}/exports/export.pdf
