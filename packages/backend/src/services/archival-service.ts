import { BaseService } from './base-service';
import { Subscription } from '../models/subscription';
import { Project } from '../models/project';
import { User } from '../models/user';
import { ProjectRole } from '../models/project-role';
import { NotificationService } from './notification-service';
import { LoggingService } from './logging-service';
import { AnalyticsService } from './analytics-service';

export interface ProjectStatus {
  isActive: boolean;
  isArchived: boolean;
  subscriptionExpiresAt: Date | null;
  daysUntilExpiry?: number;
}

export interface ArchivalPermissions {
  canView: boolean;
  canExport: boolean;
  canRecord: boolean;
  canComment: boolean;
  canEdit: boolean;
}

export class ArchivalService extends BaseService {
  private notificationService: NotificationService;
  private loggingService: LoggingService;

  constructor() {
    super();
    this.notificationService = new NotificationService();
    this.loggingService = LoggingService; // LoggingService is already an instance
  }

  /**
   * Check the current status of a project's subscription and archival state
   */
  async checkProjectStatus(projectId: string): Promise<ProjectStatus> {
    try {
      const project = await Project.query()
        .findById(projectId)
        .withGraphFetched('subscription');

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // If project is already marked as archived
      if (project.status === 'archived') {
        return {
          isActive: false,
          isArchived: true,
          subscriptionExpiresAt: project.subscription?.currentPeriodEnd || null
        };
      }

      // Check subscription status
      if (!project.subscription || !project.subscription.currentPeriodEnd) {
        // No subscription found - should not happen in normal flow
        this.loggingService.warn('Project without subscription found', { projectId });
        return {
          isActive: false,
          isArchived: false,
          subscriptionExpiresAt: null
        };
      }

      const now = new Date();
      const expiryDate = new Date(project.subscription.currentPeriodEnd);
      const isExpired = now > expiryDate;

      if (isExpired && project.status === 'active') {
        // Subscription has expired but project hasn't been archived yet
        await this.transitionToArchival(projectId);
        return {
          isActive: false,
          isArchived: true,
          subscriptionExpiresAt: expiryDate
        };
      }

      // Calculate days until expiry
      const msUntilExpiry = expiryDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));

      return {
        isActive: !isExpired,
        isArchived: false,
        subscriptionExpiresAt: expiryDate,
        daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0
      };

    } catch (error) {
      this.loggingService.error('Error checking project status', { projectId, error });
      throw error;
    }
  }

  /**
   * Transition a project to archival mode
   */
  async transitionToArchival(projectId: string): Promise<void> {
    const trx = await this.db.transaction();

    try {
      // Update project status to archived
      await Project.query(trx)
        .findById(projectId)
        .patch({ status: 'archived', updatedAt: new Date() });

      // Log the archival transition
      this.loggingService.info('Project transitioned to archival mode', { projectId });

      // Get all project members for notifications
      const projectRoles = await ProjectRole.query(trx)
        .where('projectId', projectId)
        .withGraphFetched('user');

      const project = await Project.query(trx)
        .findById(projectId);

      // Send archival notifications to all project members
      for (const role of projectRoles) {
        if (role.user) {
          await this.notificationService.sendArchivalNotification(
            role.user.id,
            projectId,
            project?.name || 'Untitled Project'
          );

          // Track archival analytics
          AnalyticsService.trackArchivalTransition(
            role.user.id,
            projectId,
            project?.name || 'Untitled Project',
            'expired'
          );
        }
      }

      await trx.commit();

    } catch (error) {
      await trx.rollback();
      this.loggingService.error('Error transitioning project to archival', { projectId, error });
      throw error;
    }
  }

  /**
   * Renew a project's subscription and reactivate it
   */
  async renewSubscription(projectId: string): Promise<void> {
    const trx = await this.db.transaction();

    try {
      // Update project status back to active
      await Project.query(trx)
        .findById(projectId)
        .patch({ status: 'active', updatedAt: new Date() });

      // Update subscription with new period end (1 year from now)
      const newPeriodEnd = new Date();
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);

      await Subscription.query(trx)
        .where('projectId', projectId)
        .patch({
          status: 'active',
          currentPeriodEnd: newPeriodEnd,
          updatedAt: new Date()
        });

      this.loggingService.info('Project subscription renewed', { projectId, newPeriodEnd });

      // Get all project members for notifications
      const projectRoles = await ProjectRole.query(trx)
        .where('projectId', projectId)
        .withGraphFetched('user');

      const project = await Project.query(trx)
        .findById(projectId);

      // Send renewal notifications to all project members
      for (const role of projectRoles) {
        if (role.user) {
          await this.notificationService.sendSubscriptionRenewalNotification(
            role.user.id,
            projectId,
            project?.name || 'Untitled Project',
            newPeriodEnd
          );

          // Track renewal analytics
          AnalyticsService.trackSubscriptionRenewal(
            role.user.id,
            projectId,
            project?.name || 'Untitled Project',
            'manual'
          );
        }
      }

      await trx.commit();

    } catch (error) {
      await trx.rollback();
      this.loggingService.error('Error renewing subscription', { projectId, error });
      throw error;
    }
  }

  /**
   * Get archival permissions for a user in a project
   */
  async getArchivalPermissions(projectId: string, userId: string): Promise<ArchivalPermissions> {
    try {
      const projectStatus = await this.checkProjectStatus(projectId);
      
      // Check if user has access to this project
      const userRole = await ProjectRole.query()
        .where('projectId', projectId)
        .where('userId', userId)
        .first();

      if (!userRole) {
        // User has no access to this project
        return {
          canView: false,
          canExport: false,
          canRecord: false,
          canComment: false,
          canEdit: false
        };
      }

      // If project is active, all permissions are granted
      if (projectStatus.isActive) {
        return {
          canView: true,
          canExport: true,
          canRecord: true,
          canComment: true,
          canEdit: true
        };
      }

      // If project is archived, only view and export are allowed
      if (projectStatus.isArchived) {
        return {
          canView: true,
          canExport: true,
          canRecord: false,
          canComment: false,
          canEdit: false
        };
      }

      // Default to no permissions
      return {
        canView: false,
        canExport: false,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

    } catch (error) {
      this.loggingService.error('Error getting archival permissions', { projectId, userId, error });
      throw error;
    }
  }

  /**
   * Get projects that are approaching expiry (for proactive notifications)
   */
  async getProjectsApproachingExpiry(daysThreshold: number = 7): Promise<Project[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const projects = await Project.query()
        .where('status', 'active')
        .joinRelated('subscription')
        .where('subscription.currentPeriodEnd', '<=', thresholdDate)
        .where('subscription.currentPeriodEnd', '>', new Date())
        .withGraphFetched('[subscription, facilitators.user]');

      return projects;

    } catch (error) {
      this.loggingService.error('Error getting projects approaching expiry', { daysThreshold, error });
      throw error;
    }
  }

  /**
   * Send expiry warnings to projects approaching their subscription end
   */
  async sendExpiryWarnings(daysThreshold: number = 7): Promise<void> {
    try {
      const projects = await this.getProjectsApproachingExpiry(daysThreshold);

      for (const project of projects) {
        const status = await this.checkProjectStatus(project.id);
        
        if (status.daysUntilExpiry && status.daysUntilExpiry <= daysThreshold) {
          // Send warning to all facilitators
          for (const facilitator of project.facilitators || []) {
            if (facilitator.user) {
              await this.notificationService.sendExpiryWarningNotification(
                facilitator.user.id,
                project.id,
                project.name,
                status.daysUntilExpiry
              );

              // Track warning analytics
              AnalyticsService.trackExpiryWarningSent(
                facilitator.user.id,
                project.id,
                status.daysUntilExpiry,
                'both' // email and push
              );
            }
          }
        }
      }

      this.loggingService.info('Expiry warnings sent', { 
        projectCount: projects.length, 
        daysThreshold 
      });

    } catch (error) {
      this.loggingService.error('Error sending expiry warnings', { daysThreshold, error });
      throw error;
    }
  }

  /**
   * Batch process expired projects for archival
   */
  async processExpiredProjects(): Promise<void> {
    try {
      const expiredProjects = await Project.query()
        .where('status', 'active')
        .joinRelated('subscription')
        .where('subscription.currentPeriodEnd', '<', new Date())
        .withGraphFetched('subscription');

      this.loggingService.info('Processing expired projects', { 
        count: expiredProjects.length 
      });

      for (const project of expiredProjects) {
        await this.transitionToArchival(project.id);
      }

    } catch (error) {
      this.loggingService.error('Error processing expired projects', { error });
      throw error;
    }
  }
}