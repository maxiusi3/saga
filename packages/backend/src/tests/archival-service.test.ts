import { ArchivalService } from '../services/archival-service';
import { Project } from '../models/project';
import { Subscription } from '../models/subscription';
import { ProjectRole } from '../models/project-role';
import { User } from '../models/user';

// Mock the dependencies
jest.mock('../services/notification-service');
jest.mock('../services/logging-service');

describe('ArchivalService', () => {
  let archivalService: ArchivalService;

  beforeEach(() => {
    archivalService = new ArchivalService();
  });

  describe('checkProjectStatus', () => {
    it('should return active status for project with valid subscription', async () => {
      // Mock project with active subscription
      const mockProject = {
        id: 'project-1',
        status: 'active',
        subscription: {
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      };

      jest.spyOn(Project.query(), 'findById').mockReturnValue({
        withGraphFetched: jest.fn().mockResolvedValue(mockProject)
      } as any);

      const status = await archivalService.checkProjectStatus('project-1');

      expect(status.isActive).toBe(true);
      expect(status.isArchived).toBe(false);
      expect(status.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('should return archived status for expired project', async () => {
      // Mock project with expired subscription
      const mockProject = {
        id: 'project-1',
        status: 'active',
        subscription: {
          currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      };

      jest.spyOn(Project.query(), 'findById').mockReturnValue({
        withGraphFetched: jest.fn().mockResolvedValue(mockProject)
      } as any);

      // Mock the transitionToArchival method
      jest.spyOn(archivalService, 'transitionToArchival').mockResolvedValue();

      const status = await archivalService.checkProjectStatus('project-1');

      expect(status.isActive).toBe(false);
      expect(status.isArchived).toBe(true);
      expect(archivalService.transitionToArchival).toHaveBeenCalledWith('project-1');
    });
  });

  describe('getArchivalPermissions', () => {
    it('should return full permissions for active project', async () => {
      // Mock active project status
      jest.spyOn(archivalService, 'checkProjectStatus').mockResolvedValue({
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      });

      // Mock user role
      jest.spyOn(ProjectRole.query(), 'where').mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ userId: 'user-1', role: 'facilitator' })
        })
      } as any);

      const permissions = await archivalService.getArchivalPermissions('project-1', 'user-1');

      expect(permissions.canView).toBe(true);
      expect(permissions.canExport).toBe(true);
      expect(permissions.canRecord).toBe(true);
      expect(permissions.canComment).toBe(true);
      expect(permissions.canEdit).toBe(true);
    });

    it('should return limited permissions for archived project', async () => {
      // Mock archived project status
      jest.spyOn(archivalService, 'checkProjectStatus').mockResolvedValue({
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      });

      // Mock user role
      jest.spyOn(ProjectRole.query(), 'where').mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ userId: 'user-1', role: 'facilitator' })
        })
      } as any);

      const permissions = await archivalService.getArchivalPermissions('project-1', 'user-1');

      expect(permissions.canView).toBe(true);
      expect(permissions.canExport).toBe(true);
      expect(permissions.canRecord).toBe(false);
      expect(permissions.canComment).toBe(false);
      expect(permissions.canEdit).toBe(false);
    });

    it('should return no permissions for user without project access', async () => {
      // Mock no user role found
      jest.spyOn(ProjectRole.query(), 'where').mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null)
        })
      } as any);

      const permissions = await archivalService.getArchivalPermissions('project-1', 'user-1');

      expect(permissions.canView).toBe(false);
      expect(permissions.canExport).toBe(false);
      expect(permissions.canRecord).toBe(false);
      expect(permissions.canComment).toBe(false);
      expect(permissions.canEdit).toBe(false);
    });
  });

  describe('renewSubscription', () => {
    it('should successfully renew subscription and reactivate project', async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      // Mock database transaction
      jest.spyOn(archivalService['db'], 'transaction').mockResolvedValue(mockTransaction as any);

      // Mock project update
      jest.spyOn(Project.query(), 'findById').mockReturnValue({
        patch: jest.fn().mockResolvedValue({})
      } as any);

      // Mock subscription update
      jest.spyOn(Subscription.query(), 'where').mockReturnValue({
        patch: jest.fn().mockResolvedValue({})
      } as any);

      // Mock project roles for notifications
      jest.spyOn(ProjectRole.query(), 'where').mockReturnValue({
        withGraphFetched: jest.fn().mockResolvedValue([
          { user: { id: 'user-1', name: 'Test User' } }
        ])
      } as any);

      // Mock project for notifications
      jest.spyOn(Project.query(), 'findById').mockResolvedValue({
        name: 'Test Project'
      } as any);

      await archivalService.renewSubscription('project-1');

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
    });
  });
});