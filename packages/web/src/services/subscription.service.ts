import { api } from '@/lib/api'

export interface ProjectSubscription {
  id: string
  projectId: string
  status: 'active' | 'archived' | 'expired' | 'cancelled'
  mode: 'interactive' | 'archival'
  startDate: string
  endDate: string
  renewalDate?: string
  features: {
    canCreateStories: boolean
    canInviteMembers: boolean
    canReceivePrompts: boolean
    canExportData: boolean
    canViewContent: boolean
  }
  usage: {
    storiesCreated: number
    membersInvited: number
    totalDuration: number
    lastActivity?: string
  }
  limits: {
    maxStories?: number
    maxMembers?: number
    maxDuration?: number
  }
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  duration: number // in days
  features: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
    interactivePeriod: number // in days
    archivalAccess: boolean
    dataExport: boolean
    aiPrompts: boolean
    transcription: boolean
  }
  isActive: boolean
}

export interface SubscriptionStatus {
  hasActiveSubscription: boolean
  currentPlan?: SubscriptionPlan
  subscriptions: ProjectSubscription[]
  totalProjects: number
  activeProjects: number
  archivedProjects: number
  expiringProjects: ProjectSubscription[]
  renewalRequired: boolean
}

class SubscriptionService {
  /**
   * Get user's subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const response = await api.get('/subscriptions/status')
      return response.data
    } catch (error) {
      console.error('Failed to get subscription status:', error)
      throw new Error('Failed to get subscription status')
    }
  }

  /**
   * Get project subscription details
   */
  async getProjectSubscription(projectId: string): Promise<ProjectSubscription> {
    try {
      const response = await api.get(`/projects/${projectId}/subscription`)
      return response.data
    } catch (error) {
      console.error('Failed to get project subscription:', error)
      throw new Error('Failed to get project subscription')
    }
  }

  /**
   * Check if project is in archival mode
   */
  async isProjectArchived(projectId: string): Promise<boolean> {
    try {
      const subscription = await this.getProjectSubscription(projectId)
      return subscription.mode === 'archival' || subscription.status === 'archived'
    } catch (error) {
      console.error('Failed to check project archival status:', error)
      return false
    }
  }

  /**
   * Get available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await api.get('/subscriptions/plans')
      return response.data
    } catch (error) {
      console.error('Failed to get subscription plans:', error)
      throw new Error('Failed to get subscription plans')
    }
  }

  /**
   * Renew project subscription
   */
  async renewProjectSubscription(projectId: string, planId: string): Promise<{ success: boolean; subscriptionId: string }> {
    try {
      const response = await api.post(`/projects/${projectId}/subscription/renew`, { planId })
      return response.data
    } catch (error) {
      console.error('Failed to renew project subscription:', error)
      throw new Error('Failed to renew project subscription')
    }
  }

  /**
   * Cancel project subscription
   */
  async cancelProjectSubscription(projectId: string): Promise<void> {
    try {
      await api.post(`/projects/${projectId}/subscription/cancel`)
    } catch (error) {
      console.error('Failed to cancel project subscription:', error)
      throw new Error('Failed to cancel project subscription')
    }
  }

  /**
   * Check if user can perform action on project
   */
  async canPerformAction(projectId: string, action: 'create_story' | 'invite_member' | 'receive_prompts' | 'export_data' | 'view_content'): Promise<boolean> {
    try {
      const subscription = await this.getProjectSubscription(projectId)
      
      switch (action) {
        case 'create_story':
          return subscription.features.canCreateStories
        case 'invite_member':
          return subscription.features.canInviteMembers
        case 'receive_prompts':
          return subscription.features.canReceivePrompts
        case 'export_data':
          return subscription.features.canExportData
        case 'view_content':
          return subscription.features.canViewContent
        default:
          return false
      }
    } catch (error) {
      console.error('Failed to check action permission:', error)
      return false
    }
  }

  /**
   * Get projects expiring soon
   */
  async getExpiringProjects(daysAhead: number = 30): Promise<ProjectSubscription[]> {
    try {
      const response = await api.get(`/subscriptions/expiring?days=${daysAhead}`)
      return response.data
    } catch (error) {
      console.error('Failed to get expiring projects:', error)
      return []
    }
  }

  /**
   * Calculate days until expiration
   */
  getDaysUntilExpiration(endDate: string): number {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Format subscription status for display
   */
  formatSubscriptionStatus(subscription: ProjectSubscription): string {
    switch (subscription.status) {
      case 'active':
        return subscription.mode === 'interactive' ? '活跃中' : '归档模式'
      case 'archived':
        return '已归档'
      case 'expired':
        return '已过期'
      case 'cancelled':
        return '已取消'
      default:
        return '未知状态'
    }
  }

  /**
   * Get subscription color for UI
   */
  getSubscriptionStatusColor(subscription: ProjectSubscription): string {
    switch (subscription.status) {
      case 'active':
        return subscription.mode === 'interactive' ? 'text-green-600 bg-green-100' : 'text-blue-600 bg-blue-100'
      case 'archived':
        return 'text-gray-600 bg-gray-100'
      case 'expired':
        return 'text-red-600 bg-red-100'
      case 'cancelled':
        return 'text-orange-600 bg-orange-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  /**
   * Check if renewal is recommended
   */
  shouldRecommendRenewal(subscription: ProjectSubscription): boolean {
    if (subscription.status !== 'active') return false
    
    const daysUntilExpiration = this.getDaysUntilExpiration(subscription.endDate)
    return daysUntilExpiration <= 30 && subscription.mode === 'interactive'
  }

  /**
   * Get archival mode features
   */
  getArchivalModeFeatures(): string[] {
    return [
      '查看所有已收集的故事',
      '导出完整项目数据',
      '浏览故事时间线',
      '搜索故事内容',
      '分享只读链接'
    ]
  }

  /**
   * Get interactive mode features
   */
  getInteractiveModeFeatures(): string[] {
    return [
      '创建新故事',
      '邀请家庭成员',
      '接收AI引导提示',
      '实时互动和评论',
      '自动转录服务',
      '所有归档模式功能'
    ]
  }

  /**
   * Calculate subscription value
   */
  calculateSubscriptionValue(subscription: ProjectSubscription): {
    storiesPerDollar: number
    daysActive: number
    valueScore: number
  } {
    const daysActive = Math.floor((new Date().getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24))
    const storiesPerDollar = subscription.usage.storiesCreated / 129 // Assuming $129 price
    const valueScore = (subscription.usage.storiesCreated * 10) + (subscription.usage.membersInvited * 5) + (daysActive * 0.1)
    
    return {
      storiesPerDollar,
      daysActive,
      valueScore
    }
  }
}

export const subscriptionService = new SubscriptionService()
