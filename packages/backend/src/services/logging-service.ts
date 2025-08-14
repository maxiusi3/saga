import winston from 'winston';
import { SentryService } from '../config/sentry';

export interface LogContext {
  userId?: string;
  projectId?: string;
  storyId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  error?: Error;
  [key: string]: any;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class LoggingServiceClass {
  private logger: winston.Logger;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ];

    // Add colorization for development
    if (!this.isProduction) {
      formats.unshift(winston.format.colorize());
    }

    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: this.isProduction ? 'info' : 'debug',
        format: winston.format.combine(...formats),
      }),
    ];

    // Add file transports for production
    if (this.isProduction) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );
    }

    return winston.createLogger({
      level: this.isProduction ? 'info' : 'debug',
      format: winston.format.combine(...formats),
      transports,
      // Don't exit on handled exceptions
      exitOnError: false,
    });
  }

  private formatMessage(message: string, context?: LogContext): any {
    const logEntry: any = {
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      service: 'saga-backend',
    };

    if (context) {
      // Add structured context
      Object.keys(context).forEach(key => {
        if (context[key] !== undefined) {
          logEntry[key] = context[key];
        }
      });

      // Add correlation ID for request tracing
      if (context.requestId) {
        logEntry.correlationId = context.requestId;
      }
    }

    return logEntry;
  }

  error(message: string, context?: LogContext): void {
    const logEntry = this.formatMessage(message, context);
    this.logger.error(logEntry);

    // Send to Sentry if available
    if (context?.error) {
      SentryService.captureException(context.error, {
        tags: {
          userId: context.userId,
          projectId: context.projectId,
          storyId: context.storyId,
        },
        extra: context,
      });
    } else {
      SentryService.captureMessage(message, 'error', {
        tags: {
          userId: context?.userId,
          projectId: context?.projectId,
        },
        extra: context,
      });
    }
  }

  warn(message: string, context?: LogContext): void {
    const logEntry = this.formatMessage(message, context);
    this.logger.warn(logEntry);

    // Send warnings to Sentry in production
    if (this.isProduction) {
      SentryService.captureMessage(message, 'warning', {
        tags: {
          userId: context?.userId,
          projectId: context?.projectId,
        },
        extra: context,
      });
    }
  }

  info(message: string, context?: LogContext): void {
    const logEntry = this.formatMessage(message, context);
    this.logger.info(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    const logEntry = this.formatMessage(message, context);
    this.logger.debug(logEntry);
  }

  // Structured logging methods for specific events
  logUserAction(action: string, userId: string, context?: LogContext): void {
    this.info(`User action: ${action}`, {
      ...context,
      userId,
      eventType: 'user_action',
      action,
    });
  }

  logAPIRequest(method: string, url: string, statusCode: number, responseTime: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    this[level](`${method} ${url} ${statusCode} - ${responseTime}ms`, {
      ...context,
      eventType: 'api_request',
      method,
      url,
      statusCode,
      responseTime,
    });
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext): void {
    this.debug(`Database query executed in ${duration}ms`, {
      ...context,
      eventType: 'database_query',
      query: query.substring(0, 200), // Truncate long queries
      duration,
    });
  }

  logExternalAPICall(service: string, endpoint: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'error' : 'info';
    
    this[level](`External API call to ${service}: ${statusCode} - ${duration}ms`, {
      ...context,
      eventType: 'external_api_call',
      service,
      endpoint,
      statusCode,
      duration,
    });
  }

  logFileUpload(fileName: string, fileSize: number, uploadTime: number, context?: LogContext): void {
    this.info(`File uploaded: ${fileName} (${fileSize} bytes) in ${uploadTime}ms`, {
      ...context,
      eventType: 'file_upload',
      fileName,
      fileSize,
      uploadTime,
    });
  }

  logAudioProcessing(storyId: string, duration: number, provider: string, context?: LogContext): void {
    this.info(`Audio processed for story ${storyId} in ${duration}ms using ${provider}`, {
      ...context,
      storyId,
      eventType: 'audio_processing',
      duration,
      provider,
    });
  }

  logPaymentEvent(event: string, amount: number, currency: string, context?: LogContext): void {
    this.info(`Payment event: ${event} - ${amount} ${currency}`, {
      ...context,
      eventType: 'payment',
      event,
      amount,
      currency,
    });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', context?: LogContext): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    const sentryLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info';
    
    this[level](`Security event: ${event}`, {
      ...context,
      eventType: 'security',
      event,
      severity,
    });

    // Always send security events to Sentry
    SentryService.captureMessage(`Security event: ${event}`, sentryLevel as any, {
      tags: {
        eventType: 'security',
        severity,
      },
      extra: context,
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context?: LogContext): void {
    this.info(`Performance metric: ${metric} = ${value}${unit}`, {
      ...context,
      eventType: 'performance',
      metric,
      value,
      unit,
    });
  }

  // Business logic logging
  logStoryUpload(storyId: string, userId: string, fileSize: number, context?: LogContext): void {
    this.info(`Story uploaded: ${storyId}`, {
      ...context,
      storyId,
      userId,
      eventType: 'story_upload',
      fileSize,
    });
  }

  logChapterGeneration(projectId: string, chapterCount: number, duration: number, context?: LogContext): void {
    this.info(`Generated ${chapterCount} chapters for project ${projectId} in ${duration}ms`, {
      ...context,
      projectId,
      eventType: 'chapter_generation',
      chapterCount,
      duration,
    });
  }

  logExportRequest(projectId: string, userId: string, exportType: string, context?: LogContext): void {
    this.info(`Export requested: ${exportType} for project ${projectId}`, {
      ...context,
      projectId,
      userId,
      eventType: 'export_request',
      exportType,
    });
  }

  // Health check logging
  logHealthCheck(service: string, status: 'healthy' | 'unhealthy', responseTime?: number, context?: LogContext): void {
    const level = status === 'healthy' ? 'debug' : 'error';
    
    this[level](`Health check: ${service} is ${status}`, {
      ...context,
      eventType: 'health_check',
      service,
      status,
      responseTime,
    });
  }

  // Create child logger with persistent context
  createChildLogger(persistentContext: LogContext): ChildLogger {
    return new ChildLogger(this, persistentContext);
  }
}

class ChildLogger {
  constructor(
    private parent: LoggingServiceClass,
    private persistentContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.persistentContext, ...context };
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  logUserAction(action: string, userId: string, context?: LogContext): void {
    this.parent.logUserAction(action, userId, this.mergeContext(context));
  }

  logAPIRequest(method: string, url: string, statusCode: number, responseTime: number, context?: LogContext): void {
    this.parent.logAPIRequest(method, url, statusCode, responseTime, this.mergeContext(context));
  }
}

export const LoggingService = new LoggingServiceClass();
export { ChildLogger };