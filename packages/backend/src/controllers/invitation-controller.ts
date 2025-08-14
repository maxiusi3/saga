import { Request, Response } from 'express'
import { body, param, validationResult } from 'express-validator'
import { InvitationModel } from '../models/invitation'
import { ProjectModel } from '../models/project'
import { UserModel } from '../models/user'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class InvitationController {
  static createInvitationValidation = [
    body('projectId').isUUID().withMessage('Valid project ID is required'),
    body('role').isIn(['facilitator', 'storyteller']).withMessage('Role must be either facilitator or storyteller'),
  ]

  static createInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId, role } = req.body
    const userId = req.user!.id

    // Check if project exists and user has permission
    const project = await ProjectModel.findById(projectId)
    if (!project) {
      throw createError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    // Import ProjectRoleModel
    const { ProjectRoleModel } = require('../models/project-role')
    
    // Only facilitator can create invitations
    const isFacilitator = await ProjectRoleModel.hasRole(userId, projectId, 'facilitator')
    if (!isFacilitator) {
      throw createError('Only project facilitators can create invitations', 403, 'ACCESS_DENIED')
    }

    // Validate role assignment
    if (role === 'storyteller') {
      const projectHasStoryteller = await ProjectRoleModel.projectHasStoryteller(projectId)
      if (projectHasStoryteller) {
        throw createError('This project already has a storyteller', 400, 'PROJECT_HAS_STORYTELLER')
      }
    }

    // Check if user has required seats for the role
    const { ResourceWalletService } = require('../services/resource-wallet-service')
    const resourceType = role === 'facilitator' ? 'facilitator_seat' : 'storyteller_seat'
    const hasSeats = await ResourceWalletService.hasSufficientResources(userId, resourceType, 1)
    
    if (!hasSeats) {
      throw createError(
        `You need 1 ${resourceType.replace('_', ' ')} to invite a ${role}. Please purchase more seats.`,
        400,
        'INSUFFICIENT_RESOURCES'
      )
    }

    // Create invitation (72 hours expiry as per requirements)
    const invitation = await InvitationModel.createInvitation({
      projectId,
      role,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
    })

    const response: ApiResponse<any> = {
      data: invitation,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} invitation created successfully`,
      timestamp: new Date().toISOString(),
    }

    res.status(201).json(response)
  })

  static getInvitationValidation = [
    param('token').notEmpty().withMessage('Invitation token is required'),
  ]

  static getInvitation = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { token } = req.params

    const invitation = await InvitationModel.getInvitationWithProject(token)
    if (!invitation) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND')
    }

    // Check if invitation is valid (not expired and not used)
    const now = new Date()
    if (invitation.expires_at < now) {
      throw createError('Invitation has expired', 400, 'INVITATION_EXPIRED')
    }

    if (invitation.used_at) {
      throw createError('Invitation has already been used', 400, 'INVITATION_USED')
    }

    const response: ApiResponse<any> = {
      data: {
        invitation: {
          id: invitation.id,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          project: {
            id: invitation.projectId,
            name: invitation.project?.name,
            status: invitation.project?.status,
            facilitator: {
              name: invitation.project?.creator?.name,
              email: invitation.project?.creator?.email,
            },
          },
        },
      },
      message: 'Invitation retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static acceptInvitationValidation = [
    param('token').notEmpty().withMessage('Invitation token is required'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Invalid phone number'),
  ]

  static acceptInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { token } = req.params
    const { name, email, phone } = req.body

    // Get valid invitation
    const validInvitation = await InvitationModel.getValidInvitation(token)
    if (!validInvitation) {
      throw createError('Invalid or expired invitation', 400, 'INVALID_INVITATION')
    }

    let userId: string

    if (req.user) {
      // User is already authenticated
      userId = req.user.id
    } else {
      // Create new user account
      if (!name) {
        throw createError('Name is required for new users', 400, 'NAME_REQUIRED')
      }

      if (!email && !phone) {
        throw createError('Either email or phone is required', 400, 'CONTACT_REQUIRED')
      }

      // Check if user already exists
      let existingUser
      if (email) {
        existingUser = await UserModel.findByEmail(email)
      } else if (phone) {
        existingUser = await UserModel.findByPhone(phone)
      }

      if (existingUser) {
        throw createError(
          'An account with this email/phone already exists. Please sign in first.',
          409,
          'USER_EXISTS'
        )
      }

      // Create new user
      const newUser = await UserModel.createUser({
        name,
        email,
        phone,
      })

      userId = newUser.id

      // Create resource wallet for new user
      const { ResourceWalletService } = require('../services/resource-wallet-service')
      await ResourceWalletService.createWallet({
        userId: newUser.id,
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0
      })
    }

    // Import required models
    const { ProjectRoleModel } = require('../models/project-role')
    const { ResourceWalletService } = require('../services/resource-wallet-service')

    // Validate role assignment before consuming resources
    const roleValidation = await ProjectRoleModel.validateRoleAssignment(
      userId, 
      validInvitation.projectId, 
      validInvitation.role
    )
    
    if (!roleValidation.valid) {
      throw createError(roleValidation.error!, 400, 'ROLE_ASSIGNMENT_INVALID')
    }

    // Get the project to find who created the invitation (facilitator)
    const project = await ProjectModel.findById(validInvitation.projectId)
    if (!project) {
      throw createError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    // Consume the appropriate seat from the project creator's wallet
    const resourceType = validInvitation.role === 'facilitator' ? 'facilitator_seat' : 'storyteller_seat'
    
    const consumptionResult = await ResourceWalletService.consumeResources({
      userId: project.created_by,
      resourceType,
      amount: 1,
      projectId: validInvitation.projectId,
      description: `${validInvitation.role} invitation acceptance`
    })
    
    if (!consumptionResult.success) {
      throw createError(
        `Unable to accept invitation. The project creator doesn't have enough ${resourceType.replace('_', ' ')}s. ${consumptionResult.error}`,
        400,
        'INSUFFICIENT_RESOURCES'
      )
    }

    // Accept invitation
    await InvitationModel.acceptInvitation(token)

    // Assign role to user
    await ProjectRoleModel.assignRole(userId, validInvitation.projectId, validInvitation.role)

    // Get updated project details with roles
    const updatedProject = await ProjectModel.findById(validInvitation.projectId)
    const projectRoles = await ProjectRoleModel.getProjectRoles(validInvitation.projectId)

    const response: ApiResponse<any> = {
      data: {
        project: updatedProject,
        userId,
        role: validInvitation.role,
        projectRoles,
        message: req.user 
          ? `You have successfully joined the project as a ${validInvitation.role}!`
          : `Account created and joined project as a ${validInvitation.role} successfully!`,
      },
      message: 'Invitation accepted successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getProjectInvitationsValidation = [
    param('projectId').isUUID().withMessage('Valid project ID is required'),
  ]

  static getProjectInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params
    const userId = req.user!.id

    // Check if user has permission (must be facilitator of the project)
    const { ProjectRoleModel } = require('../models/project-role')
    const isFacilitator = await ProjectRoleModel.hasRole(userId, projectId, 'facilitator')
    if (!isFacilitator) {
      throw createError('Only project facilitators can view invitations', 403, 'ACCESS_DENIED')
    }

    const invitations = await InvitationModel.findByProject(projectId)
    const stats = await InvitationModel.getInvitationStats(projectId)

    const response: ApiResponse<any> = {
      data: {
        invitations,
        stats
      },
      message: 'Project invitations retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getInvitationStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params

    const stats = await InvitationModel.getInvitationStats(projectId)

    const response: ApiResponse<any> = {
      data: stats,
      message: 'Invitation stats retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static invalidateInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params

    await InvitationModel.invalidateProjectInvitations(projectId)

    const response: ApiResponse<any> = {
      data: { success: true },
      message: 'Project invitations invalidated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static resendInvitationValidation = [
    param('invitationId').isUUID().withMessage('Valid invitation ID is required'),
  ]

  static resendInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { invitationId } = req.params
    const userId = req.user!.id

    // Get invitation
    const invitation = await InvitationModel.findById(invitationId)
    if (!invitation) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND')
    }

    // Check if user has permission (must be facilitator of the project)
    const { ProjectRoleModel } = require('../models/project-role')
    const isFacilitator = await ProjectRoleModel.hasRole(userId, invitation.projectId, 'facilitator')
    if (!isFacilitator) {
      throw createError('Only project facilitators can resend invitations', 403, 'ACCESS_DENIED')
    }

    // Resend invitation
    const updatedInvitation = await InvitationModel.resendInvitation(invitationId)

    const response: ApiResponse<any> = {
      data: updatedInvitation,
      message: 'Invitation resent successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getInvitationAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.query
    const userId = req.user!.id

    // If projectId is provided, check if user has permission
    if (projectId) {
      const { ProjectRoleModel } = require('../models/project-role')
      const isFacilitator = await ProjectRoleModel.hasRole(userId, projectId as string, 'facilitator')
      if (!isFacilitator) {
        throw createError('Only project facilitators can view invitation analytics', 403, 'ACCESS_DENIED')
      }
    }

    const analytics = await InvitationModel.getInvitationAnalytics(projectId as string)

    const response: ApiResponse<any> = {
      data: analytics,
      message: 'Invitation analytics retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static cleanupExpiredInvitations = asyncHandler(async (req: Request, res: Response) => {
    const expiredCount = await InvitationModel.cleanupExpiredInvitations()

    const response: ApiResponse<any> = {
      data: { expiredCount },
      message: 'Expired invitations cleaned up successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
}