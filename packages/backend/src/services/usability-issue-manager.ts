import { BaseService } from './base-service';
import { UsabilityIssue, UserTestingFeedback } from './user-acceptance-testing-service';
import { AnalyticsService } from './analytics-service';
import { EmailNotificationService } from './email-notification-service';

export interface EnhancedUsabilityIssue extends UsabilityIssue {
  id: string;
  frequency: number;
  affectedUsers: string[];
  firstReported: Date;
  lastReported: Date;
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  assignedTo?: string;
  priority: number; // 1-10 scale
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  technicalComplexity: 'low' | 'medium' | 'high';
  estimatedEffort: string;
  relatedIssues: string[];
  resolutionNotes?: string;
  testingNotes: string[];
}

export interface IssueResolutionPlan {
  issueId: string;
  plannedResolution: string;
  estimatedTimeline: string;
  requiredResources: string[];
  dependencies: string[];
  successCriteria: string[];
  riskFactors: string[];
}

export interface UsabilityMetrics {
  totalIssues: number;
  openIssues: number;
  criticalIssues: number;
  averageResolutionTime: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issuesByStatus: Record<string, number>;
  trendData: TrendData[];
}

export interface TrendData {
  date: Date;
  newIssues: number;
  resolvedIssues: number;
  totalOpen: number;
}

export class UsabilityIssueManager extends BaseService {
  private analyticsService: AnalyticsService;
  private emailService: EmailNotificationService;
  private issues: Map<string, EnhancedUsabilityIssue> = new Map();

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
    this.emailService = new EmailNotificationService();
  }

  /**
   * Process and categorize usability issues from feedback
   */
  async processUsabilityIssues(feedback: UserTestingFeedback[]): Promise<EnhancedUsabilityIssue[]> {
    try {
      const allIssues = feedback.flatMap(f => 
        f.usabilityIssues.map(issue => ({
          ...issue,
          betaTesterId: f.betaTesterId,
          scenarioId: f.scenarioId,
          reportedAt: f.createdAt
        }))
      );

      // Group similar issues
      const groupedIssues = this.groupSimilarIssues(allIssues);

      // Enhance issues with additional metadata
      const enhancedIssues = await Promise.all(
        groupedIssues.map(group => this.enhanceIssueGroup(group))
      );

      // Store issues
      enhancedIssues.forEach(issue => {
        this.issues.set(issue.id, issue);
      });

      // Prioritize issues
      const prioritizedIssues = this.prioritizeIssues(enhancedIssues);

      // Send notifications for critical issues
      await this.notifyCriticalIssues(prioritizedIssues);

      // Track metrics
      await this.trackUsabilityMetrics(prioritizedIssues);

      this.logger.info(`Processed ${allIssues.length} raw issues into ${enhancedIssues.length} categorized issues`);

      return prioritizedIssues;
    } catch (error) {
      this.logger.error('Failed to process usability issues:', error);
      throw error;
    }
  }

  /**
   * Get prioritized list of usability issues
   */
  async getPrioritizedIssues(filters?: {
    severity?: string[];
    category?: string[];
    status?: string[];
    assignedTo?: string;
  }): Promise<EnhancedUsabilityIssue[]> {
    let issues = Array.from(this.issues.values());

    // Apply filters
    if (filters) {
      if (filters.severity) {
        issues = issues.filter(issue => filters.severity!.includes(issue.severity));
      }
      if (filters.category) {
        issues = issues.filter(issue => filters.category!.includes(issue.category));
      }
      if (filters.status) {
        issues = issues.filter(issue => filters.status!.includes(issue.status));
      }
      if (filters.assignedTo) {
        issues = issues.filter(issue => issue.assignedTo === filters.assignedTo);
      }
    }

    // Sort by priority (highest first)
    return issues.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Create resolution plan for an issue
   */
  async createResolutionPlan(issueId: string): Promise<IssueResolutionPlan> {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const plan: IssueResolutionPlan = {
      issueId,
      plannedResolution: this.generatePlannedResolution(issue),
      estimatedTimeline: this.estimateResolutionTimeline(issue),
      requiredResources: this.identifyRequiredResources(issue),
      dependencies: this.identifyDependencies(issue),
      successCriteria: this.defineSuccessCriteria(issue),
      riskFactors: this.identifyRiskFactors(issue)
    };

    // Track plan creation
    await this.analyticsService.trackEvent('resolution_plan_created', {
      issueId,
      severity: issue.severity,
      category: issue.category,
      estimatedTimeline: plan.estimatedTimeline
    });

    return plan;
  }

  /**
   * Update issue status
   */
  async updateIssueStatus(
    issueId: string, 
    status: 'open' | 'in_progress' | 'resolved' | 'wont_fix',
    assignedTo?: string,
    notes?: string
  ): Promise<EnhancedUsabilityIssue> {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const previousStatus = issue.status;
    issue.status = status;
    
    if (assignedTo) {
      issue.assignedTo = assignedTo;
    }
    
    if (notes) {
      issue.testingNotes.push(`${new Date().toISOString()}: ${notes}`);
      if (status === 'resolved') {
        issue.resolutionNotes = notes;
      }
    }

    this.issues.set(issueId, issue);

    // Send notifications for status changes
    await this.notifyStatusChange(issue, previousStatus);

    // Track status change
    await this.analyticsService.trackEvent('issue_status_changed', {
      issueId,
      previousStatus,
      newStatus: status,
      assignedTo,
      severity: issue.severity
    });

    this.logger.info(`Issue ${issueId} status changed from ${previousStatus} to ${status}`);

    return issue;
  }

  /**
   * Get usability metrics dashboard data
   */
  async getUsabilityMetrics(): Promise<UsabilityMetrics> {
    const issues = Array.from(this.issues.values());
    
    const totalIssues = issues.length;
    const openIssues = issues.filter(i => i.status === 'open').length;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;

    // Calculate average resolution time (simplified)
    const resolvedIssues = issues.filter(i => i.status === 'resolved');
    const averageResolutionTime = resolvedIssues.length > 0 ? 
      resolvedIssues.reduce((sum, issue) => {
        const resolutionTime = Date.now() - issue.firstReported.getTime();
        return sum + resolutionTime;
      }, 0) / resolvedIssues.length / (1000 * 60 * 60 * 24) : 0; // Convert to days

    const issuesByCategory = this.groupByField(issues, 'category');
    const issuesBySeverity = this.groupByField(issues, 'severity');
    const issuesByStatus = this.groupByField(issues, 'status');

    // Generate trend data (simplified - would use time series in production)
    const trendData: TrendData[] = this.generateTrendData(issues);

    return {
      totalIssues,
      openIssues,
      criticalIssues,
      averageResolutionTime,
      issuesByCategory,
      issuesBySeverity,
      issuesByStatus,
      trendData
    };
  }

  /**
   * Generate issue resolution recommendations
   */
  async generateResolutionRecommendations(): Promise<{
    quickWins: EnhancedUsabilityIssue[];
    highImpact: EnhancedUsabilityIssue[];
    criticalPath: EnhancedUsabilityIssue[];
    resourceIntensive: EnhancedUsabilityIssue[];
  }> {
    const openIssues = Array.from(this.issues.values())
      .filter(issue => issue.status === 'open');

    const quickWins = openIssues
      .filter(issue => 
        issue.technicalComplexity === 'low' && 
        issue.businessImpact !== 'low'
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);

    const highImpact = openIssues
      .filter(issue => 
        issue.businessImpact === 'critical' || 
        issue.businessImpact === 'high'
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);

    const criticalPath = openIssues
      .filter(issue => issue.severity === 'critical')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);

    const resourceIntensive = openIssues
      .filter(issue => 
        issue.technicalComplexity === 'high' && 
        issue.businessImpact !== 'low'
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    return {
      quickWins,
      highImpact,
      criticalPath,
      resourceIntensive
    };
  }

  // Private helper methods
  private groupSimilarIssues(issues: any[]): any[][] {
    const groups: Map<string, any[]> = new Map();

    issues.forEach(issue => {
      const key = this.generateIssueKey(issue);
      if (groups.has(key)) {
        groups.get(key)!.push(issue);
      } else {
        groups.set(key, [issue]);
      }
    });

    return Array.from(groups.values());
  }

  private generateIssueKey(issue: any): string {
    // Create a key based on description similarity and location
    const normalizedDescription = issue.description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter((word: string) => word.length > 3)
      .slice(0, 3)
      .join('_');
    
    return `${issue.category}_${issue.location}_${normalizedDescription}`;
  }

  private async enhanceIssueGroup(group: any[]): Promise<EnhancedUsabilityIssue> {
    const primaryIssue = group[0];
    const frequency = group.length;
    const affectedUsers = [...new Set(group.map(issue => issue.betaTesterId))];
    
    const dates = group.map(issue => new Date(issue.reportedAt));
    const firstReported = new Date(Math.min(...dates.map(d => d.getTime())));
    const lastReported = new Date(Math.max(...dates.map(d => d.getTime())));

    const enhancedIssue: EnhancedUsabilityIssue = {
      id: this.generateId(),
      severity: primaryIssue.severity,
      category: primaryIssue.category,
      description: primaryIssue.description,
      location: primaryIssue.location,
      reproductionSteps: primaryIssue.reproductionSteps,
      frequency,
      affectedUsers,
      firstReported,
      lastReported,
      status: 'open',
      priority: this.calculatePriority(primaryIssue, frequency, affectedUsers.length),
      businessImpact: this.assessBusinessImpact(primaryIssue, frequency),
      technicalComplexity: this.assessTechnicalComplexity(primaryIssue),
      estimatedEffort: this.estimateEffort(primaryIssue),
      relatedIssues: [],
      testingNotes: []
    };

    return enhancedIssue;
  }

  private calculatePriority(issue: any, frequency: number, userCount: number): number {
    const severityWeights = { critical: 10, high: 7, medium: 4, low: 1 };
    const severityScore = severityWeights[issue.severity as keyof typeof severityWeights] || 1;
    
    const frequencyScore = Math.min(frequency * 2, 10);
    const userImpactScore = Math.min(userCount * 1.5, 10);
    
    return Math.round((severityScore * 0.5 + frequencyScore * 0.3 + userImpactScore * 0.2));
  }

  private assessBusinessImpact(issue: any, frequency: number): 'low' | 'medium' | 'high' | 'critical' {
    if (issue.severity === 'critical' || frequency > 5) return 'critical';
    if (issue.severity === 'high' || frequency > 3) return 'high';
    if (issue.severity === 'medium' || frequency > 1) return 'medium';
    return 'low';
  }

  private assessTechnicalComplexity(issue: any): 'low' | 'medium' | 'high' {
    if (issue.category === 'accessibility') return 'medium';
    if (issue.category === 'performance') return 'high';
    if (issue.category === 'content') return 'low';
    return 'medium';
  }

  private estimateEffort(issue: any): string {
    const complexity = this.assessTechnicalComplexity(issue);
    
    if (complexity === 'high') return '1-2 weeks';
    if (complexity === 'medium') return '3-5 days';
    return '1-2 days';
  }

  private prioritizeIssues(issues: EnhancedUsabilityIssue[]): EnhancedUsabilityIssue[] {
    return issues.sort((a, b) => {
      // First by severity
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity as keyof typeof severityOrder] - 
                          severityOrder[a.severity as keyof typeof severityOrder];
      
      if (severityDiff !== 0) return severityDiff;
      
      // Then by priority score
      return b.priority - a.priority;
    });
  }

  private async notifyCriticalIssues(issues: EnhancedUsabilityIssue[]): Promise<void> {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    
    if (criticalIssues.length > 0) {
      await this.emailService.sendEmail({
        to: 'dev-team@saga.com',
        subject: `URGENT: ${criticalIssues.length} Critical Usability Issues Found`,
        template: 'critical-usability-issues',
        data: {
          issues: criticalIssues.map(issue => ({
            description: issue.description,
            location: issue.location,
            frequency: issue.frequency,
            affectedUsers: issue.affectedUsers.length
          }))
        }
      });
    }
  }

  private async notifyStatusChange(
    issue: EnhancedUsabilityIssue, 
    previousStatus: string
  ): Promise<void> {
    if (issue.assignedTo && issue.status === 'in_progress') {
      await this.emailService.sendEmail({
        to: `${issue.assignedTo}@saga.com`,
        subject: `Issue Assigned: ${issue.description}`,
        template: 'issue-assigned',
        data: {
          issueId: issue.id,
          description: issue.description,
          severity: issue.severity,
          priority: issue.priority
        }
      });
    }
  }

  private async trackUsabilityMetrics(issues: EnhancedUsabilityIssue[]): Promise<void> {
    const metrics = {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highPriorityIssues: issues.filter(i => i.priority >= 8).length,
      averagePriority: issues.reduce((sum, i) => sum + i.priority, 0) / issues.length
    };

    await this.analyticsService.trackEvent('usability_metrics_updated', metrics);
  }

  private groupByField<T>(items: T[], field: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = String(item[field]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateTrendData(issues: EnhancedUsabilityIssue[]): TrendData[] {
    // Simplified trend data generation
    // In production, this would use actual time series data
    const today = new Date();
    const trendData: TrendData[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      trendData.push({
        date,
        newIssues: Math.floor(Math.random() * 5) + 1,
        resolvedIssues: Math.floor(Math.random() * 3),
        totalOpen: issues.filter(issue => issue.status === 'open').length
      });
    }

    return trendData;
  }

  // Resolution planning methods
  private generatePlannedResolution(issue: EnhancedUsabilityIssue): string {
    if (issue.category === 'navigation') {
      return 'Redesign navigation flow and add clear visual indicators';
    }
    if (issue.category === 'accessibility') {
      return 'Implement proper ARIA labels and keyboard navigation support';
    }
    if (issue.category === 'performance') {
      return 'Optimize loading times and implement progressive loading';
    }
    return 'Analyze root cause and implement targeted fix';
  }

  private estimateResolutionTimeline(issue: EnhancedUsabilityIssue): string {
    if (issue.severity === 'critical') return 'Immediate (1-2 days)';
    if (issue.technicalComplexity === 'high') return '1-2 weeks';
    if (issue.technicalComplexity === 'medium') return '3-5 days';
    return '1-2 days';
  }

  private identifyRequiredResources(issue: EnhancedUsabilityIssue): string[] {
    const resources = ['Frontend Developer'];
    
    if (issue.category === 'accessibility') {
      resources.push('Accessibility Specialist');
    }
    if (issue.category === 'performance') {
      resources.push('Performance Engineer');
    }
    if (issue.severity === 'critical') {
      resources.push('QA Tester', 'Product Manager');
    }
    
    return resources;
  }

  private identifyDependencies(issue: EnhancedUsabilityIssue): string[] {
    const dependencies: string[] = [];
    
    if (issue.category === 'navigation') {
      dependencies.push('UX Design Review', 'User Flow Analysis');
    }
    if (issue.technicalComplexity === 'high') {
      dependencies.push('Technical Architecture Review');
    }
    if (issue.severity === 'critical') {
      dependencies.push('Stakeholder Approval');
    }
    
    return dependencies;
  }

  private defineSuccessCriteria(issue: EnhancedUsabilityIssue): string[] {
    return [
      'Issue no longer reproducible in testing',
      'User feedback shows improvement',
      'No regression in related functionality',
      'Accessibility compliance maintained'
    ];
  }

  private identifyRiskFactors(issue: EnhancedUsabilityIssue): string[] {
    const risks: string[] = [];
    
    if (issue.technicalComplexity === 'high') {
      risks.push('May introduce new bugs');
    }
    if (issue.relatedIssues.length > 0) {
      risks.push('May affect related functionality');
    }
    if (issue.severity === 'critical') {
      risks.push('High visibility if not resolved quickly');
    }
    
    return risks;
  }

  private generateId(): string {
    return `issue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}