/**
 * Project Analytics Service
 * Tracks project creation, usage, and engagement metrics
 */

import { BaseModel } from '../models/base'
import type { 
  ProjectAnalyticsEvent,
  ProjectCreationMetrics,
  ProjectEngagementMetrics,
  ProjectAnalyticsQuery
} from '@saga/shared/types'

export class ProjectAnalyticsService {
  
  /**
   * Track project creation event
   */
  static async trackProjectCreation(data: {
    userId: string
    projectId: string
    projectName: string
    hasDescription: boolean
    creationSource: 'web' | 'mobile' | 'api'
    userAgent?: string
    referrer?: string
    walletBalanceBefore: {
      projectVouchers: number
      facilitatorSeats: number
      storytellerSeats: number
    }
    walletBalanceAfter: {
      projectVouchers: number
      facilitatorSeats: number
      storytellerSeats: number
    }
  }): Promise<void> {
    try {
      await BaseModel.db('project_analytics_events').insert({
        event_type: 'project_created',
        user_id: data.userId,
        project_id: data.projectId,
        event_data: JSON.stringify({
          projectName: data.projectName,
          hasDescription: data.hasDescription,
          creationSource: data.creationSource,
          userAgent: data.userAgent,
          referrer: data.referrer,
          walletBalanceBefore: data.walletBalanceBefore,
          walletBalanceAfter: data.walletBalanceAfter,
          vouchersConsumed: data.walletBalanceBefore.projectVouchers - data.walletBalanceAfter.projectVouchers
        }),
        created_at: new Date()
      })

      // Also track in general analytics
      await this.trackEvent({
        eventType: 'project_creation',
        userId: data.userId,
        projectId: data.projectId,
        properties: {
          source: data.creationSource,
          hasDescription: data.hasDescription,
          vouchersRemaining: data.walletBalanceAfter.projectVouchers
        }
      })
    } catch (error) {
      console.error('Error tracking project creation:', error)
      // Don't throw error to avoid breaking project creation flow
    }
  }

  /**
   * Track project engagement events
   */
  static async trackProjectEngagement(data: {
    userId: string
    projectId: string
    eventType: 'project_viewed' | 'story_added' | 'member_invited' | 'export_requested'
    properties?: Record<string, any>
  }): Promise<void> {
    try {
      await this.trackEvent({
        eventType: data.eventType,
        userId: data.userId,
        projectId: data.projectId,
        properties: data.properties || {}
      })
    } catch (error) {
      console.error('Error tracking project engagement:', error)
    }
  }

  /**
   * Get project creation metrics
   */
  static async getProjectCreationMetrics(query: ProjectAnalyticsQuery): Promise<ProjectCreationMetrics> {
    try {
      const { startDate, endDate, userId } = query
      
      let baseQuery = BaseModel.db('project_analytics_events')
        .where('event_type', 'project_created')
      
      if (startDate) {
        baseQuery = baseQuery.where('created_at', '>=', startDate)
      }
      
      if (endDate) {
        baseQuery = baseQuery.where('created_at', '<=', endDate)
      }
      
      if (userId) {
        baseQuery = baseQuery.where('user_id', userId)
      }

      // Total projects created
      const totalProjects = await baseQuery.clone().count('* as count').first()
      
      // Projects by source
      const projectsBySource = await baseQuery.clone()
        .select(BaseModel.db.raw("JSON_EXTRACT(event_data, '$.creationSource') as source"))
        .select(BaseModel.db.raw('COUNT(*) as count'))
        .groupBy('source')
      
      // Projects with descriptions
      const projectsWithDescription = await baseQuery.clone()
        .whereRaw("JSON_EXTRACT(event_data, '$.hasDescription') = true")
        .count('* as count')
        .first()
      
      // Average vouchers consumed
      const voucherStats = await baseQuery.clone()
        .select(
          BaseModel.db.raw("AVG(JSON_EXTRACT(event_data, '$.vouchersConsumed')) as avgConsumed"),
          BaseModel.db.raw("SUM(JSON_EXTRACT(event_data, '$.vouchersConsumed')) as totalConsumed")
        )
        .first()

      // Daily creation trend
      const dailyTrend = await baseQuery.clone()
        .select(
          BaseModel.db.raw('DATE(created_at) as date'),
          BaseModel.db.raw('COUNT(*) as count')
        )
        .groupBy('date')
        .orderBy('date', 'asc')

      return {
        totalProjects: parseInt(totalProjects?.count as string) || 0,
        projectsBySource: projectsBySource.map(item => ({
          source: item.source,
          count: parseInt(item.count as string)
        })),
        projectsWithDescription: parseInt(projectsWithDescription?.count as string) || 0,
        averageVouchersConsumed: parseFloat(voucherStats?.avgConsumed) || 0,
        totalVouchersConsumed: parseInt(voucherStats?.totalConsumed) || 0,
        dailyTrend: dailyTrend.map(item => ({
          date: item.date,
          count: parseInt(item.count as string)
        }))
      }
    } catch (error) {
      console.error('Error getting project creation metrics:', error)
      throw new Error('Failed to get project creation metrics')
    }
  }

  /**
   * Get project engagement metrics
   */
  static async getProjectEngagementMetrics(projectId: string): Promise<ProjectEngagementMetrics> {
    try {
      const baseQuery = BaseModel.db('analytics_events')
        .where('project_id', projectId)

      // Total events
      const totalEvents = await baseQuery.clone().count('* as count').first()
      
      // Events by type
      const eventsByType = await baseQuery.clone()
        .select('event_type')
        .select(BaseModel.db.raw('COUNT(*) as count'))
        .groupBy('event_type')
      
      // Unique users
      const uniqueUsers = await baseQuery.clone()
        .countDistinct('user_id as count')
        .first()
      
      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const recentActivity = await baseQuery.clone()
        .where('created_at', '>=', thirtyDaysAgo)
        .select(
          BaseModel.db.raw('DATE(created_at) as date'),
          BaseModel.db.raw('COUNT(*) as count')
        )
        .groupBy('date')
        .orderBy('date', 'asc')

      return {
        totalEvents: parseInt(totalEvents?.count as string) || 0,
        eventsByType: eventsByType.map(item => ({
          eventType: item.event_type,
          count: parseInt(item.count as string)
        })),
        uniqueUsers: parseInt(uniqueUsers?.count as string) || 0,
        recentActivity: recentActivity.map(item => ({
          date: item.date,
          count: parseInt(item.count as string)
        }))
      }
    } catch (error) {
      console.error('Error getting project engagement metrics:', error)
      throw new Error('Failed to get project engagement metrics')
    }
  }

  /**
   * Track general analytics event
   */
  private static async trackEvent(data: {
    eventType: string
    userId: string
    projectId?: string
    properties: Record<string, any>
  }): Promise<void> {
    try {
      await BaseModel.db('analytics_events').insert({
        event_type: data.eventType,
        user_id: data.userId,
        project_id: data.projectId,
        properties: JSON.stringify(data.properties),
        created_at: new Date()
      })
    } catch (error) {
      console.error('Error tracking analytics event:', error)
    }
  }

  /**
   * Get user project creation stats
   */
  static async getUserProjectStats(userId: string): Promise<{
    totalProjectsCreated: number
    totalVouchersUsed: number
    averageProjectsPerMonth: number
    firstProjectDate: Date | null
    lastProjectDate: Date | null
  }> {
    try {
      const stats = await BaseModel.db('project_analytics_events')
        .where('event_type', 'project_created')
        .where('user_id', userId)
        .select(
          BaseModel.db.raw('COUNT(*) as totalProjects'),
          BaseModel.db.raw("SUM(JSON_EXTRACT(event_data, '$.vouchersConsumed')) as totalVouchers"),
          BaseModel.db.raw('MIN(created_at) as firstProject'),
          BaseModel.db.raw('MAX(created_at) as lastProject')
        )
        .first()

      const totalProjects = parseInt(stats?.totalProjects) || 0
      const totalVouchers = parseInt(stats?.totalVouchers) || 0
      const firstProject = stats?.firstProject ? new Date(stats.firstProject) : null
      const lastProject = stats?.lastProject ? new Date(stats.lastProject) : null

      // Calculate average projects per month
      let averagePerMonth = 0
      if (firstProject && lastProject && totalProjects > 0) {
        const monthsDiff = Math.max(1, 
          (lastProject.getTime() - firstProject.getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
        averagePerMonth = totalProjects / monthsDiff
      }

      return {
        totalProjectsCreated: totalProjects,
        totalVouchersUsed: totalVouchers,
        averageProjectsPerMonth: Math.round(averagePerMonth * 100) / 100,
        firstProjectDate: firstProject,
        lastProjectDate: lastProject
      }
    } catch (error) {
      console.error('Error getting user project stats:', error)
      throw new Error('Failed to get user project statistics')
    }
  }

  /**
   * Get project success metrics
   */
  static async getProjectSuccessMetrics(query: ProjectAnalyticsQuery): Promise<{
    projectsWithStories: number
    projectsWithMultipleMembers: number
    averageStoriesPerProject: number
    averageMembersPerProject: number
    projectCompletionRate: number
  }> {
    try {
      const { startDate, endDate } = query
      
      let projectQuery = BaseModel.db('projects')
      
      if (startDate) {
        projectQuery = projectQuery.where('created_at', '>=', startDate)
      }
      
      if (endDate) {
        projectQuery = projectQuery.where('created_at', '<=', endDate)
      }

      // Projects with stories
      const projectsWithStories = await projectQuery.clone()
        .join('stories', 'projects.id', 'stories.project_id')
        .countDistinct('projects.id as count')
        .first()

      // Projects with multiple members
      const projectsWithMultipleMembers = await projectQuery.clone()
        .join('project_roles', 'projects.id', 'project_roles.project_id')
        .groupBy('projects.id')
        .having(BaseModel.db.raw('COUNT(project_roles.user_id) > 1'))
        .select('projects.id')
        .then(results => results.length)

      // Average stories per project
      const storyStats = await projectQuery.clone()
        .leftJoin('stories', 'projects.id', 'stories.project_id')
        .select(BaseModel.db.raw('AVG(story_count.count) as avgStories'))
        .from(
          projectQuery.clone()
            .leftJoin('stories', 'projects.id', 'stories.project_id')
            .select('projects.id')
            .select(BaseModel.db.raw('COUNT(stories.id) as count'))
            .groupBy('projects.id')
            .as('story_count')
        )
        .first()

      // Average members per project
      const memberStats = await projectQuery.clone()
        .leftJoin('project_roles', 'projects.id', 'project_roles.project_id')
        .select(BaseModel.db.raw('AVG(member_count.count) as avgMembers'))
        .from(
          projectQuery.clone()
            .leftJoin('project_roles', 'projects.id', 'project_roles.project_id')
            .select('projects.id')
            .select(BaseModel.db.raw('COUNT(project_roles.user_id) as count'))
            .groupBy('projects.id')
            .as('member_count')
        )
        .first()

      // Total projects for completion rate calculation
      const totalProjects = await projectQuery.clone().count('* as count').first()

      return {
        projectsWithStories: parseInt(projectsWithStories?.count as string) || 0,
        projectsWithMultipleMembers,
        averageStoriesPerProject: parseFloat(storyStats?.avgStories) || 0,
        averageMembersPerProject: parseFloat(memberStats?.avgMembers) || 0,
        projectCompletionRate: totalProjects ? 
          (parseInt(projectsWithStories?.count as string) || 0) / parseInt(totalProjects.count as string) * 100 : 0
      }
    } catch (error) {
      console.error('Error getting project success metrics:', error)
      throw new Error('Failed to get project success metrics')
    }
  }
}