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
      
      // Check if Supabase is configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.error('ProjectService: No Supabase URL configured')
        return [];
      }

      /* TODO: Enable when backend is ready
      // 1) 查询用户作为所有者（facilitator_id）的项目
      const ownedPromise = (async () => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const supa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
          const { data: { session } } = await supa.auth.getSession()
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
        } catch {}
        const resp = await fetch('/api/projects/owned', { credentials: 'include', headers })
        if (!resp.ok) {
          console.warn('ProjectService: /api/projects/owned failed with', resp.status)
          return { data: [], error: null } as any
        }
        const json = await resp.json()
        return { data: json.projects, error: null } as any
      })()

      // 2) 查询用户作为成员的项目（通过同源 API 代理，避免 SSL/CORS）
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // 尝试带上 Bearer（若在浏览器环境）
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supa = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supa.auth.getSession()
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      } catch {}
      const rolesResp = await fetch('/api/project-roles', { credentials: 'include', headers })
      let memberRoles: any[] = []
      if (rolesResp.ok) {
        const json = await rolesResp.json()
        memberRoles = json.roles || []
      } else {
        console.warn('ProjectService: /api/project-roles failed with', rolesResp.status)
      }

      const memberProjectIds = (memberRoles || []).map((r: any) => r.project_id)

      let memberProjects: any[] = []
      if (memberProjectIds.length > 0) {
        const headers2: Record<string, string> = { 'Content-Type': 'application/json' }
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const supa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
          const { data: { session } } = await supa.auth.getSession()
          if (session?.access_token) headers2['Authorization'] = `Bearer ${session.access_token}`
        } catch {}
        const resp2 = await fetch('/api/projects/by-ids', {
          method: 'POST',
          credentials: 'include',
          headers: headers2,
          body: JSON.stringify({ ids: memberProjectIds })
        })
        if (resp2.ok) {
          const json2 = await resp2.json()
          memberProjects = json2.projects || []
        } else {
          console.warn('ProjectService: /api/projects/by-ids failed with', resp2.status)
        }
      }

      const { data: owned, error: ownedError } = await ownedPromise
      if (ownedError) {
        console.error('ProjectService: Error fetching owned projects:', ownedError)
      }

      // 合并并去重（owned 优先，成员项目后覆盖无影响）
      const map = new Map<string, any>()
      ;(owned || []).forEach((p) => map.set(p.id, p))
      ;(memberProjects || []).forEach((p) => map.set(p.id, p))
      const projects = Array.from(map.values())

      console.log('ProjectService: Combined projects:', {
        owned: (owned || []).length,
        member: memberProjects.length,
        total: projects.length,
      })

      // 统计与成员信息
      const projectsWithCounts = await Promise.all(
        (projects || []).map(async (project) => {
          // 统一通过 /api 概览接口，避免多次直连
          const headers3: Record<string, string> = { 'Content-Type': 'application/json' }
          try {
            const { createClient } = await import('@supabase/supabase-js')
            const supa = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )
            const { data: { session } } = await supa.auth.getSession()
            if (session?.access_token) headers3['Authorization'] = `Bearer ${session.access_token}`
          } catch {}
          const resp3 = await fetch(`/api/projects/${project.id}/overview`, { credentials: 'include', headers: headers3 })
          let members: any[] = []
          let storyCount = 0
          if (resp3.ok) {
            const j = await resp3.json()
            members = j.members || []
            storyCount = j.storyCount || 0
          } else {
            console.warn('ProjectService: /api/projects/[id]/overview failed with', resp3.status)
          }

          const userMember = members?.find((m) => m.user_id === userId)
          const isOwner = project.facilitator_id === userId

          return {
            ...project,
            members: members || [],
            member_count: members?.length || 0,
            story_count: storyCount || 0,
            user_role: userMember?.role, // 使用实际角色，不强制为 facilitator
            is_owner: isOwner,
          }
        })
      )

      return projectsWithCounts
      */
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

  /**
   * Get mock projects for development when backend is not available
   */
  private getMockProjects(userId: string): ProjectWithMembers[] {
    return [
      {
        id: '1',
        name: "Grandma's Memoir",
        description: 'Recording grandma\'s life stories and family traditions',
        facilitator_id: userId,
        status: 'active',
        created_at: '2023-12-01T00:00:00Z',
        updated_at: '2023-12-01T00:00:00Z',
        members: [
          {
            id: '1',
            project_id: '1',
            user_id: userId,
            role: 'facilitator' as UserRole,
            invited_at: '2023-12-01T00:00:00Z',
            status: 'active' as const,
            created_at: '2023-12-01T00:00:00Z',
            updated_at: '2023-12-01T00:00:00Z'
          }
        ],
        member_count: 3,
        story_count: 37,
        user_role: 'facilitator' as UserRole,
        is_owner: true
      },
      {
        id: '2',
        name: 'Family Legend Stories',
        description: 'Collecting and organizing family stories and legends',
        facilitator_id: 'other-user',
        status: 'active',
        created_at: '2023-11-01T00:00:00Z',
        updated_at: '2023-11-01T00:00:00Z',
        members: [
          {
            id: '2',
            project_id: '2',
            user_id: userId,
            role: 'storyteller' as UserRole,
            invited_at: '2023-11-01T00:00:00Z',
            status: 'active' as const,
            created_at: '2023-11-01T00:00:00Z',
            updated_at: '2023-11-01T00:00:00Z'
          }
        ],
        member_count: 2,
        story_count: 17,
        user_role: 'storyteller' as UserRole,
        is_owner: false
      }
    ];
  }
}

// Export singleton instance
export const projectService = new ProjectService()
