import { Router } from 'express';
import { PromptManagementController } from '../controllers/prompt-management-controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Admin middleware (you would implement this based on your auth system)
const adminMiddleware = (req: any, res: any, next: any) => {
  // For now, just check if user exists
  // In production, you'd check for admin role
  if (!req.user) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

router.use(adminMiddleware);

// Get all library prompts with filtering and pagination
router.get('/library', PromptManagementController.getLibraryPrompts);

// Create a new library prompt
router.post('/library', PromptManagementController.createPrompt);

// Update an existing prompt
router.put('/library/:promptId', PromptManagementController.updatePrompt);

// Delete a prompt
router.delete('/library/:promptId', PromptManagementController.deletePrompt);

// Get prompt analytics
router.get('/analytics', PromptManagementController.getPromptAnalytics);

// Regenerate audio for a prompt
router.post('/library/:promptId/regenerate-audio', PromptManagementController.regenerateAudio);

// Localization endpoints
router.get('/localization/languages', PromptManagementController.getSupportedLanguages);
router.post('/library/:promptId/localize', PromptManagementController.createLocalizedPrompt);
router.get('/localization/coverage', PromptManagementController.getLocalizationCoverage);

// Backup and versioning endpoints
router.post('/backups', PromptManagementController.createBackup);
router.get('/backups', PromptManagementController.getBackups);
router.post('/backups/:backupId/restore', PromptManagementController.restoreFromBackup);

// Version history endpoints
router.get('/library/:promptId/versions', PromptManagementController.getPromptVersionHistory);
router.post('/library/:promptId/revert', PromptManagementController.revertPromptToVersion);

export { router as promptManagementRoutes };