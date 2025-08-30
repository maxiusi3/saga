import { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { ProjectModel } from '../models/project'
import { InvitationModel } from '../models/invitation'
import { SubscriptionModel } from '../models/subscription'
import { ResourceWalletService } from '../services/resource-wallet-service'
import { ProjectAnalyticsService } from '../services/project-analytics-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse, PaginatedResponse } from '@saga/shared'

export class ProjectController {
  static createProjectValidation = [
    body('name')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be between 1 and 255 characters'),
  ]

  static createProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { name, description } = req.body

    // Check if user has sufficient project vouchers
    const canCreate = await ResourceWalletService.canConsumeProjectVoucher(req.user.id)
    if (!canCreate.success) {
      throw createError(
        canCreate.error || 'Insufficient project vouchers',
        400,
        'INSUFFICIENT_RESOURCES',
        { 
          walletBalance: canCreate.walletBalance,
          requiredResources: { projectVouchers: 1 }
        }
      )
    }

    // Start database transaction
    const trx = await ProjectModel.db.transaction()

    try {
      // Create the project
      const project = await ProjectModel.createProject({
        name,
        description,
        facilitatorId: req.user.id,
      }, trx)

      // Create facilitator role for the user
      await trx('project_roles').insert({
        user_id: req.user.id,
        project_id: project.id,
        role: 'facilitator',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      })

      // Consume project voucher with transaction
      const consumptionResult = await ResourceWalletService.consumeProjectVoucher(req.user.id, project.id, trx)
      
      if (!consumptionResult.success) {
        throw createError(
          consumptionResult.error || 'Failed to consume project voucher',
          400,
          'RESOURCE_CONSUMPTION_FAILED'
        )
      }

      // Initialize project subscription (1-year timer)
      const subscriptionEndDate = new Date()
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1)

      await SubscriptionModel.createProjectSubscription({
        projectId: project.id,
        facilitatorId: req.user.id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: subscriptionEndDate,
        planId: 'saga-project-subscription',
        metadata: {
          createdWithProject: true,
          initialDuration: '1-year'
        }
      }, trx)

      // Commit transaction
      await trx.commit()

      // Get updated wallet balance
      const updatedWalletBalance = await ResourceWalletService.getWalletBalance(req.user.id)

      // Track project creation analytics
      await ProjectAnalyticsService.trackProjectCreation({
        userId: req.user.id,
        projectId: project.id,
        projectName: name,
        hasDescription: !!description,
        creationSource: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
        walletBalanceBefore: canCreate.walletBalance || {
          projectVouchers: 1,
          facilitatorSeats: 0,
          storytellerSeats: 0
        },
        walletBalanceAfter: updatedWalletBalance
      })

      // Get the complete project with subscription info
      const completeProject = await ProjectModel.getProjectWithDetails(project.id)

      const response: ApiResponse = {
        data: {
          project: completeProject,
          resourceUsage: {
            consumed: {
              projectVouchers: 1
            },
            remaining: updatedWalletBalance,
            transactionId: consumptionResult.transactionId
          }
        },
        message: 'Project created successfully with 1-year subscription',
        timestamp: new Date().toISOString(),
      }

      res.status(201).json(response)
    } catch (error) {
      // Rollback transaction on error
      await trx.rollback()
      
      // If this is a resource-related error, try to refund any consumed resources
      if (error.code === 'RESOURCE_CONSUMPTION_FAILED') {
        try {
          await ResourceWalletService.refundResources(
            req.user.id,
            'project_voucher',
            1,
            'Project creation failed - automatic refund',
            project?.id
          )
        } catch (refundError) {
          console.error('Failed to refund project voucher after creation failure:', refundError)
        }
      }
      
      throw error
    }
  })

  static getProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const { role = 'all' } = req.query

    let projects = []

    if (role === 'all') {
      // Get all projects with user roles
      projects = await ProjectModel.findByUserWithRoles(req.user.id)
    } else if (role === 'facilitator') {
      const facilitatorProjects = await ProjectModel.findByFacilitator(req.user.id)
      projects = facilitatorProjects.map(p => ({ ...p, userRole: 'facilitator', userRoleStatus: 'active' }))
    } else if (role === 'storyteller') {
      const storytellerProjects = await ProjectModel.findByStoryteller(req.user.id)
      projects = storytellerProjects.map(p => ({ ...p, userRole: 'storyteller', userRoleStatus: 'active' }))
    }

    // Enhance projects with subscription status and role information
    const enhancedProjects = await Promise.all(
      projects.map(async (project) => {
        // Get subscription status
        const subscriptionStatus = await SubscriptionModel.getProjectSubscriptionStatus(project.id)
        
        // Get all project roles for context
        const projectRoles = await ProjectModel.getProjectRoles(project.id)
        
        return {
          ...project,
          userRole: project.userRole,
          userRoleStatus: project.userRoleStatus,
          subscription: {
            isActive: subscriptionStatus.isActive,
            isExpired: subscriptionStatus.isExpired,
            daysRemaining: subscriptionStatus.daysRemaining,
            endDate: subscriptionStatus.subscription?.currentPeriodEnd
          },
          roles: projectRoles,
          facilitators: projectRoles.filter(r => r.role === 'facilitator' && r.status === 'active'),
          storytellers: projectRoles.filter(r => r.role === 'storyteller' && r.status === 'active')
        }
      })
    )

    const response: ApiResponse = {
      data: enhancedProjects,
      message: 'Projects retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getProjectValidation = [
    param('id').isUUID().withMessage('Invalid project ID format'),
  ]

  static getProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    const project = await ProjectModel.getProjectWithDetails(id)
    if (!project) {
      throw createError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    // Track project view analytics
    if (req.user) {
      await ProjectAnalyticsService.trackProjectEngagement({
        userId: req.user.id,
        projectId: id,
        eventType: 'project_viewed',
        properties: {
          source: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
          userAgent: req.headers['user-agent'],
          referrer: req.headers['referer']
        }
      })
    }

    const response: ApiResponse = {
      data: project,
      message: 'Project retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static updateProjectValidation = [
    param('id').isUUID().withMessage('Invalid project ID format'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be between 1 and 255 characters'),
    body('status')
      .optional()
      .isIn(['pending', 'active', 'completed'])
      .withMessage('Invalid project status'),
  ]

  static updateProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params
    const { name, status } = req.body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (status !== undefined) updateData.status = status

    const project = await ProjectModel.updateProject(id, updateData)

    const response: ApiResponse = {
      data: project,
      message: 'Project updated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static deleteProjectValidation = [
    param('id').isUUID().withMessage('Invalid project ID format'),
  ]

  static deleteProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    // Check if project exists
    const project = await ProjectModel.findById(id)
    if (!project) {
      throw createError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    await ProjectModel.delete(id)

    const response: ApiResponse = {
      data: { success: true },
      message: 'Project deleted successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static generateInvitationValidation = [
    param('id').isUUID().withMessage('Invalid project ID format'),
  ]

  static generateInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    // Check if project exists
    const project = await ProjectModel.findById(id)
    if (!project) {
      throw createError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    // Check if project already has a storyteller
    if (project.storyteller_id) {
      throw createError('Project already has a storyteller', 400, 'PROJECT_HAS_STORYTELLER')
    }

    // Invalidate existing invitations for this project
    await InvitationModel.invalidateProjectInvitations(id)

    // Create new invitation
    const invitation = await InvitationModel.createInvitation({
      projectId: id,
    })

    const response: ApiResponse = {
      data: invitation,
      message: 'Invitation generated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getProjectStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    const stats = await ProjectModel.getProjectStats(id)

    const response: ApiResponse = {
      data: stats,
      message: 'Project stats retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static assignStoryteller = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params
    const { storytellerId } = req.body

    if (!storytellerId) {
      throw createError('Storyteller ID is required', 400, 'STORYTELLER_ID_REQUIRED')
    }

    const project = await ProjectModel.assignStoryteller(id, storytellerId)

    // Create storyteller role
    await ProjectModel.db('user_roles').insert({
      user_id: storytellerId,
      type: 'storyteller',
      project_id: id,
    })

    const response: ApiResponse = {
      data: project,
      message: 'Storyteller assigned successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Get project subscription status
   */
  static getProjectSubscriptionStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    // Check if project exists and user has access
    const project = await ProjectModel.findById(id)
    if (!project) {
      throw createError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    // Get subscription status
    const subscriptionStatus = await SubscriptionModel.getProjectSubscriptionStatus(id)
    
    // Get subscription details if exists
    const subscription = subscriptionStatus.subscription

    const response: ApiResponse = {
      data: {
        projectId: id,
        isActive: subscriptionStatus.isActive,
        isExpired: subscriptionStatus.isExpired,
        daysRemaining: subscriptionStatus.daysRemaining,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          planId: subscription.planId,
          facilitatorId: subscription.facilitatorId,
          metadata: subscription.metadata
        } : null,
        archivalMode: subscriptionStatus.isExpired,
        canCreateStories: subscriptionStatus.isActive,
        canInviteMembers: subscriptionStatus.isActive,
        canExportData: true // Always available
      },
      message: 'Project subscription status retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Get project resource requirements and user's available resources
   */
  static getProjectResourceInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Get user's current wallet balance
    const walletBalance = await ResourceWalletService.getWalletBalance(req.user.id)

    // Check what the user can do with current resources
    const canCreateProject = await ResourceWalletService.canCreateProject(req.user.id)
    const canInviteFacilitator = await ResourceWalletService.canInviteFacilitator(req.user.id)
    const canInviteStoryteller = await ResourceWalletService.canInviteStoryteller(req.user.id)

    const response: ApiResponse = {
      data: {
        currentBalance: walletBalance,
        capabilities: {
          canCreateProject,
          canInviteFacilitator,
          canInviteStoryteller
        },
        requirements: {
          projectCreation: {
            projectVouchers: 1
          },
          facilitatorInvitation: {
            facilitatorSeats: 1
          },
          storytellerInvitation: {
            storytellerSeats: 1
          }
        },
        recommendations: {
          needsMoreVouchers: !canCreateProject,
          needsMoreFacilitatorSeats: !canInviteFacilitator,
          needsMoreStorytellerSeats: !canInviteStoryteller
        }
      },
      message: 'Project resource information retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
}