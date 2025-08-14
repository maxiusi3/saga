import { Router } from 'express';
import { ArchivalExportController } from '../controllers/archival-export-controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware
router.use(authenticateToken);

/**
 * @route GET /api/exports/:id/status
 * @desc Get export status (legacy endpoint, redirects to archival exports)
 * @access Private
 */
router.get('/:id/status', ArchivalExportController.getExportStatus);

/**
 * @route GET /api/exports/:id/download
 * @desc Download export file (legacy endpoint, redirects to archival exports)
 * @access Private
 */
router.get('/:id/download', ArchivalExportController.downloadExport);

export { router as exportRoutes };