import { Request, Response } from 'express';
import { UserAcceptanceTestingService, BetaTester, UserTestingScenario, UserTestingFeedback, TestingSession } from '../services/user-acceptance-testing-service';
import { LoggingService } from '../services/logging-service';

export class UserAcceptanceTestingController {
  private uatService: UserAcceptanceTestingService;
  private logger: LoggingService;

  constructor() {
    this.uatService = new UserAcceptanceTestingService();
    this.logger = LoggingService; // LoggingService is already an instance
  }

  /**
   * Start beta tester recruitment campaign
   */
  async recruitBetaTesters(req: Request, res: Response): Promise<void> {
    try {
      // Input validation
      const {
        targetCount = 50,
        familySizeRange = [2, 6],
        ageRanges = ['45-55', '55-65', '65-75', '75+'],
        techComfortLevels = ['low', 'medium', 'high'],
        deviceTypes = ['ios', 'android', 'both']
      } = req.body;

      // Validate targetCount
      if (typeof targetCount !== 'number' || targetCount <= 0 || targetCount > 1000) {
        res.status(400).json({
          success: false,
          error: 'Invalid targetCount',
          details: 'Target count must be a number between 1 and 1000'
        });
        return;
      }

      // Validate familySizeRange
      if (!Array.isArray(familySizeRange) || familySizeRange.length !== 2 || 
          typeof familySizeRange[0] !== 'number' || typeof familySizeRange[1] !== 'number' ||
          familySizeRange[0] < 1 || familySizeRange[1] > 20 || familySizeRange[0] >= familySizeRange[1]) {
        res.status(400).json({
          success: false,
          error: 'Invalid familySizeRange',
          details: 'Family size range must be an array of two numbers [min, max] where min < max and both are between 1 and 20'
        });
        return;
      }

      // Validate ageRanges
      if (!Array.isArray(ageRanges) || ageRanges.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid ageRanges',
          details: 'Age ranges must be a non-empty array'
        });
        return;
      }

      const validAgeRanges = ['18-25', '25-35', '35-45', '45-55', '55-65', '65-75', '75+'];
      const invalidAgeRanges = ageRanges.filter(range => !validAgeRanges.includes(range));
      if (invalidAgeRanges.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid ageRanges',
          details: `Invalid age ranges: ${invalidAgeRanges.join(', ')}. Valid ranges are: ${validAgeRanges.join(', ')}`
        });
        return;
      }

      // Validate techComfortLevels
      if (!Array.isArray(techComfortLevels) || techComfortLevels.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid techComfortLevels',
          details: 'Tech comfort levels must be a non-empty array'
        });
        return;
      }

      const validTechLevels = ['low', 'medium', 'high'];
      const invalidTechLevels = techComfortLevels.filter(level => !validTechLevels.includes(level));
      if (invalidTechLevels.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid techComfortLevels',
          details: `Invalid tech comfort levels: ${invalidTechLevels.join(', ')}. Valid levels are: ${validTechLevels.

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

      // Comprehensive input validation
      if (!betaTesterId || typeof betaTesterId !== 'string' || betaTesterId.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid betaTesterId',
          details: 'Beta tester ID is required and must be a non-empty string'
        });
        return;
      }

      if (!scenarioId || typeof scenarioId !== 'string' || scenarioId.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid scenarioId',
          details: 'Scenario ID is required and must be a non-empty string'
        });
        return;
      }

      if (rating === undefined || typeof rating !== 'number' || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'Invalid rating',
          details: 'Rating is required and must be a number between 1 and 5'
        });
        return;
      }

      if (completionTime === undefined || typeof completionTime !== 'number' || completionTime < 0 || completionTime > 300) {
        res.status(400).json({
          success: false,
          error: 'Invalid completionTime',
          details: 'Completion time is required and must be a number between 0 and 300 minutes'
        });
        return;
      }

      if (completedSuccessfully === undefined || typeof completedSuccessfully !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Invalid completedSuccessfully',
          details: 'Completed successfully is required and must be a boolean'
        });
        return;
      }

      if (wouldRecommend === undefined || typeof wouldRecommend !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Invalid wouldRecommend',
          details: 'Would recommend is required and must be a boolean'
        });
        return;
      }

      // Validate usabilityIssues array
      if (!Array.isArray(usabilityIssues)) {
        res.status(400).json({
          success: false,
          error: 'Invalid usabilityIssues',
          details: 'Usability issues must be an array'
        });
        return;
      }

      // Validate each usability issue
      for (let i = 0; i < usabilityIssues.length; i++) {
        const issue = usabilityIssues[i];
        if (!issue || typeof issue !== 'object') {
          res.status(400).json({
            success: false,
            error: 'Invalid usability issue',
            details: `Usability issue at index ${i} must be an object`
          });
          return;
        }

        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!issue.severity || !validSeverities.includes(issue.severity)) {
          res.status(400).json({
            success: false,
            error: 'Invalid usability issue severity',
            details: `Usability issue at index ${i} must have a valid severity: ${validSeverities.join(', ')}`
          });
          return;
        }

        const validCategories = ['navigation', 'accessibility', 'performance', 'content', 'functionality'];
        if (!issue.category || !validCategories.includes(issue.category)) {
          res.status(400).json({
            success: false,
            error: 'Invalid usability issue category',
            details: `Usability issue at index ${i} must have a valid category: ${validCategories.join(', ')}`
          });
          return;
        }

        if (!issue.description || typeof issue.description !== 'string' || issue.description.trim().length === 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid usability issue description',
            details: `Usability issue at index ${i} must have a non-empty description`
          });
          return;
        }
      }

      // Validate text fields
      if (typeof generalFeedback !== 'string' || generalFeedback.length > 5000) {
        res.status(400).json({
          success: false,
          error: 'Invalid generalFeedback',
          details: 'General feedback must be a string with maximum 5000 characters'
        });
        return;
      }

      if (typeof suggestions !== 'string' || suggestions.length > 5000) {
        res.status(400).json({
          success: false,
          error: 'Invalid suggestions',
          details: 'Suggestions must be a string with maximum 5000 characters'
        });
        return;
      }

      // Sanitize input data
      const feedbackData = {
        betaTesterId: betaTesterId.trim(),
        scenarioId: scenarioId.trim(),
        rating: Math.round(rating * 10) / 10, // Round to 1 decimal place
        completionTime: Math.round(completionTime),
        completedSuccessfully,
        usabilityIssues: usabilityIssues.map(issue => ({
          ...issue,
          description: issue.description.trim(),
          location: issue.location ? issue.location.trim() : '',
          reproductionSteps: Array.isArray(issue.reproductionSteps) 
            ? issue.reproductionSteps.map(step => step.trim()).filter(step => step.length > 0)
            : []
        })),
        generalFeedback: generalFeedback.trim(),
        suggestions: suggestions.trim(),
        wouldRecommend
      };

      const feedback = await this.uatService.collectFeedback(feedbackData);

      this.logger.info('User feedback submitted successfully', {
        betaTesterId: feedbackData.betaTesterId,
        scenarioId: feedbackData.scenarioId,
        rating: feedbackData.rating,
        completedSuccessfully: feedbackData.completedSuccessfully
      });

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: feedback
      });
    } catch (error) {
      this.logger.error('Failed to submit feedback', {
        error: error.message,
        stack: error.stack,
        requestBody: req.body
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to submit feedback',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
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