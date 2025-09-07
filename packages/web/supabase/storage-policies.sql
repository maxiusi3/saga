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
CREATE POLICY "Users can upload files to their own folders"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'saga' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Project members can view files in shared project folders
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

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create helper function to get file path structure
CREATE OR REPLACE FUNCTION storage.get_file_path_parts(file_path text)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT string_to_array(file_path, '/');
$$;

-- Create helper function to check if user can access project
CREATE OR REPLACE FUNCTION storage.user_can_access_project(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_roles
    WHERE user_id = auth.uid()
    AND project_id = $1
  );
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_user 
ON storage.objects (bucket_id, (storage.foldername(name))[1]);

CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_project 
ON storage.objects (bucket_id, (storage.foldername(name))[2], (storage.foldername(name))[3]);

-- Example file path structure:
-- User files: {user_id}/profile/avatar.jpg
-- Project files: {user_id}/projects/{project_id}/stories/{story_id}/audio.mp3
-- Project exports: {user_id}/projects/{project_id}/exports/export.pdf

COMMENT ON TABLE storage.objects IS 'File storage with user and project-based access control';
COMMENT ON POLICY "Users can upload files to their own folders" ON storage.objects IS 'Allow users to upload files to folders starting with their user ID';
COMMENT ON POLICY "Project members can view project files" ON storage.objects IS 'Allow project members to view files in their project folders';
