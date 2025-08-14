import { Request, Response, NextFunction } from 'express';
import {
  archivalMiddleware,
  recordingArchivalMiddleware,
  interactionArchivalMiddleware,
  editingArchivalMiddleware,
  archivalHeadersMiddleware
} from '../middleware/archival';
import { ArchivalService } from '../services/archival-service';
import { Story } from '../models/story';

// Mock dependencies
jest.mock('../services/archival-service');
jest.mock('../services/logging-service');
jest.mock('../models/story');

describe('Archival Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockArchivalService: jest.Mocked<ArchivalService>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      user: { id: 'user-1' },
      method: 'GET',
      path: '/api/projects/project-1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Mock ArchivalService
    mockArchivalService = {
      checkProjectStatus: jest.fn(),
      getArchivalPermissions: jest.fn()
    } as any;

    (ArchivalService as jest.MockedClass<typeof ArchivalService>).mockImplementation(() => mockArchivalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('archivalMiddleware', () => {
    it('should skip middleware when no project ID is present', async () => {
      mockRequest.params = {};

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockArchivalService.checkProjectStatus).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.user = undefined;

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no project access', async () => {
      mockRequest.params = { projectId: 'project-1' };

      mockArchivalService.checkProjectStatus.mockResolvedValue({
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      });

      mockArchivalService.getArchivalPermissions.mockResolvedValue({
        canView: false,
        canExport: false,
        canRecord: false,
        canComment: false,
        canEdit: false
      });

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'PROJECT_ACCESS_DENIED',
          message: 'You do not have access to this project'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow read operations on active projects', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'GET';

      const projectStatus = {
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: true,
        canEdit: true
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.projectStatus).toEqual(projectStatus);
      expect(mockRequest.archivalPermissions).toEqual(permissions);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow read operations on archived projects', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'GET';

      const projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block write operations on archived projects', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'POST';
      mockRequest.path = '/api/projects/project-1/stories';

      const projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'PROJECT_ARCHIVED',
          message: 'This project is in archival mode. Interactive features are disabled.',
          details: {
            isArchived: true,
            subscriptionExpiresAt: projectStatus.subscriptionExpiresAt,
            canRenew: true,
            renewalUrl: '/api/projects/project-1/renew-subscription'
          }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle story ID parameter by looking up project ID', async () => {
      mockRequest.params = { id: 'story-1' };
      delete mockRequest.params.projectId;

      // Mock Story.query to return project ID
      const mockStoryQuery = {
        findById: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ projectId: 'project-1' })
      };
      (Story.query as jest.Mock).mockReturnValue(mockStoryQuery);

      const projectStatus = {
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: true,
        canEdit: true
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStoryQuery.findById).toHaveBeenCalledWith('story-1');
      expect(mockStoryQuery.select).toHaveBeenCalledWith('projectId');
      expect(mockArchivalService.checkProjectStatus).toHaveBeenCalledWith('project-1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRequest.params = { projectId: 'project-1' };

      mockArchivalService.checkProjectStatus.mockRejectedValue(new Error('Database error'));

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'ARCHIVAL_CHECK_FAILED',
          message: 'Unable to verify project status'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('recordingArchivalMiddleware', () => {
    it('should allow recording on active projects', async () => {
      mockRequest.projectStatus = {
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      };

      mockRequest.archivalPermissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: true,
        canEdit: true
      };

      await recordingArchivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block recording on archived projects', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      mockRequest.archivalPermissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

      await recordingArchivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'RECORDING_DISABLED_ARCHIVED',
          message: 'Recording is disabled in archival mode. Renew your subscription to continue sharing stories.',
          details: {
            isArchived: true,
            subscriptionExpiresAt: mockRequest.projectStatus.subscriptionExpiresAt,
            canRenew: true,
            renewalUrl: '/api/projects/project-1/renew-subscription'
          }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('interactionArchivalMiddleware', () => {
    it('should allow interactions on active projects', async () => {
      mockRequest.projectStatus = {
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      };

      mockRequest.archivalPermissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: true,
        canEdit: true
      };

      await interactionArchivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block interactions on archived projects', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      mockRequest.archivalPermissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

      await interactionArchivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERACTIONS_DISABLED_ARCHIVED',
          message: 'Comments and follow-up questions are disabled in archival mode. Renew your subscription to continue interacting.',
          details: {
            isArchived: true,
            subscriptionExpiresAt: mockRequest.projectStatus.subscriptionExpiresAt,
            canRenew: true,
            renewalUrl: '/api/projects/project-1/renew-subscription'
          }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('editingArchivalMiddleware', () => {
    it('should allow editing on active projects', async () => {
      mockRequest.projectStatus = {
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date(),
        daysUntilExpiry: 30
      };

      mockRequest.archivalPermissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: true,
        canEdit: true
      };

      await editingArchivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block editing on archived projects', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      mockRequest.archivalPermissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

      await editingArchivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'EDITING_DISABLED_ARCHIVED',
          message: 'Editing is disabled in archival mode. Renew your subscription to continue editing content.',
          details: {
            isArchived: true,
            subscriptionExpiresAt: mockRequest.projectStatus.subscriptionExpiresAt,
            canRenew: true,
            renewalUrl: '/api/projects/project-1/renew-subscription'
          }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('archivalHeadersMiddleware', () => {
    it('should add archival status headers', () => {
      mockRequest.projectStatus = {
        isActive: true,
        isArchived: false,
        subscriptionExpiresAt: new Date('2024-12-31'),
        daysUntilExpiry: 30
      };

      archivalHeadersMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'X-Project-Archived': 'false',
        'X-Project-Active': 'true',
      });

      expect(mockResponse.set).toHaveBeenCalledWith('X-Subscription-Expires', '2024-12-31T00:00:00.000Z');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Days-Until-Expiry', '30');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing project status', () => {
      mockRequest.projectStatus = undefined;

      archivalHeadersMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle archived project headers', () => {
      mockRequest.projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date('2023-12-31'),
      };

      archivalHeadersMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'X-Project-Archived': 'true',
        'X-Project-Active': 'false',
      });

      expect(mockResponse.set).toHaveBeenCalledWith('X-Subscription-Expires', '2023-12-31T00:00:00.000Z');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Permission Detection Logic', () => {
    it('should detect recording permission for story creation', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'POST';
      mockRequest.path = '/api/projects/project-1/stories';

      const projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: true,
        canEdit: true
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'PROJECT_ARCHIVED'
          })
        })
      );
    });

    it('should detect comment permission for interaction endpoints', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'POST';
      mockRequest.path = '/api/projects/project-1/interactions';

      const projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: false,
        canEdit: true
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should detect edit permission for PUT/PATCH requests', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'PATCH';
      mockRequest.path = '/api/stories/story-1/transcript';

      const projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: true,
        canComment: true,
        canEdit: false
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should allow export operations even in archived mode', async () => {
      mockRequest.params = { projectId: 'project-1' };
      mockRequest.method = 'POST';
      mockRequest.path = '/api/projects/project-1/export';

      const projectStatus = {
        isActive: false,
        isArchived: true,
        subscriptionExpiresAt: new Date(),
      };

      const permissions = {
        canView: true,
        canExport: true,
        canRecord: false,
        canComment: false,
        canEdit: false
      };

      mockArchivalService.checkProjectStatus.mockResolvedValue(projectStatus);
      mockArchivalService.getArchivalPermissions.mockResolvedValue(permissions);

      await archivalMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});