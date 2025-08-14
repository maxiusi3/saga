import { BaseService } from './base-service';
import { UserAcceptanceTestingService, TestingSession, UserTestingFeedback, BetaTester } from './user-acceptance-testing-service';
import { UserTestingReportGenerator } from './user-testing-report-generator';
import { EmailNotificationService } from './email-notification-service';
import { AnalyticsService } from './analytics-service';

export interface SessionProgress {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  startTime: Date;
  elapsedTime: number;
  completedSteps: string[];
  currentScenario: string;
  issues: SessionIssue[];
  notes: string[];
}

export interface SessionIssue {
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  resolved: boolean;
}

export interface SessionRecording {
  sessionId: string;
  screenRecordingUrl?: string;
  audioRecordingUrl?: string;
  interactionLogs: InteractionLog[];
  systemMetrics: SystemMetric[];
}

export interface InteractionLog {
  timestamp: Date;
  action: string;
  element: string;
  duration: number;
  successful: boolean;
}

export interface SystemMetric {
  timestamp: Date;
  metric: 'load_time' | 'error_rate' | 'memory_usage' | 'network_latency';
  value: number;
  context: string;
}

export class UserTestingSessionManager extends BaseService {
  private uatService: UserAcceptanceTestingService;
  private reportGenerator: UserTestingReportGenerator;
  private emailService: EmailNotificationService;
  private analyticsService: AnalyticsService;
  private activeSessions: Map<string, SessionProgress> = new Map();

  constructor() {
    super();
    this.uatService = new UserAcceptanceTestingService();
    this.reportGenerator = new UserTestingReportGenerator();
    this.emailService = new EmailNotificationService();
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Start a moderated testing session
   */
  async startSession(sessionId: string, moderatorId: string): Promise<SessionProgress> {
    try {
      // Get session details
      const session = await this.getSessionDetails(sessionId);
      
      // Initialize session progress
      const progress: SessionProgress = {
        sessionId,
        currentStep: 0,
        totalSteps: session.scenarios.length * 3, // Assuming 3 steps per scenario on average
        startTime: new Date(),
        elapsedTime: 0,
        completedSteps: [],
        currentScenario: session.scenarios[0] || '',
        issues: [],
        notes: []
      };

      // Store active session
      this.activeSessions.set(sessionId, progress);

      // Initialize session recording
      await this.initializeSessionRecording(sessionId);

      // Send session start notifications
      await this.notifySessionStart(session, moderatorId);

      // Track analytics
      await this.analyticsService.trackEvent('testing_session_started', {
        sessionId,
        moderatorId,
        scenarios: session.scenarios,
        participantId: session.betaTesterId
      });

      this.logger.info(`Testing session ${sessionId} started by moderator ${moderatorId}`);
      
      return progress;
    } catch (error) {
      this.logger.error(`Failed to start testing session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Update session progress
   */
  async updateSessionProgress(
    sessionId: string, 
    stepCompleted: string, 
    notes?: string,
    issues?: SessionIssue[]
  ): Promise<SessionProgress> {
    try {
      const progress = this.activeSessions.get(sessionId);
      if (!progress) {
        throw new Error(`Session ${sessionId} not found or not active`);
      }

      // Update progress
      progress.currentStep += 1;
      progress.completedSteps.push(stepCompleted);
      progress.elapsedTime = Date.now() - progress.startTime.getTime();

      if (notes) {
        progress.notes.push(`${new Date().toISOString()}: ${notes}`);
      }

      if (issues) {
        progress.issues.push(...issues);
      }

      // Update active session
      this.activeSessions.set(sessionId, progress);

      // Track step completion
      await this.analyticsService.trackEvent('testing_step_completed', {
        sessionId,
        step: stepCompleted,
        currentStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        elapsedTime: progress.elapsedTime
      });

      return progress;
    } catch (error) {
      this.logger.error(`Failed to update session progress for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Record session issue
   */
  async recordSessionIssue(
    sessionId: string,
    issue: Omit<SessionIssue, 'timestamp'>
  ): Promise<void> {
    try {
      const progress = this.activeSessions.get(sessionId);
      if (!progress) {
        throw new Error(`Session ${sessionId} not found or not active`);
      }

      const sessionIssue: SessionIssue = {
        ...issue,
        timestamp: new Date()
      };

      progress.issues.push(sessionIssue);
      this.activeSessions.set(sessionId, progress);

      // Track critical issues immediately
      if (issue.severity === 'critical') {
        await this.analyticsService.trackEvent('critical_issue_found', {
          sessionId,
          description: issue.description,
          location: issue.location
        });

        // Send immediate notification for critical issues
        await this.notifyCriticalIssue(sessionId, sessionIssue);
      }

      this.logger.warn(`Session issue recorded for ${sessionId}: ${issue.description}`);
    } catch (error) {
      this.logger.error(`Failed to record session issue for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Complete testing session
   */
  async completeSession(
    sessionId: string,
    feedback: Omit<UserTestingFeedback, 'id' | 'createdAt'>
  ): Promise<UserTestingFeedback> {
    try {
      const progress = this.activeSessions.get(sessionId);
      if (!progress) {
        throw new Error(`Session ${sessionId} not found or not active`);
      }

      // Calculate final metrics
      const totalTime = Date.now() - progress.startTime.getTime();
      const completionRate = progress.completedSteps.length / progress.totalSteps;

      // Collect feedback with session data
      const enhancedFeedback = {
        ...feedback,
        completionTime: Math.round(totalTime / 60000), // Convert to minutes
        usabilityIssues: [
          ...feedback.usabilityIssues,
          ...progress.issues.map(issue => ({
            severity: issue.severity,
            category: 'functionality' as const,
            description: issue.description,
            location: issue.location,
            reproductionSteps: ['Occurred during testing session']
          }))
        ]
      };

      // Store feedback
      const storedFeedback = await this.uatService.collectFeedback(enhancedFeedback);

      // Generate session report
      const sessionReport = await this.generateSessionReport(sessionId, progress, storedFeedback);

      // Clean up active session
      this.activeSessions.delete(sessionId);

      // Send completion notifications
      await this.notifySessionComplete(sessionId, storedFeedback, sessionReport);

      // Track session completion
      await this.analyticsService.trackEvent('testing_session_completed', {
        sessionId,
        totalTime,
        completionRate,
        issuesFound: progress.issues.length,
        rating: feedback.rating,
        wouldRecommend: feedback.wouldRecommend
      });

      this.logger.info(`Testing session ${sessionId} completed successfully`);
      
      return storedFeedback;
    } catch (error) {
      this.logger.error(`Failed to complete testing session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get active session progress
   */
  async getSessionProgress(sessionId: string): Promise<SessionProgress | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<SessionProgress[]> {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Cancel testing session
   */
  async cancelSession(sessionId: string, reason: string): Promise<void> {
    try {
      const progress = this.activeSessions.get(sessionId);
      if (!progress) {
        throw new Error(`Session ${sessionId} not found or not active`);
      }

      // Track cancellation
      await this.analyticsService.trackEvent('testing_session_cancelled', {
        sessionId,
        reason,
        elapsedTime: progress.elapsedTime,
        completedSteps: progress.completedSteps.length
      });

      // Clean up
      this.activeSessions.delete(sessionId);

      // Send cancellation notification
      await this.notifySessionCancelled(sessionId, reason);

      this.logger.info(`Testing session ${sessionId} cancelled: ${reason}`);
    } catch (error) {
      this.logger.error(`Failed to cancel testing session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Generate real-time session insights
   */
  async generateSessionInsights(sessionId: string): Promise<{
    currentPerformance: string;
    suggestedActions: string[];
    riskFactors: string[];
    timeEstimate: number;
  }> {
    try {
      const progress = this.activeSessions.get(sessionId);
      if (!progress) {
        throw new Error(`Session ${sessionId} not found or not active`);
      }

      const elapsedMinutes = progress.elapsedTime / 60000;
      const completionRate = progress.completedSteps.length / progress.totalSteps;
      const criticalIssues = progress.issues.filter(i => i.severity === 'critical').length;

      let currentPerformance = 'On track';
      const suggestedActions: string[] = [];
      const riskFactors: string[] = [];

      // Analyze performance
      if (completionRate < 0.3 && elapsedMinutes > 20) {
        currentPerformance = 'Behind schedule';
        suggestedActions.push('Consider simplifying remaining tasks');
        riskFactors.push('Low completion rate for time elapsed');
      }

      if (criticalIssues > 0) {
        currentPerformance = 'Issues detected';
        suggestedActions.push('Address critical issues immediately');
        riskFactors.push(`${criticalIssues} critical issues found`);
      }

      if (progress.issues.length > 5) {
        suggestedActions.push('Consider pausing to address usability concerns');
        riskFactors.push('High number of usability issues');
      }

      // Estimate remaining time
      const averageTimePerStep = elapsedMinutes / Math.max(progress.completedSteps.length, 1);
      const remainingSteps = progress.totalSteps - progress.completedSteps.length;
      const timeEstimate = Math.round(averageTimePerStep * remainingSteps);

      return {
        currentPerformance,
        suggestedActions,
        riskFactors,
        timeEstimate
      };
    } catch (error) {
      this.logger.error(`Failed to generate session insights for ${sessionId}:`, error);
      throw error;
    }
  }

  // Private helper methods
  private async getSessionDetails(sessionId: string): Promise<TestingSession> {
    // This would typically fetch from database
    // For now, return a mock session
    return {
      id: sessionId,
      betaTesterId: 'tester-123',
      moderatorId: 'moderator-123',
      scheduledAt: new Date(),
      duration: 60,
      scenarios: ['onboarding-facilitator', 'storyteller-onboarding'],
      status: 'scheduled',
      notes: ''
    };
  }

  private async initializeSessionRecording(sessionId: string): Promise<void> {
    // Initialize screen and audio recording
    // This would integrate with recording services
    this.logger.info(`Session recording initialized for ${sessionId}`);
  }

  private async notifySessionStart(session: TestingSession, moderatorId: string): Promise<void> {
    // Send notifications to relevant parties
    await this.emailService.sendEmail({
      to: 'testing-team@saga.com',
      subject: `User Testing Session Started - ${session.id}`,
      template: 'session-started',
      data: {
        sessionId: session.id,
        moderatorId,
        scheduledAt: session.scheduledAt
      }
    });
  }

  private async notifyCriticalIssue(sessionId: string, issue: SessionIssue): Promise<void> {
    // Send immediate notification for critical issues
    await this.emailService.sendEmail({
      to: 'dev-team@saga.com',
      subject: `CRITICAL: User Testing Issue - ${sessionId}`,
      template: 'critical-issue',
      data: {
        sessionId,
        issue: issue.description,
        location: issue.location,
        timestamp: issue.timestamp
      }
    });
  }

  private async notifySessionComplete(
    sessionId: string,
    feedback: UserTestingFeedback,
    report: any
  ): Promise<void> {
    // Send session completion notification
    await this.emailService.sendEmail({
      to: 'testing-team@saga.com',
      subject: `User Testing Session Completed - ${sessionId}`,
      template: 'session-completed',
      data: {
        sessionId,
        rating: feedback.rating,
        wouldRecommend: feedback.wouldRecommend,
        issuesFound: feedback.usabilityIssues.length
      }
    });
  }

  private async notifySessionCancelled(sessionId: string, reason: string): Promise<void> {
    // Send session cancellation notification
    await this.emailService.sendEmail({
      to: 'testing-team@saga.com',
      subject: `User Testing Session Cancelled - ${sessionId}`,
      template: 'session-cancelled',
      data: {
        sessionId,
        reason,
        timestamp: new Date()
      }
    });
  }

  private async generateSessionReport(
    sessionId: string,
    progress: SessionProgress,
    feedback: UserTestingFeedback
  ): Promise<any> {
    // Generate detailed session report
    return {
      sessionId,
      duration: progress.elapsedTime,
      completionRate: progress.completedSteps.length / progress.totalSteps,
      issuesFound: progress.issues.length,
      criticalIssues: progress.issues.filter(i => i.severity === 'critical').length,
      userRating: feedback.rating,
      wouldRecommend: feedback.wouldRecommend,
      keyInsights: progress.notes,
      recommendations: this.generateSessionRecommendations(progress, feedback)
    };
  }

  private generateSessionRecommendations(
    progress: SessionProgress,
    feedback: UserTestingFeedback
  ): string[] {
    const recommendations: string[] = [];

    if (progress.issues.some(i => i.severity === 'critical')) {
      recommendations.push('Address critical usability issues before launch');
    }

    if (feedback.rating < 3) {
      recommendations.push('Investigate user satisfaction concerns');
    }

    if (progress.completedSteps.length / progress.totalSteps < 0.7) {
      recommendations.push('Review task complexity and user guidance');
    }

    return recommendations;
  }
}