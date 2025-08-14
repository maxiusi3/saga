import { BaseModel } from './base'
import { Project, CreateProjectInput, UpdateProjectInput, ProjectStats } from '@saga/shared'

export class ProjectModel extends BaseModel {
  protected static tableName = 'projects'

  static async findByFacilitator(facilitatorId: string): Promise<Project[]> {
    return this.query()
      .join('project_roles', 'projects.id', 'project_roles.project_id')
      .where('project_roles.user_id', facilitatorId)
      .where('project_roles.role', 'facilitator')
      .where('project_roles.status', 'active')
      .select('projects.*')
      .orderBy('projects.created_at', 'desc')
  }

  static async findByStoryteller(storytellerId: string): Promise<Project[]> {
    return this.query()
      .join('project_roles', 'projects.id', 'project_roles.project_id')
      .where('project_roles.user_id', storytellerId)
      .where('project_roles.role', 'storyteller')
      .where('project_roles.status', 'active')
      .select('projects.*')
      .orderBy('projects.created_at', 'desc')
  }

  static async findByUserWithRoles(userId: string): Promise<Array<Project & { userRole: string; userRoleStatus: string }>> {
    return this.query()
      .join('project_roles', 'projects.id', 'project_roles.project_id')
      .where('project_roles.user_id', userId)
      .where('project_roles.status', 'active')
      .select(
        'projects.*',
        'project_roles.role as userRole',
        'project_roles.status as userRoleStatus'
      )
      .orderBy('projects.created_at', 'desc')
  }

  static async getProjectRoles(projectId: string): Promise<Array<{
    userId: string
    role: string
    status: string
    userName: string
    userEmail: string
    joinedAt: Date
  }>> {
    return this.db('project_roles')
      .join('users', 'project_roles.user_id', 'users.id')
      .where('project_roles.project_id', projectId)
      .select(
        'project_roles.user_id as userId',
        'project_roles.role',
        'project_roles.status',
        'users.name as userName',
        'users.email as userEmail',
        'project_roles.created_at as joinedAt'
      )
      .orderBy('project_roles.created_at', 'asc')
  }

  static async createProject(projectData: CreateProjectInput, trx?: any): Promise<Project> {
    const query = trx ? this.query(trx) : this.query()
    const [project] = await query.insert({
      ...projectData,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*')
    
    return project
  }

  static async updateProject(id: string, projectData: UpdateProjectInput): Promise<Project> {
    return this.update(id, projectData)
  }

  static async getProjectWithDetails(id: string) {
    const project = await this.query()
      .where('projects.id', id)
      .leftJoin('users as facilitator', 'projects.facilitator_id', 'facilitator.id')
      .leftJoin('users as storyteller', 'projects.storyteller_id', 'storyteller.id')
      .select(
        'projects.*',
        'facilitator.name as facilitator_name',
        'facilitator.email as facilitator_email',
        'storyteller.name as storyteller_name',
        'storyteller.email as storyteller_email'
      )
      .first()

    if (!project) return null

    // Get story count
    const storyCount = await this.db('stories')
      .where('project_id', id)
      .count('* as count')
      .first()

    return {
      ...project,
      facilitator: project.facilitator_name ? {
        id: project.facilitator_id,
        name: project.facilitator_name,
        email: project.facilitator_email,
      } : null,
      storyteller: project.storyteller_name ? {
        id: project.storyteller_id,
        name: project.storyteller_name,
        email: project.storyteller_email,
      } : null,
      _count: {
        stories: parseInt(storyCount?.count as string) || 0,
      },
    }
  }

  static async getProjectStats(id: string): Promise<ProjectStats> {
    const stats = await this.db('stories')
      .where('project_id', id)
      .select(
        this.db.raw('COUNT(*) as total_stories'),
        this.db.raw('SUM(audio_duration) as total_duration'),
        this.db.raw('MAX(created_at) as last_story_date')
      )
      .first()

    return {
      totalStories: parseInt(stats?.total_stories) || 0,
      totalDuration: parseInt(stats?.total_duration) || 0,
      lastStoryDate: stats?.last_story_date ? new Date(stats.last_story_date) : undefined,
      completedChapters: 0, // TODO: Implement chapter logic
    }
  }

  static async assignStoryteller(projectId: string, storytellerId: string): Promise<Project> {
    return this.update(projectId, {
      storyteller_id: storytellerId,
      status: 'active',
    })
  }

  static async isUserAuthorized(projectId: string, userId: string): Promise<boolean> {
    const project = await this.query()
      .where('id', projectId)
      .where(function() {
        this.where('facilitator_id', userId)
          .orWhere('storyteller_id', userId)
      })
      .first()

    return !!project
  }

  static async getActiveProjects(): Promise<Project[]> {
    return this.query()
      .where('status', 'active')
      .where('subscription_expires_at', '>', new Date())
  }

  static async getExpiringProjects(days = 7): Promise<Project[]> {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + days)

    return this.query()
      .where('status', 'active')
      .whereBetween('subscription_expires_at', [new Date(), expiryDate])
  }

  static async hasUserAccess(projectId: string, userId: string): Promise<boolean> {
    const role = await this.db('project_roles')
      .where('project_id', projectId)
      .where('user_id', userId)
      .where('status', 'active')
      .first()

    return !!role
  }

  static async getUserRole(projectId: string, userId: string): Promise<string | null> {
    const role = await this.db('project_roles')
      .where('project_id', projectId)
      .where('user_id', userId)
      .where('status', 'active')
      .select('role')
      .first()

    return role?.role || null
  }
}