import { LoggingService } from './logging-service';
import { db } from '../config/database';
import { redisClient } from '../config/redis';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    unhealthy: number;
    degraded: number;
    total: number;
  };
}

class HealthCheckServiceClass {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];
    
    // Run all health checks in parallel
    const checkPromises = [
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
      this.checkFileSystem(),
      this.checkMemoryUsage(),
    ];

    const results = await Promise.allSettled(checkPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(...(Array.isArray(result.value) ? result.value : [result.value]));
      } else {
        checks.push({
          service: `health-check-${index}`,
          status: 'unhealthy',
          responseTime: 0,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    // Calculate summary
    const summary = {
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      total: checks.length,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const health: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
    };

    // Log health check results
    const logStatus = overallStatus === 'degraded' ? 'unhealthy' : overallStatus;
    LoggingService.logHealthCheck('system', logStatus, undefined, {
      summary,
      unhealthyServices: checks.filter(c => c.status === 'unhealthy').map(c => c.service),
    });

    return health;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await db.raw('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          type: 'postgresql',
          connectionPool: {
            min: db.client.pool?.min || 0,
            max: db.client.pool?.max || 0,
            used: db.client.pool?.numUsed() || 0,
            free: db.client.pool?.numFree() || 0,
          },
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await redisClient.ping();
      const responseTime = Date.now() - startTime;
      
      // Get Redis info
      const info = await redisClient.info('memory');
      const memoryUsed = this.parseRedisInfo(info, 'used_memory_human');
      
      return {
        service: 'redis',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          memoryUsed,
          connected: redisClient.isReady,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<HealthCheckResult[]> {
    const checks: HealthCheckResult[] = [];
    
    // Check OpenAI API
    if (process.env.OPENAI_API_KEY) {
      checks.push(await this.checkOpenAI());
    }
    
    // Check AWS S3
    if (process.env.AWS_S3_BUCKET) {
      checks.push(await this.checkAWS());
    }
    
    // Check Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      checks.push(await this.checkStripe());
    }

    return checks;
  }

  /**
   * Check OpenAI API
   */
  private async checkOpenAI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'openai',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        details: {
          statusCode: response.status,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'openai',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'OpenAI API check failed',
      };
    }
  }

  /**
   * Check AWS services
   */
  private async checkAWS(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple S3 head bucket operation
      const AWS = await import('aws-sdk');
      const s3 = new AWS.S3();
      
      await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET! }).promise();
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'aws-s3',
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          bucket: process.env.AWS_S3_BUCKET,
          region: process.env.AWS_REGION,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'aws-s3',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'AWS S3 check failed',
      };
    }
  }

  /**
   * Check Stripe API
   */
  private async checkStripe(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'stripe',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        details: {
          statusCode: response.status,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'stripe',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Stripe API check failed',
      };
    }
  }

  /**
   * Check file system
   */
  private async checkFileSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Check if we can write to temp directory
      const tempFile = path.join('/tmp', `health-check-${Date.now()}.txt`);
      await fs.writeFile(tempFile, 'health check');
      await fs.unlink(tempFile);
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'filesystem',
        status: 'healthy',
        responseTime,
        details: {
          writable: true,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'filesystem',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'File system check failed',
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;
      
      // Convert bytes to MB
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      // Consider degraded if heap usage is over 80%
      const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const status = heapUsagePercent > 80 ? 'degraded' : 'healthy';
      
      return {
        service: 'memory',
        status,
        responseTime,
        details: {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          rss: `${rssMB}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          heapUsagePercent: Math.round(heapUsagePercent),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'memory',
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Memory check failed',
      };
    }
  }

  /**
   * Parse Redis info string
   */
  private parseRedisInfo(info: string, key: string): string | undefined {
    const lines = info.split('\r\n');
    const line = lines.find(l => l.startsWith(`${key}:`));
    return line ? line.split(':')[1] : undefined;
  }

  /**
   * Get simple health status (for load balancer)
   */
  async getSimpleHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      // Quick checks for critical services
      await Promise.all([
        db.raw('SELECT 1'),
        redisClient.ping(),
      ]);
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      LoggingService.error('Simple health check failed', { error: error as Error });
      
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const HealthCheckService = new HealthCheckServiceClass();