-- =====================================================
-- Saga MVP - Complete Supabase Database Setup
-- Fresh start migration for unified Supabase architecture
-- =====================================================

-- Drop existing tables if they exist (fresh start)
DROP TABLE IF EXISTS export_requests CASCADE;
DROP TABLE IF EXISTS seat_transactions CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS project_roles CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_resource_wallets CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE; -- Drop old custom users table

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS create_project_with_role CASCADE;
DROP FUNCTION IF EXISTS send_project_invitation CASCADE;
DROP FUNCTION IF EXISTS accept_project_invitation CASCADE;
DROP FUNCTION IF EXISTS process_package_purchase CASCADE;
DROP FUNCTION IF EXISTS request_data_export CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- User profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  user_role TEXT CHECK (user_role IN ('facilitator', 'storyteller', 'both')) DEFAULT 'facilitator',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User resource wallets table
CREATE TABLE user_resource_wallets (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  project_vouchers INTEGER DEFAULT 0 CHECK (project_vouchers >= 0),
  facilitator_seats INTEGER DEFAULT 0 CHECK (facilitator_seats >= 0),
  storyteller_seats INTEGER DEFAULT 0 CHECK (storyteller_seats >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  facilitator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  settings JSONB DEFAULT '{}',
  subscription_mode TEXT DEFAULT 'interactive' CHECK (subscription_mode IN ('interactive', 'archive')),
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project roles table (many-to-many relationship between users and projects)
CREATE TABLE project_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('facilitator', 'storyteller')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id, role)
);

-- Stories table
CREATE TABLE stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  storyteller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  audio_url TEXT,
  audio_duration INTEGER,
  transcript TEXT,
  ai_prompt TEXT,
  photo_urls TEXT[], -- Array of photo URLs
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'recorded', 'transcribed', 'completed', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invitations table
CREATE TABLE invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('facilitator', 'storyteller')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seat transactions table (tracks resource usage and purchases)
CREATE TABLE seat_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'consume', 'reserve', 'release', 'activate')),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('project_voucher', 'facilitator_seat', 'storyteller_seat', 'package')),
  amount INTEGER NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export requests table
CREATE TABLE export_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  options JSONB DEFAULT '{}',
  download_url TEXT,
  file_size_bytes BIGINT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Interactions table (for facilitator-storyteller communication)
CREATE TABLE interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  facilitator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('question', 'feedback', 'prompt', 'note')),
  content TEXT NOT NULL,
  response TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'archived')),
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_role ON profiles(user_role);

-- Projects indexes
CREATE INDEX idx_projects_facilitator ON projects(facilitator_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Project roles indexes
CREATE INDEX idx_project_roles_user ON project_roles(user_id);
CREATE INDEX idx_project_roles_project ON project_roles(project_id);
CREATE INDEX idx_project_roles_role ON project_roles(role);
CREATE INDEX idx_project_roles_status ON project_roles(status);

-- Stories indexes
CREATE INDEX idx_stories_project ON stories(project_id);
CREATE INDEX idx_stories_storyteller ON stories(storyteller_id);
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_created_at ON stories(created_at);

-- Invitations indexes
CREATE INDEX idx_invitations_project ON invitations(project_id);
CREATE INDEX idx_invitations_inviter ON invitations(inviter_id);
CREATE INDEX idx_invitations_email ON invitations(invitee_email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- Seat transactions indexes
CREATE INDEX idx_seat_transactions_user ON seat_transactions(user_id);
CREATE INDEX idx_seat_transactions_type ON seat_transactions(transaction_type);
CREATE INDEX idx_seat_transactions_resource ON seat_transactions(resource_type);
CREATE INDEX idx_seat_transactions_project ON seat_transactions(project_id);
CREATE INDEX idx_seat_transactions_created_at ON seat_transactions(created_at);

-- Export requests indexes
CREATE INDEX idx_export_requests_project ON export_requests(project_id);
CREATE INDEX idx_export_requests_user ON export_requests(user_id);
CREATE INDEX idx_export_requests_status ON export_requests(status);
CREATE INDEX idx_export_requests_created_at ON export_requests(created_at);

-- Interactions indexes
CREATE INDEX idx_interactions_story ON interactions(story_id);
CREATE INDEX idx_interactions_facilitator ON interactions(facilitator_id);
CREATE INDEX idx_interactions_type ON interactions(type);
CREATE INDEX idx_interactions_status ON interactions(status);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_resource_wallets_updated_at
    BEFORE UPDATE ON user_resource_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_roles_updated_at
    BEFORE UPDATE ON project_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at
    BEFORE UPDATE ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );

  INSERT INTO user_resource_wallets (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User resource wallets policies
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Users can view projects they're involved in" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = projects.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Facilitators can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their projects" ON projects
  FOR UPDATE USING (auth.uid() = facilitator_id);

-- Project roles policies
CREATE POLICY "Users can view project roles they're involved in" ON project_roles
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM project_roles pr2
      WHERE pr2.project_id = project_roles.project_id
      AND pr2.user_id = auth.uid()
      AND pr2.role = 'facilitator'
      AND pr2.status = 'active'
    )
  );

CREATE POLICY "Facilitators can manage project roles" ON project_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_roles pr2
      WHERE pr2.project_id = project_roles.project_id
      AND pr2.user_id = auth.uid()
      AND pr2.role = 'facilitator'
      AND pr2.status = 'active'
    )
  );

CREATE POLICY "Users can insert their own project role" ON project_roles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Stories policies
CREATE POLICY "Project members can view stories" ON stories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = stories.project_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Storytellers can create stories" ON stories
  FOR INSERT WITH CHECK (
    auth.uid() = storyteller_id AND
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = stories.project_id
      AND user_id = auth.uid()
      AND role = 'storyteller'
      AND status = 'active'
    )
  );

CREATE POLICY "Storytellers can update own stories" ON stories
  FOR UPDATE USING (auth.uid() = storyteller_id);

-- Invitations policies
CREATE POLICY "Facilitators can view project invitations" ON invitations
  FOR SELECT USING (
    auth.uid() = inviter_id OR
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = invitations.project_id
      AND user_id = auth.uid()
      AND role = 'facilitator'
      AND status = 'active'
    )
  );

CREATE POLICY "Facilitators can create invitations" ON invitations
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id AND
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = invitations.project_id
      AND user_id = auth.uid()
      AND role = 'facilitator'
      AND status = 'active'
    )
  );

CREATE POLICY "Facilitators can update invitations" ON invitations
  FOR UPDATE USING (auth.uid() = inviter_id);

-- Seat transactions policies
CREATE POLICY "Users can view own transactions" ON seat_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON seat_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Export requests policies
CREATE POLICY "Project members can view export requests" ON export_requests
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = export_requests.project_id
      AND user_id = auth.uid()
      AND role = 'facilitator'
      AND status = 'active'
    )
  );

CREATE POLICY "Project members can create export requests" ON export_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM project_roles
      WHERE project_id = export_requests.project_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Interactions policies
CREATE POLICY "Project members can view interactions" ON interactions
  FOR SELECT USING (
    auth.uid() = facilitator_id OR
    EXISTS (
      SELECT 1 FROM stories s
      JOIN project_roles pr ON pr.project_id = s.project_id
      WHERE s.id = interactions.story_id
      AND pr.user_id = auth.uid()
      AND pr.status = 'active'
    )
  );

CREATE POLICY "Facilitators can create interactions" ON interactions
  FOR INSERT WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update interactions" ON interactions
  FOR UPDATE USING (auth.uid() = facilitator_id);

-- =====================================================
-- BUSINESS LOGIC FUNCTIONS
-- =====================================================

-- Function to create project with role assignment and resource consumption
CREATE OR REPLACE FUNCTION create_project_with_role(
  project_name TEXT,
  project_description TEXT,
  facilitator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_project_id UUID;
  wallet_vouchers INTEGER;
BEGIN
  -- Check if user has sufficient project vouchers
  SELECT project_vouchers INTO wallet_vouchers
  FROM user_resource_wallets
  WHERE user_id = facilitator_id;

  IF wallet_vouchers IS NULL OR wallet_vouchers < 1 THEN
    RAISE EXCEPTION 'Insufficient project vouchers. Current: %, Required: 1', COALESCE(wallet_vouchers, 0);
  END IF;

  -- Begin transaction
  BEGIN
    -- Create project
    INSERT INTO projects (name, description, facilitator_id, status)
    VALUES (project_name, project_description, facilitator_id, 'active')
    RETURNING id INTO new_project_id;

    -- Add facilitator role
    INSERT INTO project_roles (user_id, project_id, role, status, joined_at)
    VALUES (facilitator_id, new_project_id, 'facilitator', 'active', NOW());

    -- Consume project voucher
    UPDATE user_resource_wallets
    SET project_vouchers = project_vouchers - 1,
        updated_at = NOW()
    WHERE user_id = facilitator_id;

    -- Record transaction
    INSERT INTO seat_transactions (
      user_id,
      transaction_type,
      resource_type,
      amount,
      project_id,
      metadata
    )
    VALUES (
      facilitator_id,
      'consume',
      'project_voucher',
      -1,
      new_project_id,
      jsonb_build_object('action', 'project_creation', 'project_name', project_name)
    );

    RETURN new_project_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create project: %', SQLERRM;
  END;
END;
$$;

-- Function to send project invitation with seat reservation
CREATE OR REPLACE FUNCTION send_project_invitation(
  project_id UUID,
  inviter_id UUID,
  invitee_email TEXT,
  invitation_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_id UUID;
  invitation_token TEXT;
  required_seats INTEGER;
  available_seats INTEGER;
BEGIN
  -- Verify inviter is a facilitator of the project
  IF NOT EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = send_project_invitation.project_id
    AND user_id = inviter_id
    AND role = 'facilitator'
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only project facilitators can send invitations';
  END IF;

  -- Check available seats
  IF invitation_role = 'facilitator' THEN
    SELECT facilitator_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = inviter_id;
    required_seats := 1;
  ELSIF invitation_role = 'storyteller' THEN
    SELECT storyteller_seats INTO available_seats
    FROM user_resource_wallets
    WHERE user_id = inviter_id;
    required_seats := 1;
  ELSE
    RAISE EXCEPTION 'Invalid role: %', invitation_role;
  END IF;

  IF available_seats IS NULL OR available_seats < required_seats THEN
    RAISE EXCEPTION 'Insufficient % seats. Available: %, Required: %',
      invitation_role, COALESCE(available_seats, 0), required_seats;
  END IF;

  -- Generate invitation token
  invitation_token := encode(gen_random_bytes(32), 'base64');

  -- Create invitation
  INSERT INTO invitations (
    project_id,
    inviter_id,
    invitee_email,
    role,
    status,
    token,
    expires_at
  )
  VALUES (
    send_project_invitation.project_id,
    inviter_id,
    invitee_email,
    invitation_role,
    'pending',
    invitation_token,
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO invitation_id;

  -- Reserve seat
  IF invitation_role = 'facilitator' THEN
    UPDATE user_resource_wallets
    SET facilitator_seats = facilitator_seats - 1,
        updated_at = NOW()
    WHERE user_id = inviter_id;
  ELSE
    UPDATE user_resource_wallets
    SET storyteller_seats = storyteller_seats - 1,
        updated_at = NOW()
    WHERE user_id = inviter_id;
  END IF;

  -- Record seat reservation transaction
  INSERT INTO seat_transactions (
    user_id,
    transaction_type,
    resource_type,
    amount,
    project_id,
    metadata
  )
  VALUES (
    inviter_id,
    'reserve',
    invitation_role || '_seat',
    -1,
    send_project_invitation.project_id,
    jsonb_build_object(
      'action', 'invitation_sent',
      'invitee_email', invitee_email,
      'invitation_id', invitation_id
    )
  );

  RETURN invitation_id;
END;
$$;

-- Function to accept project invitation
CREATE OR REPLACE FUNCTION accept_project_invitation(
  invitation_token TEXT,
  user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;

  -- Find valid invitation
  SELECT * INTO invitation_record
  FROM invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW()
    AND invitee_email = user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- Check if user already has this role in the project
  IF EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = invitation_record.project_id
    AND user_id = accept_project_invitation.user_id
    AND role = invitation_record.role
  ) THEN
    RAISE EXCEPTION 'User already has this role in the project';
  END IF;

  BEGIN
    -- Add user to project
    INSERT INTO project_roles (user_id, project_id, role, status, invited_by, joined_at)
    VALUES (
      accept_project_invitation.user_id,
      invitation_record.project_id,
      invitation_record.role,
      'active',
      invitation_record.inviter_id,
      NOW()
    );

    -- Update invitation status
    UPDATE invitations
    SET status = 'accepted',
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = invitation_record.id;

    -- Record seat activation transaction
    INSERT INTO seat_transactions (
      user_id,
      transaction_type,
      resource_type,
      amount,
      project_id,
      metadata
    )
    VALUES (
      invitation_record.inviter_id,
      'activate',
      invitation_record.role || '_seat',
      0, -- Seat was already reserved, this is just activation
      invitation_record.project_id,
      jsonb_build_object(
        'action', 'invitation_accepted',
        'accepted_by', accept_project_invitation.user_id,
        'invitation_id', invitation_record.id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'project_id', invitation_record.project_id,
      'role', invitation_record.role,
      'message', 'Invitation accepted successfully'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to accept invitation: %', SQLERRM;
  END;
END;
$$;

-- Function to process package purchase
CREATE OR REPLACE FUNCTION process_package_purchase(
  package_id TEXT,
  payment_intent_id TEXT,
  user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  package_contents JSONB;
  purchase_record RECORD;
BEGIN
  -- Define package contents
  CASE package_id
    WHEN 'saga-package' THEN
      package_contents := jsonb_build_object(
        'project_vouchers', 1,
        'facilitator_seats', 2,
        'storyteller_seats', 8
      );
    WHEN 'saga-package-family' THEN
      package_contents := jsonb_build_object(
        'project_vouchers', 3,
        'facilitator_seats', 5,
        'storyteller_seats', 20
      );
    WHEN 'saga-package-premium' THEN
      package_contents := jsonb_build_object(
        'project_vouchers', 5,
        'facilitator_seats', 10,
        'storyteller_seats', 50
      );
    ELSE
      RAISE EXCEPTION 'Unknown package ID: %', package_id;
  END CASE;

  -- Check if payment already processed
  SELECT * INTO purchase_record
  FROM seat_transactions
  WHERE metadata->>'payment_intent_id' = payment_intent_id
    AND transaction_type = 'purchase';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Package already activated',
      'package_id', package_id,
      'wallet_update', package_contents
    );
  END IF;

  BEGIN
    -- Update or create user wallet
    INSERT INTO user_resource_wallets (
      user_id,
      project_vouchers,
      facilitator_seats,
      storyteller_seats
    )
    VALUES (
      process_package_purchase.user_id,
      (package_contents->>'project_vouchers')::INTEGER,
      (package_contents->>'facilitator_seats')::INTEGER,
      (package_contents->>'storyteller_seats')::INTEGER
    )
    ON CONFLICT (user_id) DO UPDATE SET
      project_vouchers = user_resource_wallets.project_vouchers + (package_contents->>'project_vouchers')::INTEGER,
      facilitator_seats = user_resource_wallets.facilitator_seats + (package_contents->>'facilitator_seats')::INTEGER,
      storyteller_seats = user_resource_wallets.storyteller_seats + (package_contents->>'storyteller_seats')::INTEGER,
      updated_at = NOW();

    -- Record purchase transaction
    INSERT INTO seat_transactions (
      user_id,
      transaction_type,
      resource_type,
      amount,
      metadata
    )
    VALUES (
      process_package_purchase.user_id,
      'purchase',
      'package',
      1,
      jsonb_build_object(
        'package_id', package_id,
        'payment_intent_id', payment_intent_id,
        'package_contents', package_contents,
        'action', 'package_purchase'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Package activated successfully',
      'package_id', package_id,
      'wallet_update', package_contents
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to process package purchase: %', SQLERRM;
  END;
END;
$$;

-- Function to request data export
CREATE OR REPLACE FUNCTION request_data_export(
  project_id UUID,
  user_id UUID,
  export_options JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  export_id UUID;
BEGIN
  -- Verify user has access to project
  IF NOT EXISTS (
    SELECT 1 FROM project_roles
    WHERE project_id = request_data_export.project_id
    AND user_id = request_data_export.user_id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied to project';
  END IF;

  -- Create export request
  INSERT INTO export_requests (
    project_id,
    user_id,
    status,
    options,
    created_at
  )
  VALUES (
    request_data_export.project_id,
    request_data_export.user_id,
    'pending',
    export_options,
    NOW()
  )
  RETURNING id INTO export_id;

  RETURN export_id;
END;
$$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

SELECT
    '🎉 Saga MVP Supabase Database Setup Complete!' as status,
    'Fresh database schema created with unified Supabase architecture' as details,
    'All tables, indexes, RLS policies, and business functions are ready' as note,
    'Next: Configure your Supabase project URL and API keys' as next_step;