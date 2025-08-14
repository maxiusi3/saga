import { BaseService } from './base-service';
import { User } from '../models/user';
import { Project } from '../models/project';
import { EmailNotificationService } from './email-notification-service';
import { AnalyticsService } from './analytics-service';

export interface BetaTester {
  id: string;
  userId: string;
  email: string;
  name: string;
  familySize: number;
  ageRange: string;
  techComfort: 'low' | 'medium' | 'high';
  deviceType: 'ios' | 'android' | 'both';
  testingPhase: 'onboarding' | 'recording' | 'interaction' | 'export' | 'complete';
  recruitedAt: Date;
  completedAt?: Date;
  feedback?: UserTestingFeedback[];
}

export interface UserTestingScenario {
  id: string;
  name: string;
  description: string;
  targetRole: 'facilitator' | 'storyteller' | 'both';
  estimatedDuration: number; // in minutes
  steps: TestingStep[];
  successCriteria: string[];
}

export interface TestingStep {
  stepNumber: number;
  instruction: string;
  expectedOutcome: string;
  platform: 'web' | 'mobile' | 'both';
}

export interface UserTestingFeedback {
  id: string;
  betaTesterId: string;
  scenarioId: string;
  rating: number; // 1-5 scale
  completionTime: number; // in minutes
  completedSuccessfully: boolean;
  usabilityIssues: UsabilityIssue[];
  generalFeedback: string;
  suggestions: string;
  wouldRecommend: boolean;
  createdAt: Date;
}

export interface UsabilityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'navigation' | 'accessibility' | 'performance' | 'content' | 'functionality';
  description: string;
  location: string; // page/screen where issue occurred
  reproductionSteps: string[];
}

export interface TestingSession {
  id: string;
  betaTesterId: string;
  moderatorId: string;
  scheduledAt: Date;
  duration: number;
  scenarios: string[]; // scenario IDs
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  recordingUrl?: string;
}

export class UserAcceptanceTestingService extends BaseService {
  private emailService: EmailNotificationService;
  private analyticsService: AnalyticsService;

  constructor() {
    super();
    this.emailService = new EmailNotificationService();
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Recruit beta testers from target demographics
   */
  async recruitBetaTesters(criteria: {
    targetCount: number;
    familySizeRange: [number, number];
    ageRanges: string[];
    techComfortLevels: string[];
    deviceTypes: string[];
  }): Promise<BetaTester[]> {
    const startTime = Date.now();
    
    try {
      // Input validation
      if (!criteria || typeof criteria !== 'object') {
        throw new Error('Invalid recruitment criteria provided');
      }
      
      if (!criteria.targetCount || criteria.targetCount <= 0 || criteria.targetCount > 1000) {
        throw new Error('Target count must be between 1 and 1000');
      }
      
      if (!criteria.ageRanges || !Array.isArray(criteria.ageRanges) || criteria.ageRanges.length === 0) {
        throw new Error('Age ranges must be provided as a non-empty array');
      }
      
      if (!criteria.techComfortLevels || !Array.isArray(criteria.techComfortLevels) || criteria.techComfortLevels.length === 0) {
        throw new Error('Tech comfort levels must be provided as a non-empty array');
      }

      this.logger.info('Starting beta tester recruitment', {
        targetCount: criteria.targetCount,
        ageRanges: criteria.ageRanges,
        techComfortLevels: criteria.techComfortLevels
      });

      // Create recruitment campaign with error handling
      const recruitmentCampaign = {
        id: this.generateId(),
        targetCount: criteria.targetCount,
        criteria,
        status: 'active',
        createdAt: new Date()
      };

      // Track recruitment analytics with error handling
      try {
        await this.analyticsService.trackEvent('beta_recruitment_started', {
          campaignId: recruitmentCampaign.id,
          targetCount: criteria.targetCount,
          criteria
        });
      } catch (analyticsError) {
        this.logger.warn('Failed to track recruitment analytics', { error: analyticsError.message });
        // Continue execution - analytics failure shouldn't stop recruitment
      }

      // Find potential testers with error handling
      let potentialTesters: User[] = [];
      try {
        potentialTesters = await this.findPotentialTesters(criteria);
        this.logger.info('Found potential testers', { count: potentialTesters.length });
      } catch (findError) {
        this.logger.error('Failed to find potential testers', { error: findError.message });
        throw new Error(`Failed to identify potential testers: ${findError.message}`);
      }

      // Send recruitment emails with individual error handling
      const emailResults = [];
      for (const user of potentialTesters) {
        try {
          await this.sendRecruitmentEmail(user, recruitmentCampaign.id);
          emailResults.push({ userId: user.id, status: 'sent' });
        } catch (emailError) {
          this.logger.warn('Failed to send recruitment email', {
            userId: user.id,
            email: user.email,
            error: emailError.message
          });
          emailResults.push({ userId: user.id, status: 'failed', error: emailError.message });
        }
      }

      const successfulEmails = emailResults.filter(r => r.status === 'sent').length;
      this.logger.info('Recruitment emails sent', {
        total: emailResults.length,
        successful: successfulEmails,
        failed: emailResults.length - successfulEmails
      });

      // Create recruitment landing page with error handling
      try {
        await this.createRecruitmentLandingPage(recruitmentCampaign);
      } catch (landingPageError) {
        this.logger.error('Failed to create recruitment landing page', { error: landingPageError.message });
        // Continue execution - landing page failure shouldn't stop recruitment
      }

      const duration = Date.now() - startTime;
      this.logger.info('Beta tester recruitment completed', {
        campaignId: recruitmentCampaign.id,
        duration: `${duration}ms`,
        emailsSent: successfulEmails
      });

      return []; // Return empty array for now - would return actual recruited testers
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Beta tester recruitment failed', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`,
        criteria
      });
      
      // Re-throw with more context
      throw new Error(`Beta tester recruitment failed: ${error.message}`);
    }
  }

  /**
   * Create comprehensive user testing scenarios
   */
  async createTestingScenarios(): Promise<UserTestingScenario[]> {
    const scenarios: UserTestingScenario[] = [
      {
        id: 'onboarding-facilitator',
        name: 'Facilitator Onboarding & Project Creation',
        description: 'Test the complete facilitator onboarding flow from signup to project creation',
        targetRole: 'facilitator',
        estimatedDuration: 15,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Sign up for a new account using your preferred method (email, Google, or Apple)',
            expectedOutcome: 'Successfully create account and reach dashboard',
            platform: 'web'
          },
          {
            stepNumber: 2,
            instruction: 'Navigate to create a new project and purchase "The Saga Package"',
            expectedOutcome: 'Complete payment flow and project creation',
            platform: 'web'
          },
          {
            stepNumber: 3,
            instruction: 'Generate and share an invitation link for a storyteller',
            expectedOutcome: 'Successfully create and copy invitation link',
            platform: 'web'
          }
        ],
        successCriteria: [
          'User completes signup within 3 minutes',
          'Payment flow is clear and trustworthy',
          'Invitation process is intuitive',
          'User understands the package/seat model'
        ]
      },
      {
        id: 'storyteller-onboarding',
        name: 'Storyteller Invitation & First Recording',
        description: 'Test storyteller onboarding from invitation acceptance to first story recording',
        targetRole: 'storyteller',
        estimatedDuration: 20,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Tap the invitation link and download the mobile app',
            expectedOutcome: 'App downloads and opens to welcome screen',
            platform: 'mobile'
          },
          {
            stepNumber: 2,
            instruction: 'Accept the invitation and agree to privacy pledge',
            expectedOutcome: 'Successfully join project and reach recording home',
            platform: 'mobile'
          },
          {
            stepNumber: 3,
            instruction: 'Record your first story using the AI prompt',
            expectedOutcome: 'Complete recording, review, and send workflow',
            platform: 'mobile'
          }
        ],
        successCriteria: [
          'Onboarding completes in under 3 interactions',
          'Privacy pledge is clear and reassuring',
          'Recording interface is intuitive for older adults',
          'Review & Send workflow builds confidence'
        ]
      },
      {
        id: 'multi-facilitator-collaboration',
        name: 'Multi-Facilitator Story Interaction',
        description: 'Test collaboration between multiple facilitators on story interactions',
        targetRole: 'facilitator',
        estimatedDuration: 25,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Invite a co-facilitator (sibling) to the project',
            expectedOutcome: 'Successfully send and accept facilitator invitation',
            platform: 'web'
          },
          {
            stepNumber: 2,
            instruction: 'Both facilitators view and interact with the same story',
            expectedOutcome: 'Comments and questions are clearly attributed',
            platform: 'web'
          },
          {
            stepNumber: 3,
            instruction: 'Test real-time collaboration features',
            expectedOutcome: 'Updates appear in real-time for both users',
            platform: 'web'
          }
        ],
        successCriteria: [
          'Attribution is clear and consistent',
          'Real-time updates work reliably',
          'No conflicts in simultaneous interactions',
          'Collaboration feels natural and organized'
        ]
      },
      {
        id: 'accessibility-validation',
        name: 'Accessibility Features Testing',
        description: 'Validate accessibility features with users who have disabilities',
        targetRole: 'storyteller',
        estimatedDuration: 30,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Navigate the app using screen reader or voice control',
            expectedOutcome: 'All elements are properly labeled and accessible',
            platform: 'mobile'
          },
          {
            stepNumber: 2,
            instruction: 'Adjust font size and high contrast settings',
            expectedOutcome: 'Settings apply globally and improve readability',
            platform: 'mobile'
          },
          {
            stepNumber: 3,
            instruction: 'Complete a full recording workflow using accessibility features',
            expectedOutcome: 'Recording process is fully accessible',
            platform: 'mobile'
          }
        ],
        successCriteria: [
          'WCAG 2.1 AA compliance verified by real users',
          'Screen reader navigation is smooth',
          'Visual accessibility features are effective',
          'Recording workflow is accessible to all users'
        ]
      },
      {
        id: 'business-model-validation',
        name: 'Package/Seat Model Understanding',
        description: 'Test user understanding and acceptance of the business model',
        targetRole: 'both',
        estimatedDuration: 20,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Review the package pricing and value proposition',
            expectedOutcome: 'User understands what they get for the price',
            platform: 'web'
          },
          {
            stepNumber: 2,
            instruction: 'Use seats to invite family members',
            expectedOutcome: 'Seat consumption is clear and expected',
            platform: 'web'
          },
          {
            stepNumber: 3,
            instruction: 'Experience the transition to archival mode (simulated)',
            expectedOutcome: 'User understands archival mode and renewal options',
            platform: 'web'
          }
        ],
        successCriteria: [
          'Pricing is perceived as fair and valuable',
          'Seat model is intuitive and clear',
          'Archival mode concept is understood',
          'Users would recommend to other families'
        ]
      }
    ];

    // Store scenarios in database for tracking
    for (const scenario of scenarios) {
      await this.storeTestingScenario(scenario);
    }

    return scenarios;
  }

  /**
   * Conduct moderated user testing session
   */
  async conductTestingSession(sessionId: string): Promise<TestingSession> {
    try {
      const session = await this.getTestingSession(sessionId);
      
      // Update session status
      await this.updateSessionStatus(sessionId, 'in_progress');

      // Track session start
      await this.analyticsService.trackEvent('testing_session_started', {
        sessionId,
        betaTesterId: session.betaTesterId,
        scenarios: session.scenarios
      });

      // Initialize session monitoring
      await this.initializeSessionMonitoring(session);

      return session;
    } catch (error) {
      this.logger.error('Failed to conduct testing session:', error);
      throw error;
    }
  }

  /**
   * Collect and analyze user feedback systematically
   */
  async collectFeedback(feedback: Omit<UserTestingFeedback, 'id' | 'createdAt'>): Promise<UserTestingFeedback> {
    try {
      const feedbackRecord: UserTestingFeedback = {
        ...feedback,
        id: this.generateId(),
        createdAt: new Date()
      };

      // Store feedback in database
      await this.storeFeedback(feedbackRecord);

      // Analyze feedback for patterns
      await this.analyzeFeedbackPatterns(feedbackRecord);

      // Track feedback analytics
      await this.analyticsService.trackEvent('user_feedback_collected', {
        feedbackId: feedbackRecord.id,
        rating: feedback.rating,
        completedSuccessfully: feedback.completedSuccessfully,
        issueCount: feedback.usabilityIssues.length
      });

      return feedbackRecord;
    } catch (error) {
      this.logger.error('Failed to collect feedback:', error);
      throw error;
    }
  }

  /**
   * Identify and prioritize usability issues
   */
  async identifyUsabilityIssues(): Promise<{
    critical: UsabilityIssue[];
    high: UsabilityIssue[];
    medium: UsabilityIssue[];
    low: UsabilityIssue[];
  }> {
    try {
      const allFeedback = await this.getAllFeedback();
      const allIssues = allFeedback.flatMap(f => f.usabilityIssues);

      // Group issues by severity
      const issuesBySeverity = {
        critical: allIssues.filter(i => i.severity === 'critical'),
        high: allIssues.filter(i => i.severity === 'high'),
        medium: allIssues.filter(i => i.severity === 'medium'),
        low: allIssues.filter(i => i.severity === 'low')
      };

      // Analyze patterns and frequency
      await this.analyzeIssuePatterns(issuesBySeverity);

      return issuesBySeverity;
    } catch (error) {
      this.logger.error('Failed to identify usability issues:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive testing report
   */
  async generateTestingReport(): Promise<{
    summary: TestingSummary;
    demographics: DemographicAnalysis;
    usabilityFindings: UsabilityFindings;
    businessModelValidation: BusinessModelValidation;
    recommendations: Recommendation[];
  }> {
    try {
      const allFeedback = await this.getAllFeedback();
      const allTesters = await this.getAllBetaTesters();

      const summary = await this.generateTestingSummary(allFeedback, allTesters);
      const demographics = await this.analyzeDemographics(allTesters);
      const usabilityFindings = await this.analyzeUsabilityFindings(allFeedback);
      const businessModelValidation = await this.analyzeBusinessModelValidation(allFeedback);
      const recommendations = await this.generateRecommendations(allFeedback);

      const report = {
        summary,
        demographics,
        usabilityFindings,
        businessModelValidation,
        recommendations
      };

      // Store report for future reference
      await this.storeTestingReport(report);

      return report;
    } catch (error) {
      this.logger.error('Failed to generate testing report:', error);
      throw error;
    }
  }

  // Private helper methods
  private async findPotentialTesters(criteria: any): Promise<User[]> {
    // Implementation to find users matching criteria
    return [];
  }

  private async sendRecruitmentEmail(user: User, campaignId: string): Promise<void> {
    await this.emailService.sendEmail({
      to: user.email!,
      subject: 'Help Us Test Saga - Family Biography Platform',
      template: 'beta-recruitment',
      data: {
        name: user.name,
        campaignId
      }
    });
  }

  private async createRecruitmentLandingPage(campaign: any): Promise<void> {
    // Implementation to create recruitment landing page
  }

  private async storeTestingScenario(scenario: UserTestingScenario): Promise<void> {
    // Implementation to store scenario in database
  }

  private async getTestingSession(sessionId: string): Promise<TestingSession> {
    // Implementation to retrieve testing session
    throw new Error('Not implemented');
  }

  private async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    // Implementation to update session status
  }

  private async initializeSessionMonitoring(session: TestingSession): Promise<void> {
    // Implementation to initialize session monitoring
  }

  private async storeFeedback(feedback: UserTestingFeedback): Promise<void> {
    // Implementation to store feedback in database
  }

  private async analyzeFeedbackPatterns(feedback: UserTestingFeedback): Promise<void> {
    // Implementation to analyze feedback patterns
  }

  private async getAllFeedback(): Promise<UserTestingFeedback[]> {
    // Implementation to retrieve all feedback
    return [];
  }

  private async getAllBetaTesters(): Promise<BetaTester[]> {
    // Implementation to retrieve all beta testers
    return [];
  }

  private async analyzeIssuePatterns(issues: any): Promise<void> {
    // Implementation to analyze issue patterns
  }

  private async generateTestingSummary(feedback: UserTestingFeedback[], testers: BetaTester[]): Promise<TestingSummary> {
    return {
      totalTesters: testers.length,
      totalSessions: feedback.length,
      averageRating: feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length,
      completionRate: feedback.filter(f => f.completedSuccessfully).length / feedback.length,
      averageCompletionTime: feedback.reduce((sum, f) => sum + f.completionTime, 0) / feedback.length,
      recommendationRate: feedback.filter(f => f.wouldRecommend).length / feedback.length
    };
  }

  private async analyzeDemographics(testers: BetaTester[]): Promise<DemographicAnalysis> {
    return {
      ageDistribution: {},
      techComfortDistribution: {},
      deviceTypeDistribution: {},
      familySizeDistribution: {}
    };
  }

  private async analyzeUsabilityFindings(feedback: UserTestingFeedback[]): Promise<UsabilityFindings> {
    return {
      totalIssues: 0,
      issuesByCategory: {},
      issuesBySeverity: {},
      commonPatterns: []
    };
  }

  private async analyzeBusinessModelValidation(feedback: UserTestingFeedback[]): Promise<BusinessModelValidation> {
    return {
      pricingAcceptance: 0,
      seatModelUnderstanding: 0,
      archivalModeAcceptance: 0,
      overallBusinessModelScore: 0
    };
  }

  private async generateRecommendations(feedback: UserTestingFeedback[]): Promise<Recommendation[]> {
    return [];
  }

  private async storeTestingReport(report: any): Promise<void> {
    // Implementation to store testing report
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Supporting interfaces
interface TestingSummary {
  totalTesters: number;
  totalSessions: number;
  averageRating: number;
  completionRate: number;
  averageCompletionTime: number;
  recommendationRate: number;
}

interface DemographicAnalysis {
  ageDistribution: Record<string, number>;
  techComfortDistribution: Record<string, number>;
  deviceTypeDistribution: Record<string, number>;
  familySizeDistribution: Record<string, number>;
}

interface UsabilityFindings {
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  commonPatterns: string[];
}

interface BusinessModelValidation {
  pricingAcceptance: number;
  seatModelUnderstanding: number;
  archivalModeAcceptance: number;
  overallBusinessModelScore: number;
}

interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}