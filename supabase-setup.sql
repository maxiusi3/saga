-- Supabase Database Setup for Saga App
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for additional user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_members table for role-based access control
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('facilitator', 'co_facilitator', 'storyteller')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Create stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  storyteller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  audio_url TEXT,
  transcript TEXT,
  ai_generated_title TEXT,
  ai_summary TEXT,
  ai_follow_up_questions JSONB,
  ai_confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create story_comments table for discussions
CREATE TABLE IF NOT EXISTS public.story_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_follow_up_question BOOLEAN DEFAULT FALSE,
  parent_comment_id UUID REFERENCES public.story_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.story_comments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_story',
    'new_comment',
    'new_follow_up_question',
    'story_response',
    'project_invitation',
    'member_joined'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  preview_text TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_settings table for user preferences
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id, notification_type)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for projects
CREATE POLICY "Users can view projects they are members of" ON public.projects
  FOR SELECT USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Only facilitators can update projects" ON public.projects
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id
      AND user_id = auth.uid()
      AND role = 'facilitator'
      AND status = 'active'
    )
  );

CREATE POLICY "Only project owners can delete projects" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view stories from own projects" ON public.stories;
DROP POLICY IF EXISTS "Users can create stories in own projects" ON public.stories;
DROP POLICY IF EXISTS "Users can update stories in own projects" ON public.stories;
DROP POLICY IF EXISTS "Users can delete stories from own projects" ON public.stories;

-- Create RLS policies for project_members
CREATE POLICY "Users can view project memberships they are part of" ON public.project_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members pm2
      WHERE pm2.project_id = project_members.project_id
      AND pm2.user_id = auth.uid()
      AND pm2.role IN ('facilitator', 'co_facilitator')
      AND pm2.status = 'active'
    )
  );

CREATE POLICY "Only facilitators can manage project members" ON public.project_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = project_members.project_id
      AND user_id = auth.uid()
      AND role = 'facilitator'
      AND status = 'active'
    )
  );

-- Create RLS policies for stories
CREATE POLICY "Users can view stories from projects they are members of" ON public.stories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = stories.project_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = stories.project_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Only storytellers can create stories" ON public.stories
  FOR INSERT WITH CHECK (
    auth.uid() = storyteller_id AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'storyteller'
      AND pm.status = 'active'
    )
  );

CREATE POLICY "Only facilitators can edit story content" ON public.stories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = stories.project_id AND p.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = stories.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'facilitator'
      AND pm.status = 'active'
    )
  );

CREATE POLICY "Only facilitators can delete stories" ON public.stories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = stories.project_id AND p.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = stories.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'facilitator'
      AND pm.status = 'active'
    )
  );

-- Create RLS policies for story_comments
CREATE POLICY "Users can view comments on stories they have access to" ON public.story_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.project_members pm ON s.project_id = pm.project_id
      WHERE s.id = story_comments.story_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.projects p ON s.project_id = p.id
      WHERE s.id = story_comments.story_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can add comments" ON public.story_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.stories s
      JOIN public.project_members pm ON s.project_id = pm.project_id
      WHERE s.id = story_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
    )
  );

CREATE POLICY "Users can update their own comments" ON public.story_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.story_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true); -- Allow system to create notifications

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = recipient_id);

-- Create RLS policies for notification_settings
CREATE POLICY "Users can manage their own notification settings" ON public.notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- Create function to generate notifications for new stories
CREATE OR REPLACE FUNCTION public.notify_new_story()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify all project members except the storyteller
  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    project_id,
    story_id,
    notification_type,
    title,
    message,
    preview_text,
    action_url
  )
  SELECT
    pm.user_id,
    NEW.storyteller_id,
    NEW.project_id,
    NEW.id,
    'new_story',
    'New story recorded',
    CASE
      WHEN pm.role = 'facilitator' THEN 'A new story "' || NEW.title || '" has been recorded in your project'
      WHEN pm.role = 'co_facilitator' THEN 'A new story "' || NEW.title || '" has been recorded'
      ELSE 'A new story has been recorded'
    END,
    LEFT(NEW.content, 100),
    '/dashboard/projects/' || NEW.project_id || '/stories/' || NEW.id
  FROM public.project_members pm
  WHERE pm.project_id = NEW.project_id
    AND pm.user_id != NEW.storyteller_id
    AND pm.status = 'active'
    AND pm.role IN ('facilitator', 'co_facilitator');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate notifications for new comments
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  story_record RECORD;
  project_record RECORD;
BEGIN
  -- Get story and project information
  SELECT s.*, p.title as project_title
  INTO story_record, project_record
  FROM public.stories s
  JOIN public.projects p ON s.project_id = p.id
  WHERE s.id = NEW.story_id;

  -- Notify the storyteller if someone else commented
  IF NEW.user_id != story_record.storyteller_id THEN
    INSERT INTO public.notifications (
      recipient_id,
      sender_id,
      project_id,
      story_id,
      comment_id,
      notification_type,
      title,
      message,
      preview_text,
      action_url
    ) VALUES (
      story_record.storyteller_id,
      NEW.user_id,
      story_record.project_id,
      NEW.story_id,
      NEW.id,
      CASE WHEN NEW.is_follow_up_question THEN 'new_follow_up_question' ELSE 'new_comment' END,
      CASE WHEN NEW.is_follow_up_question THEN 'New follow-up question' ELSE 'New comment on your story' END,
      CASE WHEN NEW.is_follow_up_question
        THEN 'Someone asked a follow-up question on "' || story_record.title || '"'
        ELSE 'Someone commented on your story "' || story_record.title || '"'
      END,
      LEFT(NEW.content, 100),
      '/dashboard/projects/' || story_record.project_id || '/stories/' || NEW.story_id || '#comment-' || NEW.id
    );
  END IF;

  -- Notify facilitators and co-facilitators (except the commenter)
  INSERT INTO public.notifications (
    recipient_id,
    sender_id,
    project_id,
    story_id,
    comment_id,
    notification_type,
    title,
    message,
    preview_text,
    action_url
  )
  SELECT
    pm.user_id,
    NEW.user_id,
    story_record.project_id,
    NEW.story_id,
    NEW.id,
    'story_response',
    'New activity on story',
    'New activity on "' || story_record.title || '"',
    LEFT(NEW.content, 100),
    '/dashboard/projects/' || story_record.project_id || '/stories/' || NEW.story_id || '#comment-' || NEW.id
  FROM public.project_members pm
  WHERE pm.project_id = story_record.project_id
    AND pm.user_id != NEW.user_id
    AND pm.user_id != story_record.storyteller_id
    AND pm.status = 'active'
    AND pm.role IN ('facilitator', 'co_facilitator');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Update function for profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create notification triggers
CREATE TRIGGER on_story_created
  AFTER INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_story();

CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.story_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
