import { Request, Response } from 'express';
import { ArchivalExportService } from '../services/archival-export-service';
import { ArchivalService } from '../services/archival-service';
import { LoggingService } from '../services/logging-service';
import { ArchivalExportOptions } from '@saga/shared/types';

/**
 * Controller for enhanced archival export functionality
 */
export class ArchivalExportController {
  /**
   * Create a new archival export
   */
  static async createArchivalExport(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Validate export options
      const options: ArchivalExportOptions = {
        includeAudio: req.body.includeAudio ?? true,
        includePhotos: req.body.includePhotos ?? true,
        includeTranscripts: req.body.includeTranscripts ?? true,
        includeInteractions: req.body.includeInteractions ?? true,
        includeChapterSummaries: req.body.includeChapterSummaries ?? true,
        includeMetadata: req.body.includeMetadata ?? true,
        format: req.body.format || 'zip',
        dateRange: req.body.dateRange ? {
          startDate: new Date(req.body.dateRange.startDate),
          endDate: new Date(req.body.dateRange.endDate),
        } : undefined,
        chapters: req.body.chapters,
      };

      // Validate format
      if (!['zip', 'json'].includes(options.format)) {
        res.status(400).json({
          success: false,
          error: 'Format must be either "zip" or "json"',
        });
        return;
      }

      // Validate date range if provided
      if (options.dateRange) {
        if (isNaN(options.dateRange.startDate.getTime()) || isNaN(options.dateRange.endDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid date format in dateRange',
          });
          return;
        }

        if (options.dateRange.startDate >= options.dateRange.endDate) {
          res.status(400).json({
            success: false,
            error: 'Start date must be before end date',
          });
          return;
        }
      }

      // Check if project is accessible (archived projects get enhanced export)
      const archivalService = new ArchivalService();
      const permissions = await archivalService.getArchivalPermissions(projectId, userId);

      if (!permissions.canExport) {
        res.status(403).json({
          success: false,
          error: 'Export permission denied',
        });
        return;
      }

      const exportService = new ArchivalExportService();
      const exportId = await exportService.createArchivalExport(projectId, userId, options);

      res.json({
        success: true,
        data: {
          exportId,
          message: 'Export started. You will be notified when it\'s ready.',
        },
      });
    } catch (error) {
      LoggingService.error('Error creating archival export', {
        projectId: req.params.projectId,
        userId: req.user?.id,
        error: error as Error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create export',
      });
    }
  }

  /**
   * Get export status
   */
  static async getExportStatus(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const exportService = new ArchivalExportService();
      const exportStatus = await exportService.getExportStatus(exportId);

      res.json({
        success: true,
        data: exportStatus,
      });
    } catch (error) {
      LoggingService.error('Error getting export status', {
        exportId: req.params.exportId,
        userId: req.user?.id,
        error: error as Error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get export status',
      });
    }
  }

  /**
   * Download export file
   */
  static async downloadExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const exportService = new ArchivalExportService();
      const exportStatus = await exportService.getExportStatus(exportId);

      if (exportStatus.status !== 'ready') {
        res.status(400).json({
          success: false,
          error: 'Export is not ready for download',
        });
        return;
      }

      if (!exportStatus.downloadUrl) {
        res.status(404).json({
          success: false,
          error: 'Download URL not available',
        });
        return;
      }

      // Check if export has expired
      if (exportStatus.expiresAt && new Date() > new Date(exportStatus.expiresAt)) {
        res.status(410).json({
          success: false,
          error: 'Export has expired',
        });
        return;
      }

      // Redirect to the actual download URL
      res.redirect(exportStatus.downloadUrl);
    } catch (error) {
      LoggingService.error('Error downloading export', {
        exportId: req.params.exportId,
        userId: req.user?.id,
        error: error as Error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to download export',
      });
    }
  }

  /**
   * Get all exports for a project
   */
  static async getProjectExports(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Check if user has access to this project
      const archivalService = new ArchivalService();
      const permissions = await archivalService.getArchivalPermissions(projectId, userId);

      if (!permissions.canExport) {
        res.status(403).json({
          success: false,
          error: 'Export permission denied',
        });
        return;
      }

      const exportService = new ArchivalExportService();
      const exports = await exportService.getProjectExports(projectId);

      res.json({
        success: true,
        data: exports,
      });
    } catch (error) {
      LoggingService.error('Error getting project exports', {
        projectId: req.params.projectId,
        userId: req.user?.id,
        error: error as Error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get project exports',
      });
    }
  }

  /**
   * Delete an export
   */
  static async deleteExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const exportService = new ArchivalExportService();
      await exportService.deleteExport(exportId);

      res.json({
        success: true,
        message: 'Export deleted successfully',
      });
    } catch (error) {
      LoggingService.error('Error deleting export', {
        exportId: req.params.exportId,
        userId: req.user?.id,
        error: error as Error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete export',
      });
    }
  }

  /**
   * Get export options and capabilities for a project
   */
  static async getExportOptions(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Check if user has access to this project
      const archivalService = new ArchivalService();
      const permissions = await archivalService.getArchivalPermissions(projectId, userId);

      if (!permissions.canExport) {
        res.status(403).json({
          success: false,
          error: 'Export permission denied',
        });
        return;
      }

      // Get project status to determine available options
      const projectStatus = await archivalService.checkProjectStatus(projectId);

      const options = {
        formats: ['zip', 'json'],
        includeOptions: {
          audio: true,
          photos: true,
          transcripts: true,
          interactions: true,
          chapterSummaries: true,
          metadata: true,
        },
        filterOptions: {
          dateRange: true,
          chapters: true,
        },
        projectStatus: {
          isArchived: projectStatus.isArchived,
          isActive: projectStatus.isActive,
          subscriptionExpiresAt: projectStatus.subscriptionExpiresAt,
        },
        limitations: {
          maxExportsPerDay: projectStatus.isArchived ? 10 : 5,
          retentionDays: projectStatus.isArchived ? 30 : 7,
        },
      };

      res.json({
        success: true,
        data: options,
      });
    } catch (error) {
      LoggingService.error('Error getting export options', {
        projectId: req.params.projectId,
        userId: req.user?.id,
        error: error as Error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get export options',
      });
    }
  }
}