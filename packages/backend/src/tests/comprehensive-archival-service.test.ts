import { ArchivalService } from '../services/archival-service';
import { ArchivalExportService } from '../services/archival-export-service';
import { DataRetentionService } from '../services/data-retention-service';
import { AnalyticsService } from '../services/analytics-service';
import { Project } from '../models/project';
import { Subscription } from '../models/subscription';
import { Story } from '../models/story';
import { ProjectRole } from '../models/project-role';
import { User } from '../models/user';
import { setupTestDatabase, cleanupTestDatabase } from './setup';

describe('Comprehensive Archival Service Tests', () => {
  let archivalService: ArchivalService;
  let exportService: ArchivalExportService;
  let retentionService: DataRetentionService;
  let testProjectId: string;
  let testUserId: string;
  let testSubscriptionId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    archivalService = new ArchivalService();
    exportService = new ArchivalExportService();
    retentionService = new DataRetentionService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Create test user
    const user = await User.query().insert({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed-password',
    });
    testUserId = user.id;

    // Create test project
    const project = await Project.query().insert({
      name: 'Test Project',
      description: 'Test project for archival',
      status: 'active',
      createdBy: testUserId,
    });
    testProjectId = project.id;

    // Create project role
    await ProjectRole.query().insert({
      projectId: testProjectId,
      userId: testUserId,
      role: 'facilitator',
    });

    // Create subscription
    const subscription = await Subscription.query().insert({
      projectId: testProjectId,
      facilitatorId: testUserId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    });
    testSubscriptionId = subscription.id;

    // Create test stories
    await Story.query().insert([
      {
        projectId: testProjectId,
        audioUrl: 'test-audio-1.mp3',
        transcript: 'Test transcript 1',
        title: 'Test Story 1',
      },
      {
        projectId: testProjectId,
        audioUrl: 'test-audio-2.mp3',
        transcript: 'Test transcript 2',
        title: 'Test Story 2',
      },
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await Story.query().where('projectId', testProjectId).delete();
    await Subscription.query().deleteById(testSubscriptionId);
    await ProjectRole.query().where('projectId', testProjectId).delete();
    await Project.query().deleteById(testProjectId);
    await User.query().deleteById(testUserId);
  });

  describe('Project Status Management', () => {
    it('should correctly identify active project status', async () => {
      const status = await archivalService.checkProjectStatus(testProjectId);

      expect(status.isActive).toBe(true);
      expect(status.isArchived).toBe(false);
      expect(status.subscriptionExpiresAt).toBeInstanceOf(Date);
      expect(status.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('should correctly identify expired project status', async () => {
      // Update subscription to be expired
      await Subscription.query()
        .where('projectId', testProjectId)
        .patch({
          currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        });

      const status = await archivalService.checkProjectStatus(testProjectId);

      expect(status.isActive).toBe(false);
      expect(status.isArchived).toBe(true);
      expect(status.subscriptionExpiresAt).toBeInstanceOf(Date);
    });

    it('should handle project without subscription', async () => {
      // Delete subscription
      await Subscription.query().deleteById(testSubscriptionId);

      const status = await archivalService.checkProjectStatus(testProjectId);

      expect(status.isActive).toBe(false);
      expect(status.isArchived).toBe(false);
      expect(status.subscriptionExpiresAt).toBeNull();
    });
  });

  describe('Archival Transition Process', () => {
    it('should transition project to archival mode', async () => {
      // First verify project is active
      let project = await Project.query().findById(testProjectId);
      expect(project?.status).toBe('active');

      // Transition to archival
      await archivalService.transitionToArchival(testProjectId);

      // Verify project is now archived
      project = await Project.query().findById(testProjectId);
      expect(project?.status).toBe('archived');
    });

    it('should send notifications during archival transition', async () => {
      // Mock the notification service to track calls
      const notificationSpy = jest.spyOn(archivalService['notificationService'], 'sendArchivalNotification');

      await archivalService.transitionToArchival(testProjectId);

      expect(notificationSpy).toHaveBeenCalledWith(
        testUserId,
        testProjectId,
        'Test Project'
      );
    });

    it('should track analytics during archival transition', async () => {
      const analyticsSpy = jest.spyOn(AnalyticsService, 'trackArchivalTransition');

      await archivalService.transitionToArchival(testProjectId);

      expect(analyticsSpy).toHaveBeenCalledWith(
        testUserId,
        testProjectId,
        'Test Project',
        'expired'
      );
    });
  });

  describe('Subscription Renewal Process', () => {
    it('should renew subscription and reactivate project', async () => {
      // First archive the project
      await Project.query()
        .findById(testProjectId)
        .patch({ status: 'archived' });

      // Renew subscription
      await archivalService.renewSubscription(testProjectId);

      // Verify project is active again
      const project = await Project.query().findById(testProjectId);
      expect(project?.status).toBe('active');

      // Verify subscription is updated
      const subscription = await Subscription.query()
        .where('projectId', testProjectId)
        .first();
      expect(subscription?.status).toBe('active');
      expect(subscription?.currentPeriodEnd).toBeInstanceOf(Date);
      
      // Should be approximately 1 year from now
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      const timeDiff = Math.abs(
        new Date(subscription!.currentPeriodEnd).getTime() - oneYearFromNow.getTime()
      );
      expect(timeDiff).toBeLessThan(60 * 1000); // Within 1 minute
    });

    it('should send notifications during subscription renewal', async () => {
      const notificationSpy = jest.spyOn(archivalService['notificationService'], 'sendSubscriptionRenewalNotification');

      await archivalService.renewSubscription(testProjectId);

      expect(notificationSpy).toHaveBeenCalled();
    });
  });

  describe('Archival Permissions System', () => {
    it('should grant full permissions for active projects', async () => {
      const permissions = await archivalService.getArchivalPermissions(testProjectId, testUserId);

      expect(permissions.canView).toBe(true);
      expect(permissions.canExport).toBe(true);
      expect(permissions.canRecord).toBe(true);
      expect(permissions.canComment).toBe(true);
      expect(permissions.canEdit).toBe(true);
    });

    it('should restrict permissions for archived projects', async () => {
      // Archive the project
      await Project.query()
        .findById(testProjectId)
        .patch({ status: 'archived' });

      const permissions = await archivalService.getArchivalPermissions(testProjectId, testUserId);

      expect(permissions.canView).toBe(true);
      expect(permissions.canExport).toBe(true);
      expect(permissions.canRecord).toBe(false);
      expect(permissions.canComment).toBe(false);
      expect(permissions.canEdit).toBe(false);
    });

    it('should deny all permissions for unauthorized users', async () => {
      const unauthorizedUserId = 'unauthorized-user-id';

      const permissions = await archivalService.getArchivalPermissions(testProjectId, unauthorizedUserId);

      expect(permissions.canView).toBe(false);
      expect(permissions.canExport).toBe(false);
      expect(permissions.canRecord).toBe(false);
      expect(permissions.canComment).toBe(false);
      expect(permissions.canEdit).toBe(false);
    });
  });

  describe('Expiry Warning System', () => {
    it('should identify projects approaching expiry', async () => {
      // Set subscription to expire in 5 days
      await Subscription.query()
        .where('projectId', testProjectId)
        .patch({
          currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        });

      const projects = await archivalService.getProjectsApproachingExpiry(7);

      expect(projects.length).toBeGreaterThan(0);
      const projectIds = projects.map(p => p.id);
      expect(projectIds).toContain(testProjectId);
    });

    it('should send expiry warnings', async () => {
      // Set subscription to expire in 5 days
      await Subscription.query()
        .where('projectId', testProjectId)
        .patch({
          currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        });

      const notificationSpy = jest.spyOn(archivalService['notificationService'], 'sendExpiryWarningNotification');

      await archivalService.sendExpiryWarnings(7);

      expect(notificationSpy).toHaveBeenCalled();
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple expired projects', async () => {
      // Create additional expired project
      const expiredProject = await Project.query().insert({
        name: 'Expired Project',
        description: 'Project that should be archived',
        status: 'active',
        createdBy: testUserId,
      });

      await Subscription.query().insert({
        projectId: expiredProject.id,
        facilitatorId: testUserId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      await archivalService.processExpiredProjects();

      // Verify project was archived
      const updatedProject = await Project.query().findById(expiredProject.id);
      expect(updatedProject?.status).toBe('archived');

      // Clean up
      await Project.query().deleteById(expiredProject.id);
    });
  });

  describe('Integration with Export Service', () => {
    it('should create enhanced exports for archived projects', async () => {
      // Archive the project first
      await archivalService.transitionToArchival(testProjectId);

      const exportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip' as const,
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        exportOptions
      );

      expect(exportId).toBeDefined();

      const exportStatus = await exportService.getExportStatus(exportId);
      expect(exportStatus.id).toBe(exportId);
    });

    it('should handle export permissions correctly', async () => {
      // Test with active project
      let permissions = await archivalService.getArchivalPermissions(testProjectId, testUserId);
      expect(permissions.canExport).toBe(true);

      // Test with archived project
      await archivalService.transitionToArchival(testProjectId);
      permissions = await archivalService.getArchivalPermissions(testProjectId, testUserId);
      expect(permissions.canExport).toBe(true);
    });
  });

  describe('Integration with Data Retention', () => {
    it('should work with data retention policies', async () => {
      // Archive the project and set it to be very old
      await Project.query()
        .findById(testProjectId)
        .patch({
          status: 'archived',
          updatedAt: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000), // 8 years ago
        });

      const policies = retentionService.getRetentionPolicies();
      const archivalPolicy = policies.find(p => p.name === 'archived_project_cleanup');
      
      expect(archivalPolicy).toBeDefined();
      expect(archivalPolicy?.retentionPeriodDays).toBe(7 * 365); // 7 years
    });
  });

  describe('Analytics Integration', () => {
    it('should track archival metrics correctly', async () => {
      // Track some archival events
      AnalyticsService.trackArchivalTransition(testUserId, testProjectId, 'Test Project', 'expired');
      AnalyticsService.trackSubscriptionRenewal(testUserId, testProjectId, 'Test Project', 'manual');
      AnalyticsService.trackExpiryWarningSent(testUserId, testProjectId, 7, 'email');

      const metrics = await AnalyticsService.getArchivalMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.renewalRate).toBe('number');
      expect(typeof metrics.expiryWarningEffectiveness).toBe('number');
      expect(typeof metrics.totalArchivedProjects).toBe('number');
    });

    it('should generate archival reports', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = new Date();

      const report = await AnalyticsService.generateArchivalReport(startDate, endDate);

      expect(report).toBeDefined();
      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
      expect(report.summary).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(Array.isArray(report.insights)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent project gracefully', async () => {
      await expect(
        archivalService.checkProjectStatus('non-existent-project')
      ).rejects.toThrow('Project non-existent-project not found');
    });

    it('should handle database transaction failures', async () => {
      // Mock database transaction failure
      const originalTransaction = archivalService['db'].transaction;
      archivalService['db'].transaction = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      await expect(
        archivalService.transitionToArchival(testProjectId)
      ).rejects.toThrow('Transaction failed');

      // Restore original method
      archivalService['db'].transaction = originalTransaction;
    });

    it('should handle notification failures gracefully', async () => {
      // Mock notification service failure
      const notificationSpy = jest.spyOn(archivalService['notificationService'], 'sendArchivalNotification')
        .mockRejectedValue(new Error('Notification failed'));

      // Should not throw error even if notification fails
      await expect(
        archivalService.transitionToArchival(testProjectId)
      ).resolves.not.toThrow();

      notificationSpy.mockRestore();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent archival operations', async () => {
      // Create multiple projects
      const projects = await Promise.all([
        Project.query().insert({
          name: 'Project 1',
          description: 'Test project 1',
          status: 'active',
          createdBy: testUserId,
        }),
        Project.query().insert({
          name: 'Project 2',
          description: 'Test project 2',
          status: 'active',
          createdBy: testUserId,
        }),
        Project.query().insert({
          name: 'Project 3',
          description: 'Test project 3',
          status: 'active',
          createdBy: testUserId,
        }),
      ]);

      // Transition all projects concurrently
      const transitions = projects.map(project =>
        archivalService.transitionToArchival(project.id)
      );

      await expect(Promise.all(transitions)).resolves.not.toThrow();

      // Verify all projects were archived
      for (const project of projects) {
        const updatedProject = await Project.query().findById(project.id);
        expect(updatedProject?.status).toBe('archived');
      }

      // Clean up
      await Promise.all(projects.map(project =>
        Project.query().deleteById(project.id)
      ));
    });

    it('should handle large numbers of expiry warnings efficiently', async () => {
      const startTime = Date.now();
      
      await archivalService.sendExpiryWarnings(30);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (5 seconds)
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency during archival transition', async () => {
      const originalProjectData = await Project.query()
        .findById(testProjectId)
        .withGraphFetched('[stories, subscription]');

      await archivalService.transitionToArchival(testProjectId);

      const archivedProjectData = await Project.query()
        .findById(testProjectId)
        .withGraphFetched('[stories, subscription]');

      // Project status should change but other data should remain
      expect(archivedProjectData?.status).toBe('archived');
      expect(archivedProjectData?.name).toBe(originalProjectData?.name);
      expect(archivedProjectData?.stories?.length).toBe(originalProjectData?.stories?.length);
    });

    it('should maintain referential integrity during operations', async () => {
      // Verify all relationships exist before archival
      const projectRoles = await ProjectRole.query().where('projectId', testProjectId);
      const stories = await Story.query().where('projectId', testProjectId);
      const subscription = await Subscription.query().where('projectId', testProjectId).first();

      expect(projectRoles.length).toBeGreaterThan(0);
      expect(stories.length).toBeGreaterThan(0);
      expect(subscription).toBeDefined();

      await archivalService.transitionToArchival(testProjectId);

      // Verify relationships still exist after archival
      const projectRolesAfter = await ProjectRole.query().where('projectId', testProjectId);
      const storiesAfter = await Story.query().where('projectId', testProjectId);
      const subscriptionAfter = await Subscription.query().where('projectId', testProjectId).first();

      expect(projectRolesAfter.length).toBe(projectRoles.length);
      expect(storiesAfter.length).toBe(stories.length);
      expect(subscriptionAfter).toBeDefined();
    });
  });
});