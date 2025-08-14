import { Router, Request, Response } from 'express';
import { HealthCheckService } from '../services/health-check-service';
import { MetricsService } from '../services/metrics-service';
import { LoggingService } from '../services/logging-service';

const router = Router();

/**
 * Simple health check for load balancers
 * GET /health/simple
 */
router.get('/simple', async (req: Request, res: Response) => {
  try {
    const health = await HealthCheckService.getSimpleHealth();
    
    if (health.status === 'ok') {
      res.status(200).json(health);
    } else {
      res.status(503).json(health);
    }
  } catch (error) {
    LoggingService.error('Simple health check failed', {
      requestId: req.requestId,
      error: error as Error,
    });
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Comprehensive health check
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await HealthCheckService.performHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    LoggingService.error('Comprehensive health check failed', {
      requestId: req.requestId,
      error: error as Error,
    });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      checks: [],
      summary: { healthy: 0, unhealthy: 1, degraded: 0, total: 1 },
    });
  }
});

/**
 * Performance metrics endpoint
 * GET /health/metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const performanceMetrics = MetricsService.getPerformanceMetrics();
    const businessMetrics = MetricsService.getBusinessMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      performance: performanceMetrics,
      business: businessMetrics,
    });
  } catch (error) {
    LoggingService.error('Metrics endpoint failed', {
      requestId: req.requestId,
      error: error as Error,
    });
    
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Prometheus metrics endpoint
 * GET /health/prometheus
 */
router.get('/prometheus', (req: Request, res: Response) => {
  try {
    const prometheusMetrics = MetricsService.exportPrometheusMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
  } catch (error) {
    LoggingService.error('Prometheus metrics endpoint failed', {
      requestId: req.requestId,
      error: error as Error,
    });
    
    res.status(500).send('# Error generating metrics\n');
  }
});

/**
 * System information endpoint
 * GET /health/info
 */
router.get('/info', (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemInfo = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024) + 'MB',
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    };
    
    res.json(systemInfo);
  } catch (error) {
    LoggingService.error('System info endpoint failed', {
      requestId: req.requestId,
      error: error as Error,
    });
    
    res.status(500).json({
      error: 'Failed to retrieve system information',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness probe for Kubernetes
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if application is ready to serve traffic
    const health = await HealthCheckService.getSimpleHealth();
    
    if (health.status === 'ok') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

/**
 * Liveness probe for Kubernetes
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;