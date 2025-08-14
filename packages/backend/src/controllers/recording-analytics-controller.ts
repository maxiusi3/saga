import { Request, Response } from 'express';
import { RecordingAnalyticsService } from '../services/recording-analytics-service';
import { RecordingMetadata, RecordingQuality } from '@saga/shared';

export class RecordingAnalyticsController {
  /**
   * Track a recording analytics event
   * POST /api/recording-analytics/events
   */
  async trackEvent(req: Request, res: Response): Promise<void> {
    try {
      const {
        sessionId,
        projectId,
        eventType,
        metadata,
        quality,
        duration,
        retryCount,
        reviewDuration,
      } = req.body;

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!sessionId || !projectId || !eventType) {
        res.status(400).json({ 
          error: 'Missing required fields: sessionId, projectId, eventType' 
        });
        return;
      }

      const validEventTypes = [
        'recording_started',
        'recording_stopped', 
        'recording_reviewed',
        'recording_sent',
        'recording_discarded',
        'recording_retry'
      ];

      if (!validEventTypes.includes(eventType)) {
        res.status(400).json({ 
          error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` 
        });
        return;
      }

      await RecordingAnalyticsService.trackRecordingEvent({
        userId,
        projectId,
        sessionId,
        eventType,
        metadata,
        quality,
        duration,
        retryCount,
        reviewDuration,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error tracking recording event:', error);
      res.status(500).json({ 
        error: 'Failed to track recording event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recording completion metrics
   * GET /api/recording-analytics/completion-metrics
   */
  async getCompletionMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { projectId, startDate, endDate } = req.query;

      let dateRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };

        if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      const metrics = await RecordingAnalyticsService.getCompletionMetrics(
        userId,
        projectId as string,
        dateRange
      );

      res.status(200).json(metrics);
    } catch (error) {
      console.error('Error getting completion metrics:', error);
      res.status(500).json({ 
        error: 'Failed to get completion metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recording quality metrics
   * GET /api/recording-analytics/quality-metrics
   */
  async getQualityMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { projectId, startDate, endDate } = req.query;

      let dateRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };

        if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      const metrics = await RecordingAnalyticsService.getQualityMetrics(
        userId,
        projectId as string,
        dateRange
      );

      res.status(200).json(metrics);
    } catch (error) {
      console.error('Error getting quality metrics:', error);
      res.status(500).json({ 
        error: 'Failed to get quality metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get device and environment metrics
   * GET /api/recording-analytics/device-metrics
   */
  async getDeviceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { projectId, startDate, endDate } = req.query;

      let dateRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };

        if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      const metrics = await RecordingAnalyticsService.getDeviceMetrics(
        userId,
        projectId as string,
        dateRange
      );

      res.status(200).json(metrics);
    } catch (error) {
      console.error('Error getting device metrics:', error);
      res.status(500).json({ 
        error: 'Failed to get device metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recording insights and recommendations
   * GET /api/recording-analytics/insights
   */
  async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { projectId } = req.query;

      const insights = await RecordingAnalyticsService.getRecordingInsights(
        userId,
        projectId as string
      );

      res.status(200).json(insights);
    } catch (error) {
      console.error('Error getting recording insights:', error);
      res.status(500).json({ 
        error: 'Failed to get recording insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   * GET /api/recording-analytics/dashboard
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { projectId, startDate, endDate } = req.query;

      let dateRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };

        if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      // Get all metrics in parallel
      const [completionMetrics, qualityMetrics, deviceMetrics, insights] = await Promise.all([
        RecordingAnalyticsService.getCompletionMetrics(userId, projectId as string, dateRange),
        RecordingAnalyticsService.getQualityMetrics(userId, projectId as string, dateRange),
        RecordingAnalyticsService.getDeviceMetrics(userId, projectId as string, dateRange),
        RecordingAnalyticsService.getRecordingInsights(userId, projectId as string),
      ]);

      const dashboardData = {
        completionMetrics,
        qualityMetrics,
        deviceMetrics,
        insights,
        dateRange,
        generatedAt: new Date(),
      };

      res.status(200).json(dashboardData);
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({ 
        error: 'Failed to get dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get detailed duration analysis
   * GET /api/recording-analytics/duration-analysis
   */
  async getDurationAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { projectId, startDate, endDate } = req.query;

      let dateRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };

        if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      const durationAnalysis = await RecordingAnalyticsService.getDurationAnalysis(
        userId,
        projectId as string,
        dateRange
      );

      res.status(200).json(durationAnalysis);
    } catch (error) {
      console.error('Error getting duration analysis:', error);
      res.status(500).json({ 
        error: 'Failed to get duration analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const recordingAnalyticsController = new RecordingAnalyticsController();