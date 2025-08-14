import { BaseService } from './base-service';
import { Project } from '../models/project';
import { Story } from '../models/story';
import { Interaction } from '../models/interaction';
import { ChapterSummary } from '../models/chapter-summary';
import { ExportRequest } from '../models/export-request';
import { LoggingService } from './logging-service';
import { StorageService } from './storage-service';
import { AnalyticsService } from './analytics-service';

export interface RetentionPolicy {
  name: string;
  description: string;
  retentionPeriodDays: number;
  applyToArchived: boolean;
  applyToActive: boolean;
  dataTypes: string[];
  enabled: boolean;
}

export interface RetentionReport {
  policy: RetentionPolicy;
  executedAt: Date;
  itemsProcessed: number;
  itemsDeleted: number;
  storageFreed: number; // in bytes
  errors: string[];
}

/**
 * Service for managing data retention policies and cleanup
 */
export class DataRetentionService extends BaseService {
  private loggingService: LoggingService;
  private storageService: StorageService;

  // Default retention policies
  private readonly DEFAULT_POLICIES: RetentionPolicy[] = [
    {
      name: 'archived_project_cleanup',
      description: 'Clean up archived projects after 7 years',
      retentionPeriodDays: 7 * 365, // 7 years
      applyToArchived: true,
      applyToActive: false,
      dataTypes: ['projects', 'stories', 'interactions', 'chapter_summaries'],
      enabled: true,
    },
    {
      name: 'export_request_cleanup',
      description: 'Clean up old export requests after 90 days',
      retentionPeriodDays: 90,
      applyToArchived: true,
      applyToActive: true,
      dataTypes: ['export_requests'],
      enabled: true,
    },
    {
      name: 'temporary_files_cleanup',
      description: 'Clean up temporary files after 30 days',
      retentionPeriodDays: 30,
      applyToArchived: true,
      applyToActive: true,
      dataTypes: ['temp_files'],
      enabled: true,
    },
    {
      name: 'analytics_events_cleanup',
      description: 'Clean up analytics events after 2 years',
      retentionPeriodDays: 2 * 365, // 2 years
      applyToArchived: true,
      applyToActive: true,
      dataTypes: ['analytics_events'],
      enabled: true,
    },
  ];

  constructor() {
    super();
    this.loggingService = LoggingService; // LoggingService is already an instance
    this.storageService = new StorageService();
  }

  /**
   * Get all retention policies
   */
  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.DEFAULT_POLICIES];
  }

  /**
   * Get a specific retention policy by name
   */
  getRetentionPolicy(name: string): RetentionPolicy | undefined {
    return this.DEFAULT_POLICIES.find(policy => policy.name === name);
  }

  /**
   * Execute all enabled retention policies
   */
  async executeAllPolicies(): Promise<RetentionReport[]> {
    const reports: RetentionReport[] = [];
    const enabledPolicies = this.DEFAULT_POLICIES.filter(policy => policy.enabled);

    this.loggingService.info('Starting data retention policy execution', {
      policyCount: enabledPolicies.length,
    });

    for (const policy of enabledPolicies) {
      try {
        const report = await this.executePolicy(policy);
        reports.push(report);
      } catch (error) {
        this.loggingService.error('Error executing retention policy', {
          policyName: policy.name,
          error: error as Error,
        });

        reports.push({
          policy,
          executedAt: new Date(),
          itemsProcessed: 0,
          itemsDeleted: 0,
          storageFreed: 0,
          errors: [(error as Error).message],
        });
      }
    }

    this.loggingService.info('Completed data retention policy execution', {
      totalReports: reports.length,
      totalItemsDeleted: reports.reduce((sum, report) => sum + report.itemsDeleted, 0),
      totalStorageFreed: reports.reduce((sum, report) => sum + report.storageFreed, 0),
    });

    return reports;
  }

  /**
   * Execute a specific retention policy
   */
  async executePolicy(policy: RetentionPolicy): Promise<RetentionReport> {
    const report: RetentionReport = {
      policy,
      executedAt: new Date(),
      itemsProcessed: 0,
      itemsDeleted: 0,
      storageFreed: 0,
      errors: [],
    };

    this.loggingService.info('Executing retention policy', {
      policyName: policy.name,
      retentionPeriodDays: policy.retentionPeriodDays,
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);

    try {
      for (const dataType of policy.dataTypes) {
        const result = await this.processDataType(dataType, cutoffDate, policy);
        report.itemsProcessed += result.processed;
        report.itemsDeleted += result.deleted;
        report.storageFreed += result.storageFreed;
        report.errors.push(...result.errors);
      }
    } catch (error) {
      report.errors.push((error as Error).message);
    }

    return report;
  }

  /**
   * Process a specific data type for retention
   */
  private async processDataType(
    dataType: string,
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{
    processed: number;
    deleted: number;
    storageFreed: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      deleted: 0,
      storageFreed: 0,
      errors: [],
    };

    switch (dataType) {
      case 'projects':
        return await this.cleanupProjects(cutoffDate, policy);
      
      case 'stories':
        return await this.cleanupStories(cutoffDate, policy);
      
      case 'interactions':
        return await this.cleanupInteractions(cutoffDate, policy);
      
      case 'chapter_summaries':
        return await this.cleanupChapterSummaries(cutoffDate, policy);
      
      case 'export_requests':
        return await this.cleanupExportRequests(cutoffDate, policy);
      
      case 'temp_files':
        return await this.cleanupTempFiles(cutoffDate, policy);
      
      case 'analytics_events':
        return await this.cleanupAnalyticsEvents(cutoffDate, policy);
      
      default:
        result.errors.push(`Unknown data type: ${dataType}`);
        return result;
    }
  }

  /**
   * Clean up old archived projects
   */
  private async cleanupProjects(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      const query = Project.query().where('updated_at', '<', cutoffDate);
      
      if (policy.applyToArchived && !policy.applyToActive) {
        query.where('status', 'archived');
      } else if (policy.applyToActive && !policy.applyToArchived) {
        query.where('status', 'active');
      }

      const projects = await query;
      result.processed = projects.length;

      for (const project of projects) {
        try {
          // Calculate storage used by project
          const storageUsed = await this.calculateProjectStorageUsage(project.id);
          
          // Delete project and all related data
          await this.deleteProjectCompletely(project.id);
          
          result.deleted++;
          result.storageFreed += storageUsed;

          this.loggingService.info('Project deleted by retention policy', {
            projectId: project.id,
            projectName: project.name,
            policyName: policy.name,
            storageFreed: storageUsed,
          });

          // Track analytics
          AnalyticsService.track('project_deleted_by_retention', {
            projectId: project.id,
            policyName: policy.name,
            storageFreed: storageUsed,
          });

        } catch (error) {
          result.errors.push(`Failed to delete project ${project.id}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to query projects: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Clean up old stories
   */
  private async cleanupStories(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      const stories = await Story.query()
        .where('created_at', '<', cutoffDate)
        .joinRelated('project')
        .where(builder => {
          if (policy.applyToArchived && !policy.applyToActive) {
            builder.where('project.status', 'archived');
          } else if (policy.applyToActive && !policy.applyToArchived) {
            builder.where('project.status', 'active');
          }
        });

      result.processed = stories.length;

      for (const story of stories) {
        try {
          // Calculate storage used by story (audio files, photos)
          let storageUsed = 0;
          
          if (story.audioUrl) {
            storageUsed += await this.storageService.getFileSize(story.audioUrl);
          }
          
          if (story.photoUrl) {
            storageUsed += await this.storageService.getFileSize(story.photoUrl);
          }

          // Delete story files from storage
          if (story.audioUrl) {
            await this.storageService.deleteFile(story.audioUrl);
          }
          
          if (story.photoUrl) {
            await this.storageService.deleteFile(story.photoUrl);
          }

          // Delete story from database
          await Story.query().deleteById(story.id);
          
          result.deleted++;
          result.storageFreed += storageUsed;

        } catch (error) {
          result.errors.push(`Failed to delete story ${story.id}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to query stories: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Clean up old interactions
   */
  private async cleanupInteractions(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      const interactions = await Interaction.query()
        .where('created_at', '<', cutoffDate)
        .joinRelated('story.project')
        .where(builder => {
          if (policy.applyToArchived && !policy.applyToActive) {
            builder.where('story:project.status', 'archived');
          } else if (policy.applyToActive && !policy.applyToArchived) {
            builder.where('story:project.status', 'active');
          }
        });

      result.processed = interactions.length;

      if (interactions.length > 0) {
        await Interaction.query()
          .whereIn('id', interactions.map(i => i.id))
          .delete();
        
        result.deleted = interactions.length;
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup interactions: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Clean up old chapter summaries
   */
  private async cleanupChapterSummaries(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      const summaries = await ChapterSummary.query()
        .where('created_at', '<', cutoffDate)
        .joinRelated('project')
        .where(builder => {
          if (policy.applyToArchived && !policy.applyToActive) {
            builder.where('project.status', 'archived');
          } else if (policy.applyToActive && !policy.applyToArchived) {
            builder.where('project.status', 'active');
          }
        });

      result.processed = summaries.length;

      if (summaries.length > 0) {
        await ChapterSummary.query()
          .whereIn('id', summaries.map(s => s.id))
          .delete();
        
        result.deleted = summaries.length;
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup chapter summaries: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Clean up old export requests
   */
  private async cleanupExportRequests(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      const exportRequests = await ExportRequest.query()
        .where('created_at', '<', cutoffDate)
        .where('status', 'completed'); // Only delete completed exports

      result.processed = exportRequests.length;

      for (const exportRequest of exportRequests) {
        try {
          let storageUsed = 0;

          // Delete export files from storage
          if (exportRequest.downloadUrl) {
            storageUsed += await this.storageService.getFileSize(exportRequest.downloadUrl);
            await this.storageService.deleteFile(exportRequest.downloadUrl);
          }

          // Delete export request from database
          await ExportRequest.query().deleteById(exportRequest.id);
          
          result.deleted++;
          result.storageFreed += storageUsed;

        } catch (error) {
          result.errors.push(`Failed to delete export request ${exportRequest.id}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to query export requests: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      // This would depend on how temporary files are tracked
      // For now, we'll implement a basic cleanup of temp directory
      const tempFiles = await this.storageService.listTempFiles(cutoffDate);
      result.processed = tempFiles.length;

      for (const tempFile of tempFiles) {
        try {
          const fileSize = await this.storageService.getFileSize(tempFile);
          await this.storageService.deleteFile(tempFile);
          
          result.deleted++;
          result.storageFreed += fileSize;
        } catch (error) {
          result.errors.push(`Failed to delete temp file ${tempFile}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup temp files: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Clean up old analytics events
   */
  private async cleanupAnalyticsEvents(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; deleted: number; storageFreed: number; errors: string[] }> {
    const result = { processed: 0, deleted: 0, storageFreed: 0, errors: [] };

    try {
      // Clean up in-memory analytics events
      AnalyticsService.clearOldEvents(cutoffDate);
      
      // If analytics events were stored in database, we would clean them up here
      // For now, we just report that we cleaned the in-memory events
      result.processed = 1;
      result.deleted = 1;
    } catch (error) {
      result.errors.push(`Failed to cleanup analytics events: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Calculate total storage usage for a project
   */
  private async calculateProjectStorageUsage(projectId: string): Promise<number> {
    let totalSize = 0;

    try {
      // Get all stories for the project
      const stories = await Story.query().where('projectId', projectId);

      for (const story of stories) {
        if (story.audioUrl) {
          totalSize += await this.storageService.getFileSize(story.audioUrl);
        }
        if (story.photoUrl) {
          totalSize += await this.storageService.getFileSize(story.photoUrl);
        }
      }

      // Get export files for the project
      const exportRequests = await ExportRequest.query().where('projectId', projectId);
      for (const exportRequest of exportRequests) {
        if (exportRequest.downloadUrl) {
          totalSize += await this.storageService.getFileSize(exportRequest.downloadUrl);
        }
      }
    } catch (error) {
      this.loggingService.warn('Error calculating project storage usage', {
        projectId,
        error: error as Error,
      });
    }

    return totalSize;
  }

  /**
   * Completely delete a project and all related data
   */
  private async deleteProjectCompletely(projectId: string): Promise<void> {
    const trx = await this.db.transaction();

    try {
      // Delete in correct order to respect foreign key constraints
      
      // 1. Delete interactions
      await Interaction.query(trx)
        .whereIn('storyId', 
          Story.query().select('id').where('projectId', projectId)
        )
        .delete();

      // 2. Delete chapter summaries
      await ChapterSummary.query(trx)
        .where('projectId', projectId)
        .delete();

      // 3. Delete stories and their files
      const stories = await Story.query(trx).where('projectId', projectId);
      for (const story of stories) {
        if (story.audioUrl) {
          await this.storageService.deleteFile(story.audioUrl);
        }
        if (story.photoUrl) {
          await this.storageService.deleteFile(story.photoUrl);
        }
      }
      await Story.query(trx).where('projectId', projectId).delete();

      // 4. Delete export requests and their files
      const exportRequests = await ExportRequest.query(trx).where('projectId', projectId);
      for (const exportRequest of exportRequests) {
        if (exportRequest.downloadUrl) {
          await this.storageService.deleteFile(exportRequest.downloadUrl);
        }
      }
      await ExportRequest.query(trx).where('projectId', projectId).delete();

      // 5. Delete project roles
      await this.db('project_roles').where('project_id', projectId).del();

      // 6. Delete subscriptions
      await this.db('subscriptions').where('project_id', projectId).del();

      // 7. Delete invitations
      await this.db('invitations').where('project_id', projectId).del();

      // 8. Finally delete the project
      await Project.query(trx).deleteById(projectId);

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Get retention policy status and next execution times
   */
  getRetentionStatus(): {
    policies: Array<RetentionPolicy & { nextExecution?: Date }>;
    lastExecution?: Date;
    totalItemsRetained: number;
  } {
    const policies = this.getRetentionPolicies().map(policy => ({
      ...policy,
      nextExecution: this.calculateNextExecution(policy),
    }));

    return {
      policies,
      lastExecution: undefined, // This would be stored in database in real implementation
      totalItemsRetained: 0, // This would be calculated from retention history
    };
  }

  /**
   * Calculate next execution time for a policy (daily execution)
   */
  private calculateNextExecution(policy: RetentionPolicy): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2 AM UTC
    return tomorrow;
  }

  /**
   * Validate retention policy configuration
   */
  validatePolicy(policy: RetentionPolicy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!policy.name || policy.name.trim().length === 0) {
      errors.push('Policy name is required');
    }

    if (policy.retentionPeriodDays < 1) {
      errors.push('Retention period must be at least 1 day');
    }

    if (policy.retentionPeriodDays > 10 * 365) {
      errors.push('Retention period cannot exceed 10 years');
    }

    if (!policy.dataTypes || policy.dataTypes.length === 0) {
      errors.push('At least one data type must be specified');
    }

    const validDataTypes = ['projects', 'stories', 'interactions', 'chapter_summaries', 'export_requests', 'temp_files', 'analytics_events'];
    const invalidDataTypes = policy.dataTypes.filter(type => !validDataTypes.includes(type));
    if (invalidDataTypes.length > 0) {
      errors.push(`Invalid data types: ${invalidDataTypes.join(', ')}`);
    }

    if (!policy.applyToArchived && !policy.applyToActive) {
      errors.push('Policy must apply to either archived or active projects (or both)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}