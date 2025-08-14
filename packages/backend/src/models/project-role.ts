import { BaseModel } from './base'
import { ProjectRole, ProjectRoleAssignment } from '@saga/shared'
import { v4 as uuidv4 } from 'uuid'

export class ProjectRoleModel extends BaseModel {
  protected static tableName = 'project_roles'

  /**
   * Assign a role to a user in a project
   */
  static async assignRole(userId: string, projectId: string, role: 'facilitator' | 'storyteller'): Promise<ProjectRole> {
    // Check if role already exists
    const existingRole = await this.query()
      .where('user_id', userId)
      .where('project_id', projectId)
      .where('role', role)
      .first()

    if (existingRole) {
      return existingRole
    }

    // For storyteller role, enforce global limit (one per user across platform)
    if (role === 'storyteller') {
      const existingStorytellerRole = await this.query()
        .where('user_id', userId)
        .where('role', 'storyteller')
        .first()

      if (existingStorytellerRole) {
        throw new Error('User already has a storyteller role in another project. Each user can only be a storyteller in one project.')
      }
    }

    return this.create({
      id: uuidv4(),
      user_id: userId,
      project_id: projectId,
      role
    })
  }

  /**
   * Remove a role from a user in a project
   */
  static async removeRole(userId: string, projectId: string, role: 'facilitator' | 'storyteller'): Promise<boolean> {
    const deletedCount = await this.query()
      .where('user_id', userId)
      .where('project_id', projectId)
      .where('role', role)
      .del()

    return deletedCount > 0
  }

  /**
   * Check if user has a specific role in a project
   */
  static async hasRole(userId: string, projectId: string, role: 'facilitator' | 'storyteller'): Promise<boolean> {
    const roleRecord = await this.query()
      .where('user_id', userId)
      .where('project_id', projectId)
      .where('role', role)
      .first()

    return !!roleRecord
  }

  /**
   * Get all roles for a user in a project
   */
  static async getUserRolesInProject(userId: string, projectId: string): Promise<ProjectRole[]> {
    return this.query()
      .where('user_id', userId)
      .where('project_id', projectId)
  }

  /**
   * Get all users with roles in a project
   */
  static async getProjectRoles(projectId: string): Promise<Array<ProjectRole & { user: any }>> {
    return this.query()
      .where('project_id', projectId)
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .select(
        'project_roles.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .orderBy('project_roles.created_at', 'asc')
  }

  /**
   * Get all facilitators for a project
   */
  static async getProjectFacilitators(projectId: string): Promise<Array<ProjectRole & { user: any }>> {
    return this.query()
      .where('project_id', projectId)
      .where('role', 'facilitator')
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .select(
        'project_roles.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .orderBy('project_roles.created_at', 'asc')
  }

  /**
   * Get the storyteller for a project
   */
  static async getProjectStoryteller(projectId: string): Promise<(ProjectRole & { user: any }) | null> {
    return this.query()
      .where('project_id', projectId)
      .where('role', 'storyteller')
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .select(
        'project_roles.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .first()
  }

  /**
   * Get all projects where user has a specific role
   */
  static async getUserProjectsByRole(userId: string, role: 'facilitator' | 'storyteller'): Promise<Array<ProjectRole & { project: any }>> {
    return this.query()
      .where('user_id', userId)
      .where('role', role)
      .leftJoin('projects', 'project_roles.project_id', 'projects.id')
      .select(
        'project_roles.*',
        'projects.name as project_name',
        'projects.status as project_status',
        'projects.created_at as project_created_at'
      )
      .orderBy('project_roles.created_at', 'desc')
  }

  /**
   * Check if project already has a storyteller
   */
  static async projectHasStoryteller(projectId: string): Promise<boolean> {
    const storyteller = await this.query()
      .where('project_id', projectId)
      .where('role', 'storyteller')
      .first()

    return !!storyteller
  }

  /**
   * Count facilitators in a project
   */
  static async countProjectFacilitators(projectId: string): Promise<number> {
    const result = await this.query()
      .where('project_id', projectId)
      .where('role', 'facilitator')
      .count('* as count')
      .first()

    return parseInt(result?.count as string) || 0
  }

  /**
   * Get user's storyteller project (since they can only have one)
   */
  static async getUserStorytellerProject(userId: string): Promise<(ProjectRole & { project: any }) | null> {
    return this.query()
      .where('user_id', userId)
      .where('role', 'storyteller')
      .leftJoin('projects', 'project_roles.project_id', 'projects.id')
      .select(
        'project_roles.*',
        'projects.name as project_name',
        'projects.status as project_status',
        'projects.created_at as project_created_at'
      )
      .first()
  }

  /**
   * Validate role assignment
   */
  static async validateRoleAssignment(userId: string, projectId: string, role: 'facilitator' | 'storyteller'): Promise<{
    valid: boolean
    error?: string
  }> {
    // Check if user already has this role in this project
    const hasRole = await this.hasRole(userId, projectId, role)
    if (hasRole) {
      return {
        valid: false,
        error: `User already has ${role} role in this project`
      }
    }

    // For storyteller role, check global limit
    if (role === 'storyteller') {
      const existingStorytellerProject = await this.getUserStorytellerProject(userId)
      if (existingStorytellerProject) {
        return {
          valid: false,
          error: `User is already a storyteller in project "${existingStorytellerProject.project_name}". Each user can only be a storyteller in one project.`
        }
      }

      // Check if project already has a storyteller
      const projectHasStoryteller = await this.projectHasStoryteller(projectId)
      if (projectHasStoryteller) {
        return {
          valid: false,
          error: 'This project already has a storyteller'
        }
      }
    }

    return { valid: true }
  }
}