import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics-service';
import { APMService } from '../services/apm-service';
import { AlertingService } from '../services/alerting-service';
import { MetricsService } from '../services/metrics-service';
import { LoggingService } from '../services/logging-service';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Middleware to check admin permissions
const adminOnly = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
  next();
};

/**
 * Get analytics dashboard data
 * GET /api/monitoring/analytics
 */
router.get('/analytics', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const [
      businessMetrics,
      usageMetrics,
      funnelMetrics,
      analyticsSummary,
    ] = await Promise.all([
      AnalyticsService.getBusinessMetrics(),
      AnalyticsService.getUsageMetrics(),
      AnalyticsService.getFunnelMetrics(),
      AnalyticsService.getAnalyticsSummary(),
    ]);

    res.json({
      success: true,
      data: {
        business: businessMetrics,
        usage: usageMetrics,
        funnel: funnelMetrics,
        summary: analyticsSummary,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    LoggingService.error('Failed to get analytics data', {
      requestId: req.requestId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve analytics data',
      },
    });
  }
});

/**
 * Get APM (Application Performance Monitoring) data
 * GET /api/monitoring/apm
 */
router.get('/apm', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 5 * 60 * 1000; // 5 minutes default
    
    const apmMetrics = APMService.getAPMMetrics(timeWindow);
    const recentTraces = APMService.getRecentTraces(50);
    const slowTraces = APMService.getSlowTraces(1000, 20);
    const errorTraces = APMService.getErrorTraces(20);

    res.json({
      success: true,
      data: {
        metrics: apmMetrics,
        recentTraces,
        slowTraces,
        errorTraces,
        timeWindow,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    LoggingService.error('Failed to get APM data', {
      requestId: req.requestId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'APM_ERROR',
        message: 'Failed to retrieve APM data',
      },
    });
  }
});

/**
 * Get specific trace details
 * GET /api/monitoring/apm/traces/:traceId
 */
router.get('/apm/traces/:traceId', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const { traceId } = req.params;
    const trace = APMService.getTrace(traceId);

    if (!trace) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRACE_NOT_FOUND',
          message: 'Trace not found',
        },
      });
    }

    res.json({
      success: true,
      data: trace,
    });
  } catch (error) {
    LoggingService.error('Failed to get trace details', {
      requestId: req.requestId,
      traceId: req.params.traceId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'TRACE_ERROR',
        message: 'Failed to retrieve trace details',
      },
    });
  }
});

/**
 * Get alerts dashboard data
 * GET /api/monitoring/alerts
 */
router.get('/alerts', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const activeAlerts = AlertingService.getActiveAlerts();
    const alertStatistics = AlertingService.getAlertStatistics();
    const alertRules = AlertingService.getRules();

    res.json({
      success: true,
      data: {
        activeAlerts,
        statistics: alertStatistics,
        rules: alertRules,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    LoggingService.error('Failed to get alerts data', {
      requestId: req.requestId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_ERROR',
        message: 'Failed to retrieve alerts data',
      },
    });
  }
});

/**
 * Acknowledge an alert
 * POST /api/monitoring/alerts/:alertId/acknowledge
 */
router.post('/alerts/:alertId/acknowledge', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const userId = (req as any).user.id;
    const userName = (req as any).user.name || 'Unknown';

    const success = AlertingService.acknowledgeAlert(alertId, `${userName} (${userId})`);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
    });
  } catch (error) {
    LoggingService.error('Failed to acknowledge alert', {
      requestId: req.requestId,
      alertId: req.params.alertId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ACKNOWLEDGE_ERROR',
        message: 'Failed to acknowledge alert',
      },
    });
  }
});

/**
 * Resolve an alert
 * POST /api/monitoring/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const userId = (req as any).user.id;
    const userName = (req as any).user.name || 'Unknown';

    const success = AlertingService.resolveAlert(alertId, `${userName} (${userId})`);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });
  } catch (error) {
    LoggingService.error('Failed to resolve alert', {
      requestId: req.requestId,
      alertId: req.params.alertId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_ERROR',
        message: 'Failed to resolve alert',
      },
    });
  }
});

/**
 * Suppress an alert
 * POST /api/monitoring/alerts/:alertId/suppress
 */
router.post('/alerts/:alertId/suppress', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.id;
    const userName = (req as any).user.name || 'Unknown';

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Suppression reason is required',
        },
      });
    }

    const success = AlertingService.suppressAlert(alertId, `${userName} (${userId})`, reason);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json({
      success: true,
      message: 'Alert suppressed successfully',
    });
  } catch (error) {
    LoggingService.error('Failed to suppress alert', {
      requestId: req.requestId,
      alertId: req.params.alertId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SUPPRESS_ERROR',
        message: 'Failed to suppress alert',
      },
    });
  }
});

/**
 * Get user events for analytics
 * GET /api/monitoring/analytics/users/:userId/events
 */
router.get('/analytics/users/:userId/events', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const events = AnalyticsService.getUserEvents(userId, limit);

    res.json({
      success: true,
      data: {
        userId,
        events,
        count: events.length,
      },
    });
  } catch (error) {
    LoggingService.error('Failed to get user events', {
      requestId: req.requestId,
      userId: req.params.userId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'USER_EVENTS_ERROR',
        message: 'Failed to retrieve user events',
      },
    });
  }
});

/**
 * Export analytics data
 * GET /api/monitoring/analytics/export
 */
router.get('/analytics/export', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const analyticsData = AnalyticsService.exportAnalytics(startDate, endDate);

    res.json({
      success: true,
      data: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        events: analyticsData,
        count: analyticsData.length,
      },
    });
  } catch (error) {
    LoggingService.error('Failed to export analytics data', {
      requestId: req.requestId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export analytics data',
      },
    });
  }
});

/**
 * Export APM traces
 * GET /api/monitoring/apm/export
 */
router.get('/apm/export', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'opentelemetry';
    
    if (!['opentelemetry', 'jaeger', 'zipkin'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Invalid export format. Supported formats: opentelemetry, jaeger, zipkin',
        },
      });
    }

    const traces = APMService.exportTraces(format as any);

    res.json({
      success: true,
      data: {
        format,
        traces,
        count: traces.length,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    LoggingService.error('Failed to export APM traces', {
      requestId: req.requestId,
      format: req.query.format,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export APM traces',
      },
    });
  }
});

/**
 * Get system metrics summary
 * GET /api/monitoring/metrics
 */
router.get('/metrics', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const performanceMetrics = MetricsService.getPerformanceMetrics();
    const businessMetrics = MetricsService.getBusinessMetrics();
    const metricNames = MetricsService.getMetricNames();

    res.json({
      success: true,
      data: {
        performance: performanceMetrics,
        business: businessMetrics,
        availableMetrics: metricNames,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    LoggingService.error('Failed to get metrics summary', {
      requestId: req.requestId,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to retrieve metrics summary',
      },
    });
  }
});

/**
 * Get specific metric data
 * GET /api/monitoring/metrics/:metricName
 */
router.get('/metrics/:metricName', authMiddleware, adminOnly, (req: Request, res: Response) => {
  try {
    const { metricName } = req.params;
    const since = req.query.since ? parseInt(req.query.since as string) : undefined;

    const metrics = MetricsService.getMetrics(metricName, since);

    res.json({
      success: true,
      data: {
        metricName,
        metrics,
        count: metrics.length,
      },
    });
  } catch (error) {
    LoggingService.error('Failed to get specific metric data', {
      requestId: req.requestId,
      metricName: req.params.metricName,
      error: error as Error,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'METRIC_ERROR',
        message: 'Failed to retrieve metric data',
      },
    });
  }
});

export default router;