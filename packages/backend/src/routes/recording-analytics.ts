import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { recordingAnalyticsController } from '../controllers/recording-analytics-controller';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/recording-analytics/events
 * @desc Track a recording analytics event
 * @access Private
 */
router.post('/events', recordingAnalyticsController.trackEvent);

/**
 * @route GET /api/recording-analytics/completion-metrics
 * @desc Get recording completion metrics
 * @query projectId - Optional project ID filter
 * @query startDate - Optional start date filter (ISO string)
 * @query endDate - Optional end date filter (ISO string)
 * @access Private
 */
router.get('/completion-metrics', recordingAnalyticsController.getCompletionMetrics);

/**
 * @route GET /api/recording-analytics/quality-metrics
 * @desc Get recording quality metrics
 * @query projectId - Optional project ID filter
 * @query startDate - Optional start date filter (ISO string)
 * @query endDate - Optional end date filter (ISO string)
 * @access Private
 */
router.get('/quality-metrics', recordingAnalyticsController.getQualityMetrics);

/**
 * @route GET /api/recording-analytics/device-metrics
 * @desc Get device and environment metrics
 * @query projectId - Optional project ID filter
 * @query startDate - Optional start date filter (ISO string)
 * @query endDate - Optional end date filter (ISO string)
 * @access Private
 */
router.get('/device-metrics', recordingAnalyticsController.getDeviceMetrics);

/**
 * @route GET /api/recording-analytics/insights
 * @desc Get recording insights and recommendations
 * @query projectId - Optional project ID filter
 * @access Private
 */
router.get('/insights', recordingAnalyticsController.getInsights);

/**
 * @route GET /api/recording-analytics/dashboard
 * @desc Get comprehensive analytics dashboard data
 * @query projectId - Optional project ID filter
 * @query startDate - Optional start date filter (ISO string)
 * @query endDate - Optional end date filter (ISO string)
 * @access Private
 */
router.get('/dashboard', recordingAnalyticsController.getDashboardData);

/**
 * @route GET /api/recording-analytics/duration-analysis
 * @desc Get detailed duration analysis and insights
 * @query projectId - Optional project ID filter
 * @query startDate - Optional start date filter (ISO string)
 * @query endDate - Optional end date filter (ISO string)
 * @access Private
 */
router.get('/duration-analysis', recordingAnalyticsController.getDurationAnalysis);

export default router;