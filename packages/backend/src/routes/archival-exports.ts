import { Router } from 'express';
import { ArchivalExportController } from '../controllers/archival-export-controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/archival-exports/projects/:projectId
 * @desc Create a new archival export for a project
 * @access Private
 */
router.post('/projects/:projectId', ArchivalExportController.createArchivalExport);

/**
 * @route GET /api/archival-exports/:exportId/status
 * @desc Get export status
 * @access Private
 */
router.get('/:exportId/status', ArchivalExportController.getExportStatus);

/**
 * @route GET /api/archival-exports/:exportId/download
 * @desc Download export file
 * @access Private
 */
router.get('/:exportId/download', ArchivalExportController.downloadExport);

/**
 * @route GET /api/archival-exports/projects/:projectId
 * @desc Get all exports for a project
 * @access Private
 */
router.get('/projects/:projectId', ArchivalExportController.getProjectExports);

/**
 * @route DELETE /api/archival-exports/:exportId
 * @desc Delete an export
 * @access Private
 */
router.delete('/:exportId', ArchivalExportController.deleteExport);

/**
 * @route GET /api/archival-exports/projects/:projectId/options
 * @desc Get export options and capabilities for a project
 * @access Private
 */
router.get('/projects/:projectId/options', ArchivalExportController.getExportOptions);

export default router;