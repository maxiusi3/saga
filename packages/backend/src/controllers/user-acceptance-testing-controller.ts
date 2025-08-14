import { Request, Response } from 'express';
import { UserAcceptanceTestingService, BetaTester, UserTestingScenario, UserTestingFeedback, TestingSession } from '../services/user-acceptance-testing-service';
import { LoggingService } from '../services/logging-service';

export class UserAcceptanceTestingController {
  private uatService: UserAcceptanceTestingService;
  private logger: LoggingService;

  constructor() {
    this.uatService = new UserAcceptanceTestingService();
    this.logger = new LoggingService();
  }

  /**
   * Start beta tester recruitment campaign
   */
  async recruitBetaTesters(req: Request, res: Response): Promise<void> {
    try {
      const {
        targetCount = 50,
        familySizeRange = [2, 6],
        ageRanges = ['45-55', '55-65', '65-75', '75+'],
        techComfortLevels = ['low', 'medium', 'high'],
        deviceTypes = ['ios', 'android', 'both']
      } = req.body;

      const criteria = {
        targetCount,
        familySizeRange,
        ageRanges,
        techComfortLevels,
        deviceTypes
      };

      const betaTesters = await this.uatService.recruitBetaTesters(criteria);

      res.status(200).json({
        success: true,
        message: 'Beta tester recruitment campaign started',
        data: {
          criteria,
          recruitedCount: betaTesters.length,
          betaTesters
        }
      });
    } catch (error) {
      this.logger.error('Failed to recruit beta testers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start recruitment campaign'
      });
    }
  }

  /**
   * Get all testing scenarios
   */
  async getTestingScenarios(req: Request, res: Response): Promise<void> {
    try {
      const scenarios = await this.uatService.createTestingScenarios();

      res.status(200).json({
        success: true,
        data: {
          scenarios,
          totalScenarios: scenarios.length
        }
      });
    } catch (error) {
      this.logger.error('Failed to get testing scenarios:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve testing scenarios'
      });
    }
  }

  /**
   * Schedule a moderated testing session
   */
  async scheduleTestingSession(req: Request, res: Response): Promise<void> {
    try {
      const {
        betaTesterId,
        moderatorId,
        scheduledAt,
        duration = 60,
        scenarios = []
      } = req.body;

      if (!betaTesterId || !moderatorId || !scheduledAt) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: betaTesterId, moderatorId, scheduledAt'
        });
        return;
      }

      const session: Omit<TestingSession, 'id'> = {
        betaTesterId,
        moderatorId,
        scheduledAt: new Date(scheduledAt),
        duration,
        scenarios,
        status: 'scheduled',
        notes: req.body.notes || ''
      };

      // Store session (implementation would be in service)
      const sessionId = Math.random().toString(36).substring(2, 15);

      res.status(201).json({
        success: true,
        message: 'Testing session scheduled successfully',
        data: {
          sessionId,
          ...session
        }
      });
    } catch (error) {
      this.logger.error('Failed to schedule testing session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule testing session'
      });
    }
  }

  /**
   * Start a testing session
   */
  async startTestingSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      const session = await this.uatService.conductTestingSession(sessionId);

      res.status(200).json({
        success: true,
        message: 'Testing session started',
        data: session
      });
    } catch (error) {
      this.logger.error('Failed to start testing session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start testing session'
      });
    }
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const {
        betaTesterId,
        scenarioId,
        rating,
        completionTime,
        completedSuccessfully,
        usabilityIssues = [],
        generalFeedback = '',
        suggestions = '',
        wouldRecommend
      } = req.body;

      // Validate required fields
      if (!betaTesterId || !scenarioId || rating === undefined || completionTime === undefined || completedSuccessfully === undefined || wouldRecommend === undefined) {
        res.status(400).json({
          success: false,
          error: 'Missing required feedback fields'
        });
        return;
      }

      // Validate rating range
      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
        return;
      }

      const feedbackData = {
        betaTesterId,
        scenarioId,
        rating,
        completionTime,
        completedSuccessfully,
        usabilityIssues,
        generalFeedback,
        suggestions,
        wouldRecommend
      };

      const feedback = await this.uatService.collectFeedback(feedbackData);

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: feedback
      });
    } catch (error) {
      this.logger.error('Failed to submit feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback'
      });
    }
  }

  /**
   * Get usability issues analysis
   */
  async getUsabilityIssues(req: Request, res: Response): Promise<void> {
    try {
      const issues = await this.uatService.identifyUsabilityIssues();

      const summary = {
        total: Object.values(issues).flat().length,
        critical: issues.critical.length,
        high: issues.high.length,
        medium: issues.medium.length,
        low: issues.low.length
      };

      res.status(200).json({
        success: true,
        data: {
          summary,
          issues
        }
      });
    } catch (error) {
      this.logger.error('Failed to get usability issues:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve usability issues'
      });
    }
  }

  /**
   * Generate comprehensive testing report
   */
  async generateTestingReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await this.uatService.generateTestingReport();

      res.status(200).json({
        success: true,
        message: 'Testing report generated successfully',
        data: report
      });
    } catch (error) {
      this.logger.error('Failed to generate testing report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate testing report'
      });
    }
  }

  /**
   * Get beta tester demographics
   */
  async getBetaTesterDemographics(req: Request, res: Response): Promise<void> {
    try {
      // This would typically fetch from database
      const demographics = {
        totalTesters: 0,
        ageDistribution: {
          '45-55': 0,
          '55-65': 0,
          '65-75': 0,
          '75+': 0
        },
        techComfortDistribution: {
          'low': 0,
          'medium': 0,
          'high': 0
        },
        deviceTypeDistribution: {
          'ios': 0,
          'android': 0,
          'both': 0
        },
        familySizeDistribution: {
          '2': 0,
          '3': 0,
          '4': 0,
          '5+': 0
        }
      };

      res.status(200).json({
        success: true,
        data: demographics
      });
    } catch (error) {
      this.logger.error('Failed to get beta tester demographics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve demographics'
      });
    }
  }

  /**
   * Get testing progress overview
   */
  async getTestingProgress(req: Request, res: Response): Promise<void> {
    try {
      const progress = {
        totalTesters: 0,
        activeTesters: 0,
        completedSessions: 0,
        pendingSessions: 0,
        averageRating: 0,
        completionRate: 0,
        criticalIssues: 0,
        resolvedIssues: 0,
        lastUpdated: new Date()
      };

      res.status(200).json({
        success: true,
        data: progress
      });
    } catch (error) {
      this.logger.error('Failed to get testing progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve testing progress'
      });
    }
  }

  /**
   * Export testing data for analysis
   */
  async exportTestingData(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'json' } = req.query;

      // Generate export data
      const exportData = {
        exportedAt: new Date(),
        format,
        data: {
          betaTesters: [],
          scenarios: [],
          feedback: [],
          sessions: [],
          issues: []
        }
      };

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=user-testing-data.csv');
        // Convert to CSV format
        res.send('CSV data would be generated here');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=user-testing-data.json');
        res.json(exportData);
      }
    } catch (error) {
      this.logger.error('Failed to export testing data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export testing data'
      });
    }
  }
}