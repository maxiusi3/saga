-- Saga RLS Policies
-- Run this AFTER supabase-migration-simple.sql
-- Run this ONLY ONCE (or drop policies first if re-running)

-- ============================================
-- USER SETTINGS POLICIES
-- ============================================

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- USER RESOURCE WALLETS POLICIES
-- ============================================

CREATE POLICY "Users can view own wallet" ON user_resource_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PROJECTS POLICIES
-- ============================================

CREATE POLICY "Users can view projects they're members of" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Facilitators can update their projects" ON projects
    FOR UPDATE USING (facilitator_id = auth.uid());

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (facilitator_id = auth.uid());

-- ============================================
-- PROJECT MEMBERS POLICIES
-- ============================================

CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- ============================================
-- STORIES POLICIES
-- ============================================

CREATE POLICY "Users can view stories in their projects" ON stories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = stories.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Storytellers can create stories" ON stories
    FOR INSERT WITH CHECK (storyteller_id = auth.uid());

CREATE POLICY "Storytellers can update own stories" ON stories
    FOR UPDATE USING (storyteller_id = auth.uid());
