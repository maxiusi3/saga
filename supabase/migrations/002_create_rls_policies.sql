-- Row Level Security (RLS) policies for Saga project
-- These policies ensure users can only access data they have permission to see

-- Helper function to check if user is project member
CREATE OR REPLACE FUNCTION is_project_member(project_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_roles 
    WHERE project_roles.project_id = is_project_member.project_id 
    AND project_roles.user_id = is_project_member.user_id 
    AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = is_project_member.project_id 
    AND projects.facilitator_id = is_project_member.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User Resource Wallets Policies
CREATE POLICY "Users can view their own wallet" ON user_resource_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" ON user_resource_wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet" ON user_resource_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seat Transactions Policies
CREATE POLICY "Users can view their own transactions" ON seat_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON seat_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects Policies
CREATE POLICY "Users can view projects they are members of" ON projects
  FOR SELECT USING (
    auth.uid() = facilitator_id OR 
    is_project_member(id, auth.uid())
  );

CREATE POLICY "Facilitators can update their projects" ON projects
  FOR UPDATE USING (auth.uid() = facilitator_id);

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their projects" ON projects
  FOR DELETE USING (auth.uid() = facilitator_id);

-- Project Roles Policies
CREATE POLICY "Users can view roles for projects they are members of" ON project_roles
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Facilitators can manage project roles" ON project_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_roles.project_id 
      AND projects.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own project roles" ON project_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Invitations Policies
CREATE POLICY "Users can view invitations for their projects" ON invitations
  FOR SELECT USING (
    auth.uid() = inviter_id OR 
    is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Facilitators can create invitations" ON invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = invitations.project_id 
      AND projects.facilitator_id = auth.uid()
    )
  );

CREATE POLICY "Facilitators can update invitations" ON invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = invitations.project_id 
      AND projects.facilitator_id = auth.uid()
    )
  );

-- Chapters Policies (public read access for AI prompts)
CREATE POLICY "Anyone can view active chapters" ON chapters
  FOR SELECT USING (is_active = true);

-- Prompts Policies (public read access for AI prompts)
CREATE POLICY "Anyone can view active prompts" ON prompts
  FOR SELECT USING (is_active = true);

-- User Prompts Policies
CREATE POLICY "Users can view prompts for their projects" ON user_prompts
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Users can create prompts for their projects" ON user_prompts
  FOR INSERT WITH CHECK (
    is_project_member(project_id, auth.uid()) AND 
    auth.uid() = created_by
  );

CREATE POLICY "Users can update their own prompts" ON user_prompts
  FOR UPDATE USING (auth.uid() = created_by);

-- Project Prompt State Policies
CREATE POLICY "Users can view prompt state for their projects" ON project_prompt_state
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Facilitators can manage prompt state" ON project_prompt_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_prompt_state.project_id 
      AND projects.facilitator_id = auth.uid()
    )
  );

-- Stories Policies
CREATE POLICY "Users can view stories for their projects" ON stories
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Storytellers can create their own stories" ON stories
  FOR INSERT WITH CHECK (
    is_project_member(project_id, auth.uid()) AND 
    auth.uid() = storyteller_id
  );

CREATE POLICY "Storytellers can update their own stories" ON stories
  FOR UPDATE USING (auth.uid() = storyteller_id);

CREATE POLICY "Facilitators can update stories in their projects" ON stories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = stories.project_id 
      AND projects.facilitator_id = auth.uid()
    )
  );

-- Chapter Summaries Policies
CREATE POLICY "Users can view summaries for their projects" ON chapter_summaries
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Facilitators can manage summaries" ON chapter_summaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = chapter_summaries.project_id 
      AND projects.facilitator_id = auth.uid()
    )
  );

-- Interactions Policies
CREATE POLICY "Users can view interactions for their projects" ON interactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = interactions.story_id 
      AND is_project_member(stories.project_id, auth.uid())
    )
  );

CREATE POLICY "Facilitators can create interactions" ON interactions
  FOR INSERT WITH CHECK (
    auth.uid() = facilitator_id AND
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = interactions.story_id 
      AND is_project_member(stories.project_id, auth.uid())
    )
  );

CREATE POLICY "Facilitators can update their own interactions" ON interactions
  FOR UPDATE USING (auth.uid() = facilitator_id);

-- Export Requests Policies
CREATE POLICY "Users can view their own export requests" ON export_requests
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Users can create export requests for their projects" ON export_requests
  FOR INSERT WITH CHECK (
    is_project_member(project_id, auth.uid()) AND 
    auth.uid() = user_id
  );

CREATE POLICY "Users can update their own export requests" ON export_requests
  FOR UPDATE USING (auth.uid() = user_id);
