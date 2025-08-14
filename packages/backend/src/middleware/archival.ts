import { Request, Response, NextFunction } from 'express';
import { ArchivalService } from '../services/archival-service';
import { LoggingService } from '../services/logging-service';

// Extend Request interface to include archival status
declare global {
  namespace Express {
    interface Request {
      projectStatus?: {
        isActive: boolean;
        isArchived: boolean;
        subscriptionExpiresAt: Date | null;
        daysUntilExpiry?: number;
      };
      archivalPermissions?: {
        canView: boolean;
        canExport: boolean;
        canRecord: boolean;
        canComment: boolean;
        canEdit: boolean;
      };
    }
  }
}

/**
 * Middleware to check project archival status and enforce permissions
 */
export const archivalMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let projectId = req.params.projectId || req.params.id;
    const userId = req.user?.id;

    // If we have a story ID but no project ID, we need to get the project ID from the story
    if (!projectId && req.params.id) {
      // For story routes, we need to get the project ID from the story
      const { Story } = await import('../models/story');
      const story = await Story.query().findById(req.params.id).select('projectId');
      if (story) {
        projectId = story.projectId;
      }
    }

    if (!projectId) {
      return next(); // Skip if no project ID in route
    }

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const archivalService = new ArchivalService();
    
    // Check project status
    const projectStatus = await archivalService.checkProjectStatus(projectId);
    req.projectStatus = projectStatus;

    // Get user permissions for this project
    const permissions = await archivalService.getArchivalPermissions(projectId, userId);
    req.archivalPermissions = permissions;

    // If user has no access to the project at all
    if (!permissions.canView) {
      return res.status(403).json({
        error: {
          code: 'PROJECT_ACCESS_DENIED',
          message: 'You do not have access to this project'
        }
      });
    }

    // Check if this is a write operation
    const isWriteOperation = isWriteRequest(req);

    if (projectStatus.isArchived && isWriteOperation) {
      // Determine which specific permission is needed
      const requiredPermission = getRequiredPermission(req);
      
      if (!permissions[requiredPermission]) {
        return res.status(403).json({
          error: {
            code: 'PROJECT_ARCHIVED',
            message: 'This project is in archival mode. Interactive features are disabled.',
            details: {
              isArchived: true,
              subscriptionExpiresAt: projectStatus.subscriptionExpiresAt,
              canRenew: true,
              renewalUrl: `/api/projects/${projectId}/renew-subscription`
            }
          }
        });
      }
    }

    // Log archival status for monitoring
    if (projectStatus.isArchived) {
      LoggingService.info('Archival project access', {
        projectId,
        userId,
        method: req.method,
        path: req.path,
        isWriteOperation,
        permissions
      });
    }

    next();

  } catch (error) {
    LoggingService.error('Error in archival middleware', {
      projectId: req.params.projectId || req.params.id,
      userId: req.user?.id,
      error
    });

    return res.status(500).json({
      error: {
        code: 'ARCHIVAL_CHECK_FAILED',
        message: 'Unable to verify project status'
      }
    });
  }
};

/**
 * Determine if the request is a write operation
 */
function isWriteRequest(req: Request): boolean {
  // POST, PUT, PATCH, DELETE are write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return true;
  }

  // Some GET requests might trigger writes (like generating exports)
  // but exports are allowed in archival mode
  return false;
}

/**
 * Determine which permission is required for the request
 */
function getRequiredPermission(req: Request): keyof typeof req.archivalPermissions {
  const path = req.path.toLowerCase();
  const method = req.method;

  // Recording-related endpoints
  if (path.includes('/stories') && method === 'POST') {
    return 'canRecord';
  }

  // Comment/interaction endpoints
  if (path.includes('/interactions') || path.includes('/comments')) {
    return 'canComment';
  }

  // Edit endpoints (transcript editing, etc.)
  if (method === 'PUT' || method === 'PATCH') {
    return 'canEdit';
  }

  // Export endpoints (should be allowed)
  if (path.includes('/export')) {
    return 'canExport';
  }

  // Default to canRecord for other write operations
  return 'canRecord';
}

/**
 * Middleware specifically for story creation (recording)
 */
export const recordingArchivalMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.projectStatus?.isArchived && !req.archivalPermissions?.canRecord) {
    return res.status(403).json({
      error: {
        code: 'RECORDING_DISABLED_ARCHIVED',
        message: 'Recording is disabled in archival mode. Renew your subscription to continue sharing stories.',
        details: {
          isArchived: true,
          subscriptionExpiresAt: req.projectStatus.subscriptionExpiresAt,
          canRenew: true,
          renewalUrl: `/api/projects/${req.params.projectId}/renew-subscription`
        }
      }
    });
  }
  next();
};

/**
 * Middleware specifically for interactions (comments/follow-ups)
 */
export const interactionArchivalMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.projectStatus?.isArchived && !req.archivalPermissions?.canComment) {
    return res.status(403).json({
      error: {
        code: 'INTERACTIONS_DISABLED_ARCHIVED',
        message: 'Comments and follow-up questions are disabled in archival mode. Renew your subscription to continue interacting.',
        details: {
          isArchived: true,
          subscriptionExpiresAt: req.projectStatus.subscriptionExpiresAt,
          canRenew: true,
          renewalUrl: `/api/projects/${req.params.projectId}/renew-subscription`
        }
      }
    });
  }
  next();
};

/**
 * Middleware specifically for editing (transcript editing, etc.)
 */
export const editingArchivalMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.projectStatus?.isArchived && !req.archivalPermissions?.canEdit) {
    return res.status(403).json({
      error: {
        code: 'EDITING_DISABLED_ARCHIVED',
        message: 'Editing is disabled in archival mode. Renew your subscription to continue editing content.',
        details: {
          isArchived: true,
          subscriptionExpiresAt: req.projectStatus.subscriptionExpiresAt,
          canRenew: true,
          renewalUrl: `/api/projects/${req.params.projectId}/renew-subscription`
        }
      }
    });
  }
  next();
};

/**
 * Helper middleware to add archival status to response headers
 */
export const archivalHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.projectStatus) {
    res.set({
      'X-Project-Archived': req.projectStatus.isArchived.toString(),
      'X-Project-Active': req.projectStatus.isActive.toString(),
    });

    if (req.projectStatus.subscriptionExpiresAt) {
      res.set('X-Subscription-Expires', req.projectStatus.subscriptionExpiresAt.toISOString());
    }

    if (req.projectStatus.daysUntilExpiry !== undefined) {
      res.set('X-Days-Until-Expiry', req.projectStatus.daysUntilExpiry.toString());
    }
  }

  next();
};