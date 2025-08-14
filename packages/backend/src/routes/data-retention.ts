import { Router } from 'express';
import { DataRetentionController } from '../controllers/data-retention-controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/data-retention/policies
 * @desc Get all retention policies
 * @access Private (Admin)
 */
router.get('/policies', DataRetentionController.getRetentionPolicies);

/**
 * @route GET /api/data-retention/policies/:policyName
 * @desc Get a specific retention policy
 * @access Private (Admin)
 */
router.get('/policies/:policyName', DataRetentionController.getRetentionPolicy);

/**
 * @route POST /api/data-retention/execute
 * @desc Execute all retention policies
 * @access Private (Admin)
 */
router.post('/execute', DataRetentionController.executeAllPolicies);

/**
 * @route POST /api/data-retention/execute/:policyName
 * @desc Execute a specific retention policy
 * @access Private (Admin)
 */
router.post('/execute/:policyName', DataRetentionController.executePolicy);

/**
 * @route GET /api/data-retention/status
 * @desc Get retention status and next execution times
 * @access Private (Admin)
 */
router.get('/status', DataRetentionController.getRetentionStatus);

/**
 * @route POST /api/data-retention/validate
 * @desc Validate a retention policy configuration
 * @access Private (Admin)
 */
router.post('/validate', DataRetentionController.validatePolicy);

/**
 * @route GET /api/data-retention/preview/:policyName
 * @desc Get retention policy preview (dry run)
 * @query dryRun - Must be 'true' for preview
 * @access Private (Admin)
 */
router.get('/preview/:policyName', DataRetentionController.getPolicyPreview);

export default router;