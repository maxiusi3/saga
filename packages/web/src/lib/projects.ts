import { createClientSupabase } from '@/lib/supabase'
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

  /**
   * Create a new project
   */
  async createProject(projectData: CreateProjectData): Promise<Project | null> {
    try {
      const { data, error } = await this.supabase
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
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<ProjectWithMembers[]> {
    try {
      console.log('ProjectService: Fetching projects for user:', userId)

      // Get projects where user is owner or member
      const { data: projects, error: projectsError } = await this.supabase
        .from('projects')
        .select(`
          *,
          project_roles!inner(
            id,
            user_id,
            role,
            status,
            created_at
          )
        `)
        .or(`facilitator_id.eq.${userId},project_roles.user_id.eq.${userId}`)
        .eq('project_roles.status', 'active')

      console.log('ProjectService: Query result:', { projects, projectsError })

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
            user_role: isOwner ? 'facilitator' as UserRole : userMember?.role,
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
      let userMember = null

      if (!isOwner) {
        const { data: member } = await this.supabase
          .from('project_roles')
          .select('*')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        if (!member) {
          return null // User doesn't have access
        }
        userMember = member
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
        user_role: isOwner ? 'facilitator' as UserRole : userMember?.role,
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
