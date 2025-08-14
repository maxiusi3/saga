import { BaseModel } from './base'
import { Invitation, CreateInvitationInput, AcceptInvitationInput } from '@saga/shared'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

export class InvitationModel extends BaseModel {
  protected static tableName = 'invitations'

  static async createInvitation(invitationData: CreateInvitationInput): Promise<Invitation> {
    const token = this.generateSecureToken()
    const expiresAt = invitationData.expiresAt || this.getDefaultExpiryDate()

    return this.create({
      id: uuidv4(),
      project_id: invitationData.projectId,
      role: invitationData.role,
      token,
      status: 'pending',
      expires_at: expiresAt,
    })
  }

  static async findByToken(token: string): Promise<Invitation | undefined> {
    return this.query().where('token', token).first()
  }

  static async findByProject(projectId: string): Promise<Invitation[]> {
    return this.query()
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
  }

  static async getValidInvitation(token: string): Promise<Invitation | null> {
    const invitation = await this.query()
      .where('token', token)
      .where('expires_at', '>', new Date())
      .where('status', 'pending')
      .first()

    return invitation || null
  }

  static async acceptInvitation(token: string): Promise<Invitation> {
    const invitation = await this.getValidInvitation(token)
    if (!invitation) {
      throw new Error('Invalid or expired invitation')
    }

    return this.update(invitation.id, { 
      status: 'accepted',
      used_at: new Date() 
    })
  }

  static async getInvitationWithProject(token: string) {
    return this.query()
      .where('invitations.token', token)
      .leftJoin('projects', 'invitations.project_id', 'projects.id')
      .leftJoin('users as facilitator', 'projects.facilitator_id', 'facilitator.id')
      .select(
        'invitations.*',
        'projects.name as project_name',
        'projects.status as project_status',
        'facilitator.name as facilitator_name',
        'facilitator.email as facilitator_email'
      )
      .first()
  }

  static async invalidateProjectInvitations(projectId: string): Promise<void> {
    await this.query()
      .where('project_id', projectId)
      .whereNull('used_at')
      .update({ used_at: new Date() })
  }

  static async cleanupExpiredInvitations(): Promise<number> {
    // Mark expired invitations as expired instead of deleting them
    const expiredCount = await this.query()
      .where('expires_at', '<', new Date())
      .where('status', 'pending')
      .update({ status: 'expired' })

    return expiredCount
  }

  static async markExpiredInvitations(): Promise<number> {
    return this.query()
      .where('expires_at', '<', new Date())
      .where('status', 'pending')
      .update({ status: 'expired' })
  }

  static async resendInvitation(invitationId: string): Promise<Invitation> {
    const invitation = await this.findById(invitationId)
    if (!invitation) {
      throw new Error('Invitation not found')
    }

    if (invitation.status === 'accepted') {
      throw new Error('Cannot resend an accepted invitation')
    }

    // Generate new token and extend expiry
    const newToken = this.generateSecureToken()
    const newExpiryDate = this.getDefaultExpiryDate()

    return this.update(invitationId, {
      token: newToken,
      status: 'pending',
      expires_at: newExpiryDate,
      used_at: null
    })
  }

  static async getActiveInvitations(projectId: string): Promise<Invitation[]> {
    return this.query()
      .where('project_id', projectId)
      .where('expires_at', '>', new Date())
      .where('status', 'pending')
      .orderBy('created_at', 'desc')
  }

  static async getInvitationsByRole(projectId: string, role: 'facilitator' | 'storyteller'): Promise<Invitation[]> {
    return this.query()
      .where('project_id', projectId)
      .where('role', role)
      .orderBy('created_at', 'desc')
  }

  static async getInvitationsByStatus(projectId: string, status: 'pending' | 'accepted' | 'expired'): Promise<Invitation[]> {
    return this.query()
      .where('project_id', projectId)
      .where('status', status)
      .orderBy('created_at', 'desc')
  }

  static async getInvitationAnalytics(projectId?: string) {
    const query = this.query()
    
    if (projectId) {
      query.where('project_id', projectId)
    }

    const analytics = await query
      .select(
        this.db.raw('COUNT(*) as total_invitations'),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_count', ['pending']),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as accepted_count', ['accepted']),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as expired_count', ['expired']),
        this.db.raw('COUNT(CASE WHEN role = ? THEN 1 END) as facilitator_count', ['facilitator']),
        this.db.raw('COUNT(CASE WHEN role = ? THEN 1 END) as storyteller_count', ['storyteller']),
        this.db.raw('AVG(CASE WHEN status = ? AND used_at IS NOT NULL THEN EXTRACT(EPOCH FROM (used_at - created_at))/3600 END) as avg_acceptance_time_hours', ['accepted'])
      )
      .first()

    const acceptanceRate = analytics.total_invitations > 0 
      ? (analytics.accepted_count / analytics.total_invitations) * 100 
      : 0

    const expiryRate = analytics.total_invitations > 0 
      ? (analytics.expired_count / analytics.total_invitations) * 100 
      : 0

    return {
      totalInvitations: parseInt(analytics.total_invitations) || 0,
      pendingInvitations: parseInt(analytics.pending_count) || 0,
      acceptedInvitations: parseInt(analytics.accepted_count) || 0,
      expiredInvitations: parseInt(analytics.expired_count) || 0,
      facilitatorInvitations: parseInt(analytics.facilitator_count) || 0,
      storytellerInvitations: parseInt(analytics.storyteller_count) || 0,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      expiryRate: Math.round(expiryRate * 100) / 100,
      averageAcceptanceTimeHours: analytics.avg_acceptance_time_hours ? 
        Math.round(parseFloat(analytics.avg_acceptance_time_hours) * 100) / 100 : null
    }
  }

  private static generateSecureToken(): string {
    // Generate a secure random token
    const randomBytes = crypto.randomBytes(32)
    const timestamp = Date.now().toString(36)
    const uuid = uuidv4().replace(/-/g, '')
    
    return `${timestamp}-${randomBytes.toString('hex')}-${uuid}`.substring(0, 64)
  }

  private static getDefaultExpiryDate(): Date {
    const expiryDate = new Date()
    expiryDate.setHours(expiryDate.getHours() + 72) // 72 hours from now
    return expiryDate
  }

  static async getInvitationStats(projectId: string) {
    const stats = await this.query()
      .where('project_id', projectId)
      .select(
        this.db.raw('COUNT(*) as total_invitations'),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_invitations', ['pending']),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as accepted_invitations', ['accepted']),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as expired_invitations', ['expired']),
        this.db.raw('COUNT(CASE WHEN role = ? THEN 1 END) as facilitator_invitations', ['facilitator']),
        this.db.raw('COUNT(CASE WHEN role = ? THEN 1 END) as storyteller_invitations', ['storyteller'])
      )
      .first()

    return {
      totalInvitations: parseInt(stats?.total_invitations) || 0,
      pendingInvitations: parseInt(stats?.pending_invitations) || 0,
      acceptedInvitations: parseInt(stats?.accepted_invitations) || 0,
      expiredInvitations: parseInt(stats?.expired_invitations) || 0,
      facilitatorInvitations: parseInt(stats?.facilitator_invitations) || 0,
      storytellerInvitations: parseInt(stats?.storyteller_invitations) || 0,
    }
  }
}