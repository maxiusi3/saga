import { Router } from 'express';
import { ArchivalAnalyticsController } from '../controllers/archival-analytics-controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/archival-analytics/metrics
 * @desc Get archival metrics overview
 * @access Private (Admin)
 */
router.get('/metrics', ArchivalAnalyticsController.getArchivalMetrics);

/**
 * @route GET /api/archival-analytics/subscription-health
 * @desc Get subscription health metrics
 * @access Private (Admin)
 */
router.get('/subscription-health', ArchivalAnalyticsController.getSubscriptionHealthMetrics);

/**
 * @route GET /api/archival-analytics/report
 * @desc Generate archival report for a specific period
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @access Private (Admin)
 */
router.get('/report', ArchivalAnalyticsController.generateArchivalReport);

/**
 * @route GET /api/archival-analytics/expiring-projects
 * @desc Get projects approaching expiry
 * @query daysThreshold - Number of days threshold (default: 7)
 * @access Private (Admin)
 */
router.get('/expiring-projects', ArchivalAnalyticsController.getProjectsApproachingExpiry);

/**
 * @route GET /api/archival-analytics/dashboard
 * @desc Get combined archival dashboard data
 * @access Private (Admin)
 */
router.get('/dashboard', ArchivalAnalyticsController.getArchivalDashboard);

/**
 * @route GET /api/archival-analytics/export
 * @desc Export archival analytics data
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @query format - Export format (json|csv, default: json)
 * @access Private (Admin)
 */
router.get('/export', ArchivalAnalyticsController.exportArchivalData);

export default router;