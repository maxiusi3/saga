import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics-service';
import { ArchivalService } from '../services/archival-service';
import { LoggingService } from '../services/logging-service';

/**
 * Controller for archival analytics and reporting endpoints
 */
export class ArchivalAnalyticsController {
  /**
   * Get archival metrics overview
   */
  static async getArchivalMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await AnalyticsService.getArchivalMetrics();
      
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      LoggingService.error('Error getting archival metrics', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get archival metrics',
      });
    }
  }

  /**
   * Get subscription health metrics
   */
  static async getSubscriptionHealthMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await AnalyticsService.getSubscriptionHealthMetrics();
      
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      LoggingService.error('Error getting subscription health metrics', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get subscription health metrics',
      });
    }
  }

  /**
   * Generate archival report for a specific period
   */
  static async generateArchivalReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format',
        });
        return;
      }

      if (start >= end) {
        res.status(400).json({
          success: false,
          error: 'Start date must be before end date',
        });
        return;
      }

      const report = await AnalyticsService.generateArchivalReport(start, end);
      
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      LoggingService.error('Error generating archival report', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate archival report',
      });
    }
  }

  /**
   * Get projects approaching expiry
   */
  static async getProjectsApproachingExpiry(req: Request, res: Response): Promise<void> {
    try {
      const { daysThreshold } = req.query;
      const threshold = daysThreshold ? parseInt(daysThreshold as string) : 7;

      if (isNaN(threshold) || threshold < 1 || threshold > 365) {
        res.status(400).json({
          success: false,
          error: 'Days threshold must be a number between 1 and 365',
        });
        return;
      }

      const archivalService = new ArchivalService();
      const projects = await archivalService.getProjectsApproachingExpiry(threshold);
      
      // Add status information for each project
      const projectsWithStatus = await Promise.all(
        projects.map(async (project) => {
          const status = await archivalService.checkProjectStatus(project.id);
          return {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            facilitatorCount: project.facilitators?.length || 0,
            status,
          };
        })
      );

      res.json({
        success: true,
        data: {
          threshold,
          projects: projectsWithStatus,
          count: projectsWithStatus.length,
        },
      });
    } catch (error) {
      LoggingService.error('Error getting projects approaching expiry', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get projects approaching expiry',
      });
    }
  }

  /**
   * Get archival dashboard data (combined metrics for admin dashboard)
   */
  static async getArchivalDashboard(req: Request, res: Response): Promise<void> {
    try {
      const [
        archivalMetrics,
        subscriptionHealth,
        businessMetrics,
      ] = await Promise.all([
        AnalyticsService.getArchivalMetrics(),
        AnalyticsService.getSubscriptionHealthMetrics(),
        AnalyticsService.getBusinessMetrics(),
      ]);

      // Get recent archival events
      const recentArchivalEvents = AnalyticsService.getEventsByName('project_archived', 10);
      const recentRenewalEvents = AnalyticsService.getEventsByName('subscription_renewed', 10);

      res.json({
        success: true,
        data: {
          archivalMetrics,
          subscriptionHealth,
          businessMetrics: {
            dailyActiveUsers: businessMetrics.dailyActiveUsers,
            conversionRate: businessMetrics.conversionRate,
            userRetentionRate: businessMetrics.userRetentionRate,
          },
          recentActivity: {
            archivals: recentArchivalEvents.map(event => ({
              timestamp: event.timestamp,
              projectId: event.properties.projectId,
              projectName: event.properties.projectName,
              reason: event.properties.reason,
            })),
            renewals: recentRenewalEvents.map(event => ({
              timestamp: event.timestamp,
              projectId: event.properties.projectId,
              projectName: event.properties.projectName,
              method: event.properties.renewalMethod,
            })),
          },
        },
      });
    } catch (error) {
      LoggingService.error('Error getting archival dashboard data', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get archival dashboard data',
      });
    }
  }

  /**
   * Export archival analytics data
   */
  static async exportArchivalData(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, format } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format',
        });
        return;
      }

      const exportFormat = (format as string) || 'json';
      if (!['json', 'csv'].includes(exportFormat)) {
        res.status(400).json({
          success: false,
          error: 'Format must be json or csv',
        });
        return;
      }

      // Get archival events for the period
      const archivalEvents = AnalyticsService.exportAnalytics(start, end)
        .filter(event => ['project_archived', 'subscription_renewed', 'expiry_warning_sent'].includes(event.name));

      if (exportFormat === 'csv') {
        // Convert to CSV format
        const csvHeader = 'timestamp,event,userId,projectId,projectName,properties\n';
        const csvRows = archivalEvents.map(event => {
          const properties = JSON.stringify(event.properties).replace(/"/g, '""');
          return `${event.timestamp.toISOString()},${event.name},${event.userId || ''},${event.properties.projectId || ''},${event.properties.projectName || ''},"${properties}"`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="archival-data-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`);
        res.send(csvHeader + csvRows);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="archival-data-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.json"`);
        res.json({
          period: { start, end },
          events: archivalEvents,
          summary: {
            totalEvents: archivalEvents.length,
            archivals: archivalEvents.filter(e => e.name === 'project_archived').length,
            renewals: archivalEvents.filter(e => e.name === 'subscription_renewed').length,
            warnings: archivalEvents.filter(e => e.name === 'expiry_warning_sent').length,
          },
        });
      }
    } catch (error) {
      LoggingService.error('Error exporting archival data', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to export archival data',
      });
    }
  }
}