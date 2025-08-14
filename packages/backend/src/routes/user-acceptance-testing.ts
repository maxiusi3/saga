import { Router } from 'express';
import { UserAcceptanceTestingController } from '../controllers/user-acceptance-testing-controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const uatController = new UserAcceptanceTestingController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/user-testing/recruit
 * @desc Start beta tester recruitment campaign
 * @access Private (Admin only)
 */
router.post('/recruit', uatController.recruitBetaTesters.bind(uatController));

/**
 * @route GET /api/user-testing/scenarios
 * @desc Get all testing scenarios
 * @access Private
 */
router.get('/scenarios', uatController.getTestingScenarios.bind(uatController));

/**
 * @route POST /api/user-testing/sessions
 * @desc Schedule a moderated testing session
 * @access Private
 */
router.post('/sessions', uatController.scheduleTestingSession.bind(uatController));

/**
 * @route POST /api/user-testing/sessions/:sessionId/start
 * @desc Start a testing session
 * @access Private
 */
router.post('/sessions/:sessionId/start', uatController.startTestingSession.bind(uatController));

/**
 * @route POST /api/user-testing/feedback
 * @desc Submit user feedback
 * @access Private
 */
router.post('/feedback', uatController.submitFeedback.bind(uatController));

/**
 * @route GET /api/user-testing/issues
 * @desc Get usability issues analysis
 * @access Private
 */
router.get('/issues', uatController.getUsabilityIssues.bind(uatController));

/**
 * @route GET /api/user-testing/report
 * @desc Generate comprehensive testing report
 * @access Private
 */
router.get('/report', uatController.generateTestingReport.bind(uatController));

/**
 * @route GET /api/user-testing/demographics
 * @desc Get beta tester demographics
 * @access Private
 */
router.get('/demographics', uatController.getBetaTesterDemographics.bind(uatController));

/**
 * @route GET /api/user-testing/progress
 * @desc Get testing progress overview
 * @access Private
 */
router.get('/progress', uatController.getTestingProgress.bind(uatController));

/**
 * @route GET /api/user-testing/export
 * @desc Export testing data for analysis
 * @access Private
 */
router.get('/export', uatController.exportTestingData.bind(uatController));

export default router;