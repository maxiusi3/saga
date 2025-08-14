#!/bin/bash

# Saga Family Biography - Supabase Migration Script
# 将现有的 Knex 迁移转换为 Supabase 兼容格式

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Saga Family Biography - Supabase Migration${NC}"
echo -e "${BLUE}================================================${NC}"

# 检查 Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
fi

# 初始化 Supabase 项目
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${YELLOW}📋 Initializing Supabase project...${NC}"
    supabase init
fi

# 创建迁移目录
mkdir -p supabase/migrations
mkdir -p supabase/seed

echo -e "${YELLOW}🗄️ Converting Knex migrations to Supabase SQL...${NC}"

# 转换主要表结构
cat > supabase/migrations/001_initial_schema.sql << 'EOF'
-- Saga Family Biography v1.5 - Initial Schema
-- Generated from Knex migrations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table (handled by Supabase Auth)
-- We'll create a profile table to extend user data

-- User profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User resource wallets table
CREATE TABLE user_resource_wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_vouchers INTEGER DEFAULT 0 NOT NULL,
  facilitator_seats INTEGER DEFAULT 0 NOT NULL,
  storyteller_seats INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seat transactions table
CREATE TABLE seat_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'consume', 'refund'
  resource_type VARCHAR(50) NOT NULL, -- 'project_voucher', 'facilitator_seat', 'storyteller_seat'
  amount INTEGER NOT NULL, -- positive for credit, negative for debit
  project_id UUID, -- Will reference projects table
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project roles table (many-to-many relationship)
CREATE TABLE project_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'facilitator', 'storyteller'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id, role)
);

-- Add foreign key constraint to seat_transactions
ALTER TABLE seat_transactions 
ADD CONSTRAINT fk_seat_transactions_project 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Chapters table
CREATE TABLE chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompts table
CREATE TABLE prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  audio_url TEXT,
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User prompts table (facilitator follow-up questions)
CREATE TABLE user_prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_story_id UUID, -- Will reference stories table
  text TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  is_delivered BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project prompt state table
CREATE TABLE project_prompt_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  current_chapter_id UUID REFERENCES chapters(id),
  current_prompt_index INTEGER DEFAULT 0,
  last_prompt_delivered_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stories table
CREATE TABLE stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255),
  audio_url TEXT,
  transcript TEXT,
  photo_url TEXT,
  chapter_id UUID REFERENCES chapters(id),
  prompt_id UUID REFERENCES prompts(id),
  duration INTEGER, -- in seconds
  file_size INTEGER, -- in bytes
  stt_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to user_prompts
ALTER TABLE user_prompts 
ADD CONSTRAINT fk_user_prompts_story 
FOREIGN KEY (parent_story_id) REFERENCES stories(id) ON DELETE CASCADE;

-- Chapter summaries table
CREATE TABLE chapter_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  story_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, chapter_id)
);

-- Interactions table
CREATE TABLE interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'comment', 'follow_up_question'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export requests table
CREATE TABLE export_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  export_url TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Notifications table
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device tokens table
CREATE TABLE device_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Create indexes for performance
CREATE INDEX idx_user_resource_wallets_user_id ON user_resource_wallets(user_id);
CREATE INDEX idx_seat_transactions_user_id ON seat_transactions(user_id);
CREATE INDEX idx_seat_transactions_project_id ON seat_transactions(project_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_project_roles_project_id ON project_roles(project_id);
CREATE INDEX idx_project_roles_user_id ON project_roles(user_id);
CREATE INDEX idx_stories_project_id ON stories(project_id);
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_chapter_id ON stories(chapter_id);
CREATE INDEX idx_interactions_story_id ON interactions(story_id);
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

-- Full-text search indexes
CREATE INDEX idx_stories_transcript_fts ON stories USING gin(to_tsvector('english', transcript));
CREATE INDEX idx_stories_title_fts ON stories USING gin(to_tsvector('english', title));

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
EOF

echo -e "${GREEN}✅ Initial schema created${NC}"# 
创建 RLS 策略
cat > supabase/migrations/002_rls_policies.sql << 'EOF'
-- Row Level Security Policies for Saga Family Biography

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User resource wallets policies
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Seat transactions policies
CREATE POLICY "Users can view own transactions" ON seat_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Users can view projects they're involved in" ON projects
  FOR SELECT USING (
    auth.uid() = created_by OR
    auth.uid() IN (
      SELECT user_id FROM project_roles WHERE project_id = projects.id
    )
  );

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project creators can update their projects" ON projects
  FOR UPDATE USING (auth.uid() = created_by);

-- Project roles policies
CREATE POLICY "Users can view roles for their projects" ON project_roles
  FOR SELECT USING (
    auth.uid() = user_id OR
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Project creators can manage roles" ON project_roles
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- Stories policies
CREATE POLICY "Users can view stories from their projects" ON stories
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create stories in their projects" ON stories
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    project_id IN (
      SELECT project_id FROM project_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own stories" ON stories
  FOR UPDATE USING (auth.uid() = user_id);

-- Interactions policies
CREATE POLICY "Users can view interactions on accessible stories" ON interactions
  FOR SELECT USING (
    story_id IN (
      SELECT id FROM stories WHERE project_id IN (
        SELECT project_id FROM project_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create interactions on accessible stories" ON interactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    story_id IN (
      SELECT id FROM stories WHERE project_id IN (
        SELECT project_id FROM project_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Device tokens policies
CREATE POLICY "Users can manage own device tokens" ON device_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Export requests policies
CREATE POLICY "Users can view own export requests" ON export_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create export requests for their projects" ON export_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    project_id IN (
      SELECT project_id FROM project_roles WHERE user_id = auth.uid()
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view subscriptions for their projects" ON subscriptions
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_roles WHERE user_id = auth.uid()
    )
  );
EOF

# 创建触发器和函数
cat > supabase/migrations/003_functions_triggers.sql << 'EOF'
-- Functions and Triggers for Saga Family Biography

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_resource_wallets_updated_at BEFORE UPDATE ON user_resource_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Create resource wallet for new user
  INSERT INTO public.user_resource_wallets (user_id, project_vouchers, facilitator_seats, storyteller_seats)
  VALUES (NEW.id, 0, 0, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to automatically create project role for project creator
CREATE OR REPLACE FUNCTION create_project_creator_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_roles (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'facilitator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_project_creator_role_trigger
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION create_project_creator_role();
EOF

# 创建种子数据
cat > supabase/seed/001_chapters_and_prompts.sql << 'EOF'
-- Seed data for chapters and prompts

-- Insert chapters
INSERT INTO chapters (id, name, description, order_index) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Childhood Memories', 'Early life experiences and family traditions', 1),
  ('550e8400-e29b-41d4-a716-446655440002', 'Education & Growth', 'School experiences and formative learning', 2),
  ('550e8400-e29b-41d4-a716-446655440003', 'Career & Purpose', 'Professional life and achievements', 3),
  ('550e8400-e29b-41d4-a716-446655440004', 'Love & Relationships', 'Family, friends, and meaningful connections', 4),
  ('550e8400-e29b-41d4-a716-446655440005', 'Life Lessons', 'Wisdom gained through experience', 5),
  ('550e8400-e29b-41d4-a716-446655440006', 'Legacy & Future', 'What you want to pass on', 6);

-- Insert prompts for Chapter 1: Childhood Memories
INSERT INTO prompts (chapter_id, text, order_index) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Tell me about your earliest childhood memory.', 1),
  ('550e8400-e29b-41d4-a716-446655440001', 'What was your childhood home like?', 2),
  ('550e8400-e29b-41d4-a716-446655440001', 'Describe a typical day when you were 8 years old.', 3),
  ('550e8400-e29b-41d4-a716-446655440001', 'What family traditions did you have growing up?', 4),
  ('550e8400-e29b-41d4-a716-446655440001', 'Tell me about your favorite childhood toy or game.', 5),
  ('550e8400-e29b-41d4-a716-446655440001', 'What was your relationship like with your siblings?', 6),
  ('550e8400-e29b-41d4-a716-446655440001', 'Describe your grandparents and what they meant to you.', 7),
  ('550e8400-e29b-41d4-a716-446655440001', 'What was your favorite family meal or recipe?', 8),
  ('550e8400-e29b-41d4-a716-446655440001', 'Tell me about a childhood adventure or mischief you got into.', 9),
  ('550e8400-e29b-41d4-a716-446655440001', 'What did you want to be when you grew up?', 10);

-- Insert prompts for Chapter 2: Education & Growth
INSERT INTO prompts (chapter_id, text, order_index) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', 'Tell me about your first day of school.', 1),
  ('550e8400-e29b-41d4-a716-446655440002', 'Who was your favorite teacher and why?', 2),
  ('550e8400-e29b-41d4-a716-446655440002', 'What subject did you enjoy most in school?', 3),
  ('550e8400-e29b-41d4-a716-446655440002', 'Describe a moment when you felt proud of your learning.', 4),
  ('550e8400-e29b-41d4-a716-446655440002', 'Tell me about your closest friends during school years.', 5),
  ('550e8400-e29b-41d4-a716-446655440002', 'What extracurricular activities were you involved in?', 6),
  ('550e8400-e29b-41d4-a716-446655440002', 'Describe a challenge you overcame during your education.', 7),
  ('550e8400-e29b-41d4-a716-446655440002', 'What life lesson did you learn outside the classroom?', 8);

-- Continue with other chapters...
-- (Additional prompts would be added here for remaining chapters)
EOF

echo -e "${GREEN}✅ Migration files created successfully${NC}"

# 创建 Supabase 配置
cat > supabase/config.toml << 'EOF'
# A string used to distinguish different Supabase projects on the same host. Defaults to the working
# directory name when running `supabase init`.
project_id = "saga-family-biography"

[api]
# Port to use for the API URL.
port = 54321
# Schemas to expose in your API. Tables, views and stored procedures in this schema will get API
# endpoints. public and storage are always included.
schemas = ["public", "storage", "graphql_public"]
# Extra schemas to add to the search_path of every request. public is always included.
extra_search_path = ["public", "extensions"]
# The maximum number of rows returns from a table or view. Limits payload size for accidental or
# malicious requests.
max_rows = 1000

[db]
# Port to use for the local database URL.
port = 54322
# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version_num;` on the remote database to check.
major_version = 15

[studio]
# Port to use for Supabase Studio.
port = 54323

[inbucket]
# Port to use for the email testing server.
port = 54324

[storage]
# The maximum file size allowed (e.g. "5MB", "500KB").
file_size_limit = "50MiB"

[auth]
# The base URL of your website. Used as an allow-list for redirects and for constructing URLs used
# in emails.
site_url = "http://localhost:3000"
# A list of *exact* URLs that auth providers are permitted to redirect to post authentication.
additional_redirect_urls = ["https://localhost:3000"]
# How long tokens are valid for, in seconds. Defaults to 3600 (1 hour), maximum 604800 (1 week).
jwt_expiry = 3600
# Allow/disallow new user signups to your project.
enable_signup = true

[auth.email]
# Allow/disallow new user signups via email to your project.
enable_signup = true
# If enabled, a user will be required to confirm any email change on both the old, and new email
# addresses. If disabled, only the new email is required to confirm.
double_confirm_changes = true
# If enabled, users need to confirm their email address before signing in.
enable_confirmations = false

# Use an external OAuth provider. The full list of providers are: `apple`, `azure`, `bitbucket`,
# `discord`, `facebook`, `github`, `gitlab`, `google`, `keycloak`, `linkedin`, `notion`, `twitch`,
# `twitter`, `slack`, `spotify`, `workos`, `zoom`.
[auth.external.apple]
enabled = true
client_id = ""
secret = ""
# Overrides the default auth redirectUrl.
redirect_uri = ""
# Overrides the default auth provider URL. Used to support self-hosted gitlab, single-tenant Azure,
# or any other third-party OIDC providers.
url = ""

[auth.external.google]
enabled = true
client_id = ""
secret = ""
EOF

echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "1. Link to your Supabase project: ${GREEN}supabase link --project-ref YOUR_PROJECT_REF${NC}"
echo -e "2. Push migrations: ${GREEN}supabase db push${NC}"
echo -e "3. Run seed data: ${GREEN}supabase db seed${NC}"
echo -e "4. Update your environment variables"
echo -e "5. Test the migration with: ${GREEN}supabase start${NC}"

echo -e "\n${BLUE}🚀 Supabase migration setup completed!${NC}"