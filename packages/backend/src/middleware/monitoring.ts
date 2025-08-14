import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggingService } from '../services/logging-service';
import { MetricsService } from '../services/metrics-service';
import { SentryService } from '../config/sentry';

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      userAgent?: string;
      realIp?: string;
      skipLogging?: boolean;
    }
  }
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Set Sentry context
  SentryService.setTag('requestId', req.requestId);
  
  next();
}

/**
 * Request logging middleware
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract client information
  req.userAgent = req.headers['user-agent'];
  req.realIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.headers['x-real-ip'] as string || 
               req.connection.remoteAddress;

  // Log request start
  LoggingService.debug(`Request started: ${req.method} ${req.path}`, {
    requestId: req.requestId,
    method: req.method,
    url: req.path,
    userAgent: req.userAgent,
    ip: req.realIp,
    query: req.query,
  });

  // Record metrics
  MetricsService.recordCounter('http.requests', 1, {
    method: req.method,
    path: req.route?.path || req.path,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const responseTime = Date.now() - req.startTime;
    
    // Log request completion
    LoggingService.logAPIRequest(
      req.method,
      req.path,
      res.statusCode,
      responseTime,
      {
        requestId: req.requestId,
        userAgent: req.userAgent,
        ip: req.realIp,
        contentLength: res.get('content-length'),
      }
    );

    // Record metrics
    MetricsService.recordHttpRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      responseTime
    );

    // Call original end
    return originalEnd.call(this, chunk, encoding) as Response;
  };

  next();
}

/**
 * User context middleware - adds user information to logs and monitoring
 */
export function userContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract user from JWT token if available
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Decode JWT without verification (just for logging context)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      if (payload.userId) {
        // Set Sentry user context
        SentryService.setUser({
          id: payload.userId,
          email: payload.email,
          username: payload.name,
        });

        // Add to request for logging
        (req as any).userId = payload.userId;
        (req as any).userEmail = payload.email;
      }
    } catch (error) {
      // Invalid token, but don't fail the request
      LoggingService.debug('Failed to decode JWT for logging context', {
        requestId: req.requestId,
        error: error as Error,
      });
    }
  }

  next();
}

/**
 * Error tracking middleware
 */
export function errorTrackingMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void {
  const responseTime = Date.now() - req.startTime;
  
  // Log error with context
  LoggingService.error(`Request error: ${error.message}`, {
    requestId: req.requestId,
    method: req.method,
    url: req.path,
    statusCode: res.statusCode,
    responseTime,
    userAgent: req.userAgent,
    ip: req.realIp,
    userId: (req as any).userId,
    error,
    stack: error.stack,
  });

  // Record error metrics
  MetricsService.recordCounter('http.errors', 1, {
    method: req.method,
    path: req.route?.path || req.path,
    status: res.statusCode.toString(),
  });

  // Set Sentry context and capture
  SentryService.setContext('request', {
    method: req.method,
    url: req.path,
    headers: req.headers,
    query: req.query,
    body: req.body,
  });

  SentryService.captureException(error, {
    tags: {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    },
    extra: {
      responseTime,
      userAgent: req.userAgent,
      ip: req.realIp,
    },
  });

  next(error);
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  
  // Monitor memory usage
  const memoryBefore = process.memoryUsage();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    const memoryAfter = process.memoryUsage();
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    // Record performance metrics
    MetricsService.recordTiming('http.request_duration', Date.now() - duration, {
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode.toString(),
    });
    
    if (memoryDelta > 0) {
      MetricsService.recordGauge('http.memory_delta', memoryDelta, 'bytes', {
        method: req.method,
        path: req.route?.path || req.path,
      });
    }
    
    // Log slow requests
    if (duration > 1000) { // Slower than 1 second
      LoggingService.warn(`Slow request detected: ${req.method} ${req.path}`, {
        requestId: req.requestId,
        duration,
        memoryDelta,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

/**
 * Rate limiting monitoring middleware
 */
export function rateLimitMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if request was rate limited
  if (res.getHeader('X-RateLimit-Remaining')) {
    const remaining = parseInt(res.getHeader('X-RateLimit-Remaining') as string || '0');
    const limit = parseInt(res.getHeader('X-RateLimit-Limit') as string || '0');
    
    MetricsService.recordGauge('ratelimit.remaining', remaining, 'count', {
      ip: req.realIp || 'unknown',
      endpoint: req.route?.path || req.path,
    });
    
    // Alert if rate limit is being approached
    if (remaining < limit * 0.1) { // Less than 10% remaining
      LoggingService.warn('Rate limit approaching', {
        requestId: req.requestId,
        ip: req.realIp,
        remaining,
        limit,
        endpoint: req.path,
      });
    }
  }

  next();
}

/**
 * Security monitoring middleware
 */
export function securityMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
  ];

  const requestData = JSON.stringify({
    url: req.path,
    query: req.query,
    body: req.body,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      LoggingService.logSecurityEvent('suspicious_request_pattern', 'medium', {
        requestId: req.requestId,
        pattern: pattern.source,
        ip: req.realIp,
        userAgent: req.userAgent,
        url: req.path,
        method: req.method,
      });

      MetricsService.recordCounter('security.suspicious_requests', 1, {
        pattern: pattern.source,
        ip: req.realIp?.substring(0, 10) || 'unknown', // Partial IP for privacy
      });
      
      break;
    }
  }

  // Monitor failed authentication attempts
  if (req.path.includes('/auth/') && res.statusCode === 401) {
    LoggingService.logSecurityEvent('failed_authentication', 'low', {
      requestId: req.requestId,
      ip: req.realIp,
      userAgent: req.userAgent,
      endpoint: req.path,
    });

    MetricsService.recordCounter('security.failed_auth', 1, {
      endpoint: req.path,
      ip: req.realIp?.substring(0, 10) || 'unknown',
    });
  }

  next();
}

/**
 * Business metrics middleware
 */
export function businessMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    // Only track successful requests
    if (res.statusCode < 400) {
      const userId = (req as any).userId;
      
      // Track business events
      if (req.method === 'POST') {
        if (req.path.includes('/stories')) {
          MetricsService.recordCounter('business.stories_uploaded', 1, {
            userId: userId?.substring(0, 8),
          });
          LoggingService.logStoryUpload(
            (res.getHeader('X-Story-ID') as string) || 'unknown',
            userId || 'anonymous',
            parseInt((req.headers['content-length'] as string) || '0'),
            { requestId: req.requestId }
          );
        } else if (req.path.includes('/chapters')) {
          MetricsService.recordCounter('business.chapters_generated', 1, {
            userId: userId?.substring(0, 8),
          });
        } else if (req.path.includes('/exports')) {
          MetricsService.recordCounter('business.exports_requested', 1, {
            userId: userId?.substring(0, 8),
          });
        } else if (req.path.includes('/subscriptions')) {
          MetricsService.recordCounter('business.payments_processed', 1, {
            userId: userId?.substring(0, 8),
          });
        }
      }
    }
  });

  next();
}

/**
 * Health check middleware - lightweight monitoring for health endpoints
 */
export function healthCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health' || req.path === '/health/simple') {
    // Skip detailed logging for health checks
    req.skipLogging = true;
  }
  next();
}