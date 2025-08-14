import { LoggingService } from './logging-service';
import { MetricsService } from './metrics-service';
import { db } from '../config/database';

export interface UserAnalytics {
  userId: string;
  sessionId: string;
  events: AnalyticsEvent[];
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface BusinessMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  storiesUploadedToday: number;
  averageSessionDuration: number;
  userRetentionRate: number;
  conversionRate: number;
}

export interface UsageMetrics {
  totalUsers: number;
  totalProjects: number;
  totalStories: number;
  totalChapters: number;
  totalExports: number;
  averageStoriesPerProject: number;
  averageProjectsPerUser: number;
}

class AnalyticsServiceClass {
  private events: AnalyticsEvent[] = [];
  private readonly MAX_EVENTS = 10000;
  private readonly BATCH_SIZE = 100;

  /**
   * Track user event
   */
  track(eventName: string, properties: Record<string, any> = {}, userId?: string, sessionId?: string): void {
    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      },
      timestamp: new Date(),
      userId,
      sessionId,
    };

    // Store event in memory
    this.events.push(event);

    // Limit memory usage
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Log event
    LoggingService.logUserAction(eventName, userId || 'anonymous', {
      sessionId,
      properties,
    });

    // Record metrics
    MetricsService.recordUserAction(eventName, userId || 'anonymous');

    // Send to external analytics if configured
    this.sendToExternalAnalytics(event);
  }

  /**
   * Track page view
   */
  trackPageView(page: string, properties: Record<string, any> = {}, userId?: string, sessionId?: string): void {
    this.track('page_view', {
      page,
      ...properties,
    }, userId, sessionId);
  }

  /**
   * Track user signup
   */
  trackSignup(userId: string, method: 'email' | 'google' | 'apple', properties: Record<string, any> = {}): void {
    this.track('user_signup', {
      method,
      ...properties,
    }, userId);
  }

  /**
   * Track user login
   */
  trackLogin(userId: string, method: 'email' | 'google' | 'apple', properties: Record<string, any> = {}): void {
    this.track('user_login', {
      method,
      ...properties,
    }, userId);
  }

  /**
   * Track story upload
   */
  trackStoryUpload(userId: string, projectId: string, storyId: string, properties: Record<string, any> = {}): void {
    this.track('story_uploaded', {
      projectId,
      storyId,
      ...properties,
    }, userId);

    MetricsService.recordCounter('business.stories_uploaded', 1, {
      userId: userId.substring(0, 8),
      projectId: projectId.substring(0, 8),
    });
  }

  /**
   * Track chapter generation
   */
  trackChapterGeneration(userId: string, projectId: string, chapterCount: number, duration: number): void {
    this.track('chapters_generated', {
      projectId,
      chapterCount,
      duration,
    }, userId);

    MetricsService.recordCounter('business.chapters_generated', 1, {
      userId: userId.substring(0, 8),
      projectId: projectId.substring(0, 8),
    });
  }

  /**
   * Track export request
   */
  trackExportRequest(userId: string, projectId: string, format: string, properties: Record<string, any> = {}): void {
    this.track('export_requested', {
      projectId,
      format,
      ...properties,
    }, userId);

    MetricsService.recordCounter('business.exports_requested', 1, {
      userId: userId.substring(0, 8),
      format,
    });
  }

  /**
   * Track payment
   */
  trackPayment(userId: string, amount: number, currency: string, planId: string, success: boolean): void {
    this.track('payment_processed', {
      amount,
      currency,
      planId,
      success,
    }, userId);

    MetricsService.recordPayment(amount, currency, success);
  }

  /**
   * Track user session
   */
  trackSession(userId: string, sessionId: string, duration: number, properties: Record<string, any> = {}): void {
    this.track('session_end', {
      sessionId,
      duration,
      ...properties,
    }, userId);

    MetricsService.recordTiming('user.session_duration', Date.now() - duration, {
      userId: userId.substring(0, 8),
    });
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Daily Active Users
      const dauResult = await db('users')
        .where('last_active_at', '>=', today)
        .count('id as count')
        .first();
      const dailyActiveUsers = parseInt(dauResult?.count as string) || 0;

      // Weekly Active Users
      const wauResult = await db('users')
        .where('last_active_at', '>=', weekAgo)
        .count('id as count')
        .first();
      const weeklyActiveUsers = parseInt(wauResult?.count as string) || 0;

      // Monthly Active Users
      const mauResult = await db('users')
        .where('last_active_at', '>=', monthAgo)
        .count('id as count')
        .first();
      const monthlyActiveUsers = parseInt(mauResult?.count as string) || 0;

      // Stories uploaded today
      const storiesResult = await db('stories')
        .where('created_at', '>=', today)
        .count('id as count')
        .first();
      const storiesUploadedToday = parseInt(storiesResult?.count as string) || 0;

      // Average session duration (from events)
      const sessionEvents = this.events.filter(e => e.name === 'session_end');
      const averageSessionDuration = sessionEvents.length > 0
        ? sessionEvents.reduce((sum, e) => sum + (e.properties.duration || 0), 0) / sessionEvents.length
        : 0;

      // User retention rate (users active in last 7 days who were also active 7-14 days ago)
      const retentionResult = await db.raw(`
        SELECT 
          COUNT(DISTINCT u1.id) as retained_users,
          COUNT(DISTINCT u2.id) as total_users
        FROM users u1
        LEFT JOIN users u2 ON u1.id = u2.id
        WHERE u1.last_active_at >= ? AND u1.last_active_at < ?
        AND u2.last_active_at >= ? AND u2.last_active_at < ?
      `, [weekAgo, now, new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000), weekAgo]);

      const retainedUsers = parseInt(retentionResult.rows[0]?.retained_users) || 0;
      const totalRetentionUsers = parseInt(retentionResult.rows[0]?.total_users) || 1;
      const userRetentionRate = (retainedUsers / totalRetentionUsers) * 100;

      // Conversion rate (users who made a payment / total users)
      const paidUsersResult = await db('subscriptions')
        .countDistinct('user_id as count')
        .first();
      const paidUsers = parseInt(paidUsersResult?.count as string) || 0;

      const totalUsersResult = await db('users')
        .count('id as count')
        .first();
      const totalUsers = parseInt(totalUsersResult?.count as string) || 1;
      const conversionRate = (paidUsers / totalUsers) * 100;

      return {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        storiesUploadedToday,
        averageSessionDuration,
        userRetentionRate,
        conversionRate,
      };
    } catch (error) {
      LoggingService.error('Failed to get business metrics', { error: error as Error });
      
      return {
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        storiesUploadedToday: 0,
        averageSessionDuration: 0,
        userRetentionRate: 0,
        conversionRate: 0,
      };
    }
  }

  /**
   * Get usage metrics
   */
  async getUsageMetrics(): Promise<UsageMetrics> {
    try {
      const [
        usersResult,
        projectsResult,
        storiesResult,
        chaptersResult,
        exportsResult,
      ] = await Promise.all([
        db('users').count('id as count').first(),
        db('projects').count('id as count').first(),
        db('stories').count('id as count').first(),
        db('chapter_summaries').count('id as count').first(),
        db('export_requests').count('id as count').first(),
      ]);

      const totalUsers = parseInt(usersResult?.count as string) || 0;
      const totalProjects = parseInt(projectsResult?.count as string) || 0;
      const totalStories = parseInt(storiesResult?.count as string) || 0;
      const totalChapters = parseInt(chaptersResult?.count as string) || 0;
      const totalExports = parseInt(exportsResult?.count as string) || 0;

      const averageStoriesPerProject = totalProjects > 0 ? totalStories / totalProjects : 0;
      const averageProjectsPerUser = totalUsers > 0 ? totalProjects / totalUsers : 0;

      return {
        totalUsers,
        totalProjects,
        totalStories,
        totalChapters,
        totalExports,
        averageStoriesPerProject,
        averageProjectsPerUser,
      };
    } catch (error) {
      LoggingService.error('Failed to get usage metrics', { error: error as Error });
      
      return {
        totalUsers: 0,
        totalProjects: 0,
        totalStories: 0,
        totalChapters: 0,
        totalExports: 0,
        averageStoriesPerProject: 0,
        averageProjectsPerUser: 0,
      };
    }
  }

  /**
   * Get user funnel metrics
   */
  async getFunnelMetrics(): Promise<Record<string, number>> {
    const signupEvents = this.events.filter(e => e.name === 'user_signup');
    const loginEvents = this.events.filter(e => e.name === 'user_login');
    const storyUploadEvents = this.events.filter(e => e.name === 'story_uploaded');
    const paymentEvents = this.events.filter(e => e.name === 'payment_processed' && e.properties.success);

    return {
      signups: signupEvents.length,
      logins: loginEvents.length,
      storyUploads: storyUploadEvents.length,
      payments: paymentEvents.length,
      signupToLoginRate: signupEvents.length > 0 ? (loginEvents.length / signupEvents.length) * 100 : 0,
      loginToUploadRate: loginEvents.length > 0 ? (storyUploadEvents.length / loginEvents.length) * 100 : 0,
      uploadToPaymentRate: storyUploadEvents.length > 0 ? (paymentEvents.length / storyUploadEvents.length) * 100 : 0,
    };
  }

  /**
   * Get events for a specific user
   */
  getUserEvents(userId: string, limit: number = 100): AnalyticsEvent[] {
    return this.events
      .filter(e => e.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get events by name
   */
  getEventsByName(eventName: string, limit: number = 100): AnalyticsEvent[] {
    return this.events
      .filter(e => e.name === eventName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Send events to external analytics service
   */
  private sendToExternalAnalytics(event: AnalyticsEvent): void {
    // Skip in development or if no external service configured
    if (process.env.NODE_ENV === 'development' || !process.env.ANALYTICS_API_KEY) {
      return;
    }

    // Example: Send to external analytics service
    // This could be Google Analytics, Mixpanel, Amplitude, etc.
    try {
      // Implementation would depend on the chosen analytics service
      // For now, just log that we would send it
      LoggingService.debug('Would send analytics event to external service', {
        eventName: event.name,
        userId: event.userId,
        properties: event.properties,
      });
    } catch (error) {
      LoggingService.error('Failed to send analytics event to external service', {
        error: error as Error,
        eventName: event.name,
      });
    }
  }

  /**
   * Batch process events (for performance)
   */
  private async batchProcessEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const batch = this.events.splice(0, this.BATCH_SIZE);
    
    try {
      // Process batch of events
      for (const event of batch) {
        this.sendToExternalAnalytics(event);
      }
    } catch (error) {
      LoggingService.error('Failed to batch process analytics events', {
        error: error as Error,
        batchSize: batch.length,
      });
    }
  }

  /**
   * Start periodic batch processing
   */
  startBatchProcessing(): void {
    setInterval(() => {
      this.batchProcessEvents();
    }, 60000); // Process every minute
  }

  /**
   * Export analytics data
   */
  exportAnalytics(startDate: Date, endDate: Date): AnalyticsEvent[] {
    return this.events.filter(e => 
      e.timestamp >= startDate && e.timestamp <= endDate
    );
  }

  /**
   * Clear old events (for memory management)
   */
  clearOldEvents(olderThan: Date): void {
    this.events = this.events.filter(e => e.timestamp >= olderThan);
  }

  /**
   * Track archival transition
   */
  trackArchivalTransition(userId: string, projectId: string, projectName: string, reason: 'expired' | 'manual'): void {
    this.track('project_archived', {
      projectId,
      projectName,
      reason,
    }, userId);

    MetricsService.recordCounter('business.projects_archived', 1, {
      userId: userId.substring(0, 8),
      reason,
    });
  }

  /**
   * Track subscription renewal
   */
  trackSubscriptionRenewal(userId: string, projectId: string, projectName: string, renewalMethod: 'auto' | 'manual'): void {
    this.track('subscription_renewed', {
      projectId,
      projectName,
      renewalMethod,
    }, userId);

    MetricsService.recordCounter('business.subscriptions_renewed', 1, {
      userId: userId.substring(0, 8),
      renewalMethod,
    });
  }

  /**
   * Track expiry warning sent
   */
  trackExpiryWarningSent(userId: string, projectId: string, daysUntilExpiry: number, warningType: 'email' | 'push' | 'both'): void {
    this.track('expiry_warning_sent', {
      projectId,
      daysUntilExpiry,
      warningType,
    }, userId);

    MetricsService.recordCounter('business.expiry_warnings_sent', 1, {
      daysUntilExpiry: daysUntilExpiry.toString(),
      warningType,
    });
  }

  /**
   * Get archival analytics metrics
   */
  async getArchivalMetrics(): Promise<{
    totalArchivedProjects: number;
    projectsArchivedThisMonth: number;
    averageDaysToArchival: number;
    renewalRate: number;
    expiryWarningEffectiveness: number;
    archivalReasons: Record<string, number>;
    renewalMethods: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      // Total archived projects
      const archivedResult = await db('projects')
        .where('status', 'archived')
        .count('id as count')
        .first();
      const totalArchivedProjects = parseInt(archivedResult?.count as string) || 0;

      // Projects archived this month
      const monthlyArchivedResult = await db('projects')
        .where('status', 'archived')
        .where('updated_at', '>=', monthAgo)
        .count('id as count')
        .first();
      const projectsArchivedThisMonth = parseInt(monthlyArchivedResult?.count as string) || 0;

      // Average days from creation to archival
      const archivalDaysResult = await db.raw(`
        SELECT AVG(EXTRACT(DAY FROM (updated_at - created_at))) as avg_days
        FROM projects 
        WHERE status = 'archived'
      `);
      const averageDaysToArchival = parseFloat(archivalDaysResult.rows[0]?.avg_days) || 365;

      // Renewal rate (renewed subscriptions / expired subscriptions)
      const renewedCount = this.events.filter(e => e.name === 'subscription_renewed').length;
      const archivedCount = this.events.filter(e => e.name === 'project_archived').length;
      const renewalRate = archivedCount > 0 ? (renewedCount / (renewedCount + archivedCount)) * 100 : 0;

      // Expiry warning effectiveness (renewals after warnings / total warnings)
      const warningsCount = this.events.filter(e => e.name === 'expiry_warning_sent').length;
      const expiryWarningEffectiveness = warningsCount > 0 ? (renewedCount / warningsCount) * 100 : 0;

      // Archival reasons breakdown
      const archivalEvents = this.events.filter(e => e.name === 'project_archived');
      const archivalReasons = archivalEvents.reduce((acc, event) => {
        const reason = event.properties.reason || 'unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Renewal methods breakdown
      const renewalEvents = this.events.filter(e => e.name === 'subscription_renewed');
      const renewalMethods = renewalEvents.reduce((acc, event) => {
        const method = event.properties.renewalMethod || 'unknown';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalArchivedProjects,
        projectsArchivedThisMonth,
        averageDaysToArchival,
        renewalRate,
        expiryWarningEffectiveness,
        archivalReasons,
        renewalMethods,
      };
    } catch (error) {
      LoggingService.error('Failed to get archival metrics', { error: error as Error });
      
      return {
        totalArchivedProjects: 0,
        projectsArchivedThisMonth: 0,
        averageDaysToArchival: 365,
        renewalRate: 0,
        expiryWarningEffectiveness: 0,
        archivalReasons: {},
        renewalMethods: {},
      };
    }
  }

  /**
   * Get subscription health metrics
   */
  async getSubscriptionHealthMetrics(): Promise<{
    activeSubscriptions: number;
    expiringIn7Days: number;
    expiringIn30Days: number;
    expiredButNotArchived: number;
    averageSubscriptionLength: number;
    churnRate: number;
  }> {
    try {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Active subscriptions
      const activeResult = await db('subscriptions')
        .where('status', 'active')
        .where('current_period_end', '>', now)
        .count('id as count')
        .first();
      const activeSubscriptions = parseInt(activeResult?.count as string) || 0;

      // Expiring in 7 days
      const expiring7Result = await db('subscriptions')
        .where('status', 'active')
        .where('current_period_end', '>', now)
        .where('current_period_end', '<=', in7Days)
        .count('id as count')
        .first();
      const expiringIn7Days = parseInt(expiring7Result?.count as string) || 0;

      // Expiring in 30 days
      const expiring30Result = await db('subscriptions')
        .where('status', 'active')
        .where('current_period_end', '>', now)
        .where('current_period_end', '<=', in30Days)
        .count('id as count')
        .first();
      const expiringIn30Days = parseInt(expiring30Result?.count as string) || 0;

      // Expired but not archived
      const expiredResult = await db('subscriptions')
        .join('projects', 'subscriptions.project_id', 'projects.id')
        .where('subscriptions.current_period_end', '<', now)
        .where('projects.status', 'active')
        .count('subscriptions.id as count')
        .first();
      const expiredButNotArchived = parseInt(expiredResult?.count as string) || 0;

      // Average subscription length
      const avgLengthResult = await db.raw(`
        SELECT AVG(EXTRACT(DAY FROM (current_period_end - created_at))) as avg_days
        FROM subscriptions 
        WHERE status = 'active'
      `);
      const averageSubscriptionLength = parseFloat(avgLengthResult.rows[0]?.avg_days) || 365;

      // Churn rate (cancelled/expired subscriptions in last 30 days / total subscriptions)
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const churnedResult = await db('subscriptions')
        .where('status', 'cancelled')
        .orWhere('current_period_end', '<', now)
        .where('updated_at', '>=', monthAgo)
        .count('id as count')
        .first();
      const churned = parseInt(churnedResult?.count as string) || 0;

      const totalResult = await db('subscriptions')
        .count('id as count')
        .first();
      const total = parseInt(totalResult?.count as string) || 1;

      const churnRate = (churned / total) * 100;

      return {
        activeSubscriptions,
        expiringIn7Days,
        expiringIn30Days,
        expiredButNotArchived,
        averageSubscriptionLength,
        churnRate,
      };
    } catch (error) {
      LoggingService.error('Failed to get subscription health metrics', { error: error as Error });
      
      return {
        activeSubscriptions: 0,
        expiringIn7Days: 0,
        expiringIn30Days: 0,
        expiredButNotArchived: 0,
        averageSubscriptionLength: 365,
        churnRate: 0,
      };
    }
  }

  /**
   * Generate archival report
   */
  async generateArchivalReport(startDate: Date, endDate: Date): Promise<{
    period: { start: Date; end: Date };
    summary: {
      projectsArchived: number;
      subscriptionsRenewed: number;
      warningsSent: number;
      renewalRate: number;
    };
    trends: {
      dailyArchivalCounts: Array<{ date: string; count: number }>;
      dailyRenewalCounts: Array<{ date: string; count: number }>;
    };
    insights: string[];
  }> {
    try {
      // Filter events for the specified period
      const periodEvents = this.events.filter(e => 
        e.timestamp >= startDate && e.timestamp <= endDate
      );

      const archivedEvents = periodEvents.filter(e => e.name === 'project_archived');
      const renewedEvents = periodEvents.filter(e => e.name === 'subscription_renewed');
      const warningEvents = periodEvents.filter(e => e.name === 'expiry_warning_sent');

      const projectsArchived = archivedEvents.length;
      const subscriptionsRenewed = renewedEvents.length;
      const warningsSent = warningEvents.length;
      const renewalRate = (projectsArchived + subscriptionsRenewed) > 0 
        ? (subscriptionsRenewed / (projectsArchived + subscriptionsRenewed)) * 100 
        : 0;

      // Generate daily trends
      const dailyArchivalCounts = this.generateDailyCounts(archivedEvents, startDate, endDate);
      const dailyRenewalCounts = this.generateDailyCounts(renewedEvents, startDate, endDate);

      // Generate insights
      const insights = this.generateArchivalInsights({
        projectsArchived,
        subscriptionsRenewed,
        warningsSent,
        renewalRate,
        dailyArchivalCounts,
        dailyRenewalCounts,
      });

      return {
        period: { start: startDate, end: endDate },
        summary: {
          projectsArchived,
          subscriptionsRenewed,
          warningsSent,
          renewalRate,
        },
        trends: {
          dailyArchivalCounts,
          dailyRenewalCounts,
        },
        insights,
      };
    } catch (error) {
      LoggingService.error('Failed to generate archival report', { error: error as Error });
      throw error;
    }
  }

  /**
   * Generate daily counts for trend analysis
   */
  private generateDailyCounts(events: AnalyticsEvent[], startDate: Date, endDate: Date): Array<{ date: string; count: number }> {
    const dailyCounts: Record<string, number> = {};
    
    // Initialize all dates with 0
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyCounts[dateStr] = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count events by date
    events.forEach(event => {
      const dateStr = event.timestamp.toISOString().split('T')[0];
      if (dailyCounts.hasOwnProperty(dateStr)) {
        dailyCounts[dateStr]++;
      }
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generate insights from archival data
   */
  private generateArchivalInsights(data: {
    projectsArchived: number;
    subscriptionsRenewed: number;
    warningsSent: number;
    renewalRate: number;
    dailyArchivalCounts: Array<{ date: string; count: number }>;
    dailyRenewalCounts: Array<{ date: string; count: number }>;
  }): string[] {
    const insights: string[] = [];

    // Renewal rate insights
    if (data.renewalRate > 80) {
      insights.push('Excellent renewal rate! Most users are choosing to continue their subscriptions.');
    } else if (data.renewalRate > 60) {
      insights.push('Good renewal rate, but there\'s room for improvement in retention strategies.');
    } else if (data.renewalRate > 40) {
      insights.push('Moderate renewal rate. Consider improving expiry warning messaging or offering incentives.');
    } else {
      insights.push('Low renewal rate. Review pricing, value proposition, and user experience.');
    }

    // Warning effectiveness
    const warningEffectiveness = data.warningsSent > 0 ? (data.subscriptionsRenewed / data.warningsSent) * 100 : 0;
    if (warningEffectiveness > 50) {
      insights.push('Expiry warnings are highly effective at driving renewals.');
    } else if (warningEffectiveness > 25) {
      insights.push('Expiry warnings have moderate effectiveness. Consider A/B testing different messaging.');
    } else {
      insights.push('Expiry warnings may need improvement. Review timing, content, and delivery methods.');
    }

    // Trend analysis
    const totalArchived = data.dailyArchivalCounts.reduce((sum, day) => sum + day.count, 0);
    const totalRenewed = data.dailyRenewalCounts.reduce((sum, day) => sum + day.count, 0);
    
    if (totalRenewed > totalArchived) {
      insights.push('Positive trend: More subscriptions are being renewed than projects archived.');
    } else {
      insights.push('Concerning trend: More projects are being archived than subscriptions renewed.');
    }

    // Volume insights
    if (data.projectsArchived === 0) {
      insights.push('No projects were archived in this period - excellent retention!');
    } else if (data.projectsArchived < 5) {
      insights.push('Low archival volume indicates good user retention.');
    } else {
      insights.push('Consider implementing additional retention strategies to reduce archival rates.');
    }

    return insights;
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): {
    totalEvents: number;
    uniqueUsers: number;
    topEvents: Array<{ name: string; count: number }>;
    recentActivity: AnalyticsEvent[];
  } {
    const uniqueUsers = new Set(this.events.filter(e => e.userId).map(e => e.userId)).size;
    
    // Count events by name
    const eventCounts = this.events.reduce((acc, event) => {
      acc[event.name] = (acc[event.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const recentActivity = this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      totalEvents: this.events.length,
      uniqueUsers,
      topEvents,
      recentActivity,
    };
  }
}

export const AnalyticsService = new AnalyticsServiceClass();

// Start batch processing (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  AnalyticsService.startBatchProcessing();
}