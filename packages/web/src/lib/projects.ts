import { createClientSupabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { UserRole } from '@saga/shared'

export interface Project {
  id: string
  name: string
  description?: string
  facilitator_id: string
  status: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: UserRole
  invited_by?: string
  invited_at: string
  joined_at?: string
  status: 'pending' | 'active' | 'declined' | 'removed'
  created_at: string
  updated_at: string
}

export interface ProjectWithMembers extends Project {
  members: ProjectMember[]
  member_count: number
  story_count: number
  user_role?: UserRole
  is_owner: boolean
}

export interface CreateProjectData {
  name: string
  description?: string
  facilitator_id: string
}

export interface CreateProjectWithRoleData {
  name: string
  description?: string
  facilitator_id: string
  role: 'facilitator' | 'storyteller'
}

export interface UpdateProjectData {
  name?: string
  description?: string
}

export interface InviteMemberData {
  project_id: string
  user_email: string
  role: UserRole
  invited_by: string
}

export class ProjectService {
  private supabase = createClientSupabase()
  private supabaseAdmin: any = null

  constructor() {
    // Only create admin client on server side to avoid client-side errors
    if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
    }
  }

  /**
   * Create a new project
   */
  async createProject(projectData: CreateProjectData): Promise<Project | null> {
    try {
      // Use admin client to bypass RLS for project creation
      const client = this.supabaseAdmin || this.supabase
      console.log('ProjectService: Creating project with client:', this.supabaseAdmin ? 'admin' : 'regular')

      const { data, error } = await client
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          facilitator_id: projectData.facilitator_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating project:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error creating project:', error)
      return null
    }
  }

  /**
   * Create a new project with role and resource consumption
   */
  async createProjectWithRole(projectData: CreateProjectWithRoleData): Promise<Project | null> {
    try {
      console.log('ProjectService: Creating project with role:', projectData)

      // 调用数据库函数创建项目并消耗资源
      const { data, error } = await this.supabase.rpc('create_project_with_role', {
        project_name: projectData.name,
        project_description: projectData.description || '',
        facilitator_id: projectData.facilitator_id,
        creator_role: projectData.role || 'facilitator'
      })

      if (error) {
        console.error('Error creating project with role:', error)
        throw new Error(error.message)
      }

      // 获取创建的项目详情
      const { data: project, error: fetchError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', data)
        .single()

      if (fetchError) {
        console.error('Error fetching created project:', fetchError)
        throw new Error('Project created but failed to fetch details')
      }

      return project
    } catch (error) {
      console.error('Error creating project with role:', error)
      throw error
    }
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<ProjectWithMembers[]> {
    try {
      console.log('ProjectService: Fetching projects for user:', userId)

      // Use regular client with RLS policies (works for both server and client side)
      console.log('ProjectService: Using regular client to fetch projects')
      const { data: projects, error: projectsError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('facilitator_id', userId)

      console.log('ProjectService: Regular client query result:', { projects, projectsError })

      if (projectsError) {
        console.error('Error fetching user projects:', projectsError)
        return []
      }

      // Get story counts for each project
      const projectsWithCounts = await Promise.all(
        (projects || []).map(async (project) => {
          const { count: storyCount } = await this.supabase
            .from('stories')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id)

          const { data: members } = await this.supabase
            .from('project_roles')
            .select('*')
            .eq('project_id', project.id)
            .eq('status', 'active')

          const userMember = members?.find(m => m.user_id === userId)
          const isOwner = project.facilitator_id === userId

          return {
            ...project,
            members: members || [],
            member_count: members?.length || 0,
            story_count: storyCount || 0,
            user_role: userMember?.role, // 使用实际角色，不强制为 facilitator
            is_owner: isOwner
          }
        })
      )

      return projectsWithCounts
    } catch (error) {
      console.error('Error fetching user projects:', error)
      return []
    }
  }

  /**
   * Get a single project by ID
   */
  async getProjectById(projectId: string, userId: string): Promise<ProjectWithMembers | null> {
    try {
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError) {
        console.error('Error fetching project:', projectError)
        return null
      }

      // Check if user has access to this project
      const isOwner = project.facilitator_id === userId

      // 总是查询用户的角色记录，无论是否为项目所有者
      const { data: userMember } = await this.supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      // 如果用户不是所有者且没有角色记录，则无权访问
      if (!isOwner && !userMember) {
        return null // User doesn't have access
      }

      // Get all members
      const { data: members } = await this.supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'active')

      // Get story count
      const { count: storyCount } = await this.supabase
        .from('stories')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)

      return {
        ...project,
        members: members || [],
        member_count: members?.length || 0,
        story_count: storyCount || 0,
        user_role: userMember?.role, // 使用实际的角色，不强制为 facilitator
        is_owner: isOwner
      }
    } catch (error) {
      console.error('Error fetching project:', error)
      return null
    }
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, updateData: UpdateProjectData): Promise<Project | null> {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single()

      if (error) {
        console.error('Error updating project:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error updating project:', error)
      return null
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) {
        console.error('Error deleting project:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  }

  /**
   * Invite a member to a project
   */
  async inviteMember(inviteData: InviteMemberData): Promise<ProjectMember | null> {
    try {
      // First, find the user by email
      const { data: user, error: userError } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteData.user_email)
        .single()

      if (userError || !user) {
        console.error('User not found:', inviteData.user_email)
        return null
      }

      // Create the project role invitation
      const { data, error } = await this.supabase
        .from('project_roles')
        .insert({
          project_id: inviteData.project_id,
          user_id: user.id,
          role: inviteData.role,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error('Error inviting member:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error inviting member:', error)
      return null
    }
  }

  /**
   * Accept a project invitation
   */
  async acceptInvitation(memberId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('project_members')
        .update({
          status: 'active',
          joined_at: new Date().toISOString()
        })
        .eq('id', memberId)

      if (error) {
        console.error('Error accepting invitation:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error accepting invitation:', error)
      return false
    }
  }

  /**
   * Remove a member from a project
   */
  async removeMember(memberId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('project_members')
        .update({ status: 'removed' })
        .eq('id', memberId)

      if (error) {
        console.error('Error removing member:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error removing member:', error)
      return false
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(memberId: string, newRole: UserRole): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('project_roles')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) {
        console.error('Error updating member role:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating member role:', error)
      return false
    }
  }
}

// Export singleton instance
export const projectService = new ProjectService()
