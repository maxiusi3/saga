import { Router } from 'express'
import { param, validationResult } from 'express-validator'
import { ProjectRoleModel } from '../models/project-role'
import { UserModel } from '../models/user'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

const router = Router()

/**
 * GET /api/projects/:projectId/members
 * Get all members of a project with their roles
 */
router.get(
  '/:projectId/members',
  authenticateToken,
  [param('projectId').isUUID().withMessage('Invalid project ID format')],
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params

    // Verify user has access to this project
    const userHasAccess = await ProjectRoleModel.getUserRolesInProject(req.user!.id, projectId)
    if (userHasAccess.length === 0) {
      throw createError('Access denied to project', 403, 'PROJECT_ACCESS_DENIED')
    }

    // Get all project members with their user information
    const members = await ProjectRoleModel.getProjectRoles(projectId)

    const response: ApiResponse = {
      data: members.map(member => ({
        id: member.id,
        userId: member.user_id,
        role: member.role,
        userName: member.user_name,
        userEmail: member.user_email,
        joinedAt: member.created_at,
        lastActive: member.updated_at // This could be enhanced with actual last activity tracking
      })),
      message: 'Project members retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
)

/**
 * DELETE /api/projects/:projectId/members/:memberId
 * Remove a member from a project
 */
router.delete(
  '/:projectId/members/:memberId',
  authenticateToken,
  [
    param('projectId').isUUID().withMessage('Invalid project ID format'),
    param('memberId').isUUID().withMessage('Invalid member ID format')
  ],
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId, memberId } = req.params

    // Verify user is a facilitator in this project (only facilitators can remove members)
    const userRole = await ProjectRoleModel.hasRole(req.user!.id, projectId, 'facilitator')
    if (!userRole) {
      throw createError('Only facilitators can remove project members', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    // Get the member to be removed
    const memberToRemove = await ProjectRoleModel.query()
      .where('id', memberId)
      .where('project_id', projectId)
      .first()

    if (!memberToRemove) {
      throw createError('Member not found in project', 404, 'MEMBER_NOT_FOUND')
    }

    // Prevent removing yourself
    if (memberToRemove.user_id === req.user!.id) {
      throw createError('Cannot remove yourself from the project', 400, 'CANNOT_REMOVE_SELF')
    }

    // Remove the member
    const removed = await ProjectRoleModel.removeRole(
      memberToRemove.user_id,
      projectId,
      memberToRemove.role
    )

    if (!removed) {
      throw createError('Failed to remove member from project', 500, 'REMOVAL_FAILED')
    }

    const response: ApiResponse = {
      data: { removed: true },
      message: 'Member removed from project successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
)

/**
 * GET /api/projects/:projectId/members/stats
 * Get member activity statistics
 */
router.get(
  '/:projectId/members/stats',
  authenticateToken,
  [param('projectId').isUUID().withMessage('Invalid project ID format')],
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params

    // Verify user has access to this project
    const userHasAccess = await ProjectRoleModel.getUserRolesInProject(req.user!.id, projectId)
    if (userHasAccess.length === 0) {
      throw createError('Access denied to project', 403, 'PROJECT_ACCESS_DENIED')
    }

    // Get facilitator activity stats
    const facilitatorStats = await ProjectRoleModel.query()
      .where('project_roles.project_id', projectId)
      .where('project_roles.role', 'facilitator')
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .leftJoin('interactions', 'project_roles.user_id', 'interactions.facilitator_id')
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .where('stories.project_id', projectId)
      .groupBy('project_roles.id', 'project_roles.user_id', 'users.name')
      .select(
        'project_roles.user_id as facilitatorId',
        'users.name as facilitatorName',
        ProjectRoleModel.db.raw('COUNT(interactions.id) as interactionCount'),
        ProjectRoleModel.db.raw('MAX(interactions.created_at) as lastActive')
      )

    // Get storyteller activity stats
    const storytellerStats = await ProjectRoleModel.query()
      .where('project_roles.project_id', projectId)
      .where('project_roles.role', 'storyteller')
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .leftJoin('stories', 'project_roles.user_id', 'stories.created_by')
      .where('stories.project_id', projectId)
      .groupBy('project_roles.id', 'project_roles.user_id', 'users.name')
      .select(
        'project_roles.user_id as storytellerId',
        'users.name as storytellerName',
        ProjectRoleModel.db.raw('COUNT(stories.id) as storyCount'),
        ProjectRoleModel.db.raw('SUM(stories.audio_duration) as totalDuration'),
        ProjectRoleModel.db.raw('MAX(stories.created_at) as lastStory')
      )

    const response: ApiResponse = {
      data: {
        facilitatorStats: facilitatorStats.map(stat => ({
          facilitatorId: stat.facilitatorId,
          facilitatorName: stat.facilitatorName,
          interactionCount: parseInt(stat.interactionCount) || 0,
          lastActive: stat.lastActive
        })),
        storytellerStats: storytellerStats.map(stat => ({
          storytellerId: stat.storytellerId,
          storytellerName: stat.storytellerName,
          storyCount: parseInt(stat.storyCount) || 0,
          totalDuration: parseInt(stat.totalDuration) || 0,
          lastStory: stat.lastStory
        }))
      },
      message: 'Member statistics retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
)

export default router