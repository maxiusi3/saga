import { LoggingService } from './logging-service';
import { MetricsService } from './metrics-service';
import { SentryService } from '../config/sentry';

export interface PerformanceTrace {
  id: string;
  name: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  tags: Record<string, string>;
  metadata: Record<string, any>;
  spans: PerformanceSpan[];
}

export interface PerformanceSpan {
  id: string;
  parentId?: string;
  name: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  tags: Record<string, string>;
  metadata: Record<string, any>;
}

export interface APMMetrics {
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  apdex: number;
  slowestEndpoints: Array<{
    endpoint: string;
    averageTime: number;
    callCount: number;
  }>;
  errorBreakdown: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

class APMServiceClass {
  private traces: Map<string, PerformanceTrace> = new Map();
  private completedTraces: PerformanceTrace[] = [];
  private readonly MAX_COMPLETED_TRACES = 1000;
  private readonly SLOW_THRESHOLD = 1000; // 1 second
  private readonly APDEX_THRESHOLD = 500; // 0.5 seconds

  /**
   * Start a new performance trace
   */
  startTrace(name: string, operation: string, tags: Record<string, string> = {}): string {
    const traceId = this.generateId();
    
    const trace: PerformanceTrace = {
      id: traceId,
      name,
      operation,
      startTime: Date.now(),
      status: 'pending',
      tags: {
        ...tags,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      },
      metadata: {},
      spans: [],
    };

    this.traces.set(traceId, trace);

    // Start Sentry transaction if available
    const sentryTransaction = SentryService.startTransaction(name, operation);
    if (sentryTransaction) {
      trace.metadata.sentryTransaction = sentryTransaction;
    }

    return traceId;
  }

  /**
   * Finish a performance trace
   */
  finishTrace(traceId: string, status: 'success' | 'error' = 'success', metadata: Record<string, any> = {}): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      LoggingService.warn('Attempted to finish non-existent trace', { traceId });
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;
    trace.metadata = { ...trace.metadata, ...metadata };

    // Finish Sentry transaction
    if (trace.metadata.sentryTransaction) {
      trace.metadata.sentryTransaction.setStatus(status === 'success' ? 'ok' : 'internal_error');
      trace.metadata.sentryTransaction.finish();
    }

    // Record metrics
    MetricsService.recordTiming(
      `apm.${trace.operation}.duration`,
      trace.startTime,
      {
        name: trace.name,
        status,
        ...trace.tags,
      }
    );

    // Log slow traces
    if (trace.duration > this.SLOW_THRESHOLD) {
      LoggingService.warn('Slow trace detected', {
        traceId,
        name: trace.name,
        operation: trace.operation,
        duration: trace.duration,
        tags: trace.tags,
      });
    }

    // Move to completed traces
    this.traces.delete(traceId);
    this.completedTraces.push(trace);

    // Limit memory usage
    if (this.completedTraces.length > this.MAX_COMPLETED_TRACES) {
      this.completedTraces.shift();
    }
  }

  /**
   * Start a span within a trace
   */
  startSpan(traceId: string, name: string, operation: string, parentSpanId?: string, tags: Record<string, string> = {}): string {
    const trace = this.traces.get(traceId);
    if (!trace) {
      LoggingService.warn('Attempted to start span on non-existent trace', { traceId, name });
      return '';
    }

    const spanId = this.generateId();
    
    const span: PerformanceSpan = {
      id: spanId,
      parentId: parentSpanId,
      name,
      operation,
      startTime: Date.now(),
      status: 'pending',
      tags,
      metadata: {},
    };

    trace.spans.push(span);

    return spanId;
  }

  /**
   * Finish a span
   */
  finishSpan(traceId: string, spanId: string, status: 'success' | 'error' = 'success', metadata: Record<string, any> = {}): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      LoggingService.warn('Attempted to finish span on non-existent trace', { traceId, spanId });
      return;
    }

    const span = trace.spans.find(s => s.id === spanId);
    if (!span) {
      LoggingService.warn('Attempted to finish non-existent span', { traceId, spanId });
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    span.metadata = { ...span.metadata, ...metadata };

    // Record span metrics
    MetricsService.recordTiming(
      `apm.span.${span.operation}.duration`,
      span.startTime,
      {
        name: span.name,
        status,
        traceId,
        ...span.tags,
      }
    );
  }

  /**
   * Add metadata to a trace
   */
  addTraceMetadata(traceId: string, metadata: Record<string, any>): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.metadata = { ...trace.metadata, ...metadata };
    }
  }

  /**
   * Add tags to a trace
   */
  addTraceTags(traceId: string, tags: Record<string, string>): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.tags = { ...trace.tags, ...tags };
    }
  }

  /**
   * Get APM metrics
   */
  getAPMMetrics(timeWindowMs: number = 5 * 60 * 1000): APMMetrics {
    const cutoff = Date.now() - timeWindowMs;
    const recentTraces = this.completedTraces.filter(t => t.startTime >= cutoff);

    if (recentTraces.length === 0) {
      return {
        averageResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        apdex: 1,
        slowestEndpoints: [],
        errorBreakdown: [],
      };
    }

    // Calculate average response time
    const totalDuration = recentTraces.reduce((sum, t) => sum + (t.duration || 0), 0);
    const averageResponseTime = totalDuration / recentTraces.length;

    // Calculate throughput (requests per minute)
    const throughput = (recentTraces.length / timeWindowMs) * 60 * 1000;

    // Calculate error rate
    const errorCount = recentTraces.filter(t => t.status === 'error').length;
    const errorRate = (errorCount / recentTraces.length) * 100;

    // Calculate Apdex score
    const satisfiedCount = recentTraces.filter(t => (t.duration || 0) <= this.APDEX_THRESHOLD).length;
    const toleratingCount = recentTraces.filter(t => {
      const duration = t.duration || 0;
      return duration > this.APDEX_THRESHOLD && duration <= this.APDEX_THRESHOLD * 4;
    }).length;
    const apdex = (satisfiedCount + (toleratingCount * 0.5)) / recentTraces.length;

    // Find slowest endpoints
    const endpointStats = new Map<string, { totalTime: number; count: number }>();
    recentTraces.forEach(trace => {
      const endpoint = trace.name;
      const stats = endpointStats.get(endpoint) || { totalTime: 0, count: 0 };
      stats.totalTime += trace.duration || 0;
      stats.count += 1;
      endpointStats.set(endpoint, stats);
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.totalTime / stats.count,
        callCount: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Error breakdown
    const errorStats = new Map<string, number>();
    recentTraces
      .filter(t => t.status === 'error')
      .forEach(trace => {
        const errorType = trace.metadata.error?.name || 'Unknown Error';
        errorStats.set(errorType, (errorStats.get(errorType) || 0) + 1);
      });

    const errorBreakdown = Array.from(errorStats.entries())
      .map(([error, count]) => ({
        error,
        count,
        percentage: (count / errorCount) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      averageResponseTime,
      throughput,
      errorRate,
      apdex,
      slowestEndpoints,
      errorBreakdown,
    };
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): PerformanceTrace | undefined {
    return this.traces.get(traceId) || this.completedTraces.find(t => t.id === traceId);
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit: number = 50): PerformanceTrace[] {
    return this.completedTraces
      .sort((a, b) => (b.startTime) - (a.startTime))
      .slice(0, limit);
  }

  /**
   * Get traces by operation
   */
  getTracesByOperation(operation: string, limit: number = 50): PerformanceTrace[] {
    return this.completedTraces
      .filter(t => t.operation === operation)
      .sort((a, b) => (b.startTime) - (a.startTime))
      .slice(0, limit);
  }

  /**
   * Get slow traces
   */
  getSlowTraces(threshold: number = this.SLOW_THRESHOLD, limit: number = 50): PerformanceTrace[] {
    return this.completedTraces
      .filter(t => (t.duration || 0) > threshold)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  /**
   * Get error traces
   */
  getErrorTraces(limit: number = 50): PerformanceTrace[] {
    return this.completedTraces
      .filter(t => t.status === 'error')
      .sort((a, b) => (b.startTime) - (a.startTime))
      .slice(0, limit);
  }

  /**
   * Instrument a function with APM tracing
   */
  instrument<T extends (...args: any[]) => any>(
    name: string,
    operation: string,
    fn: T,
    tags: Record<string, string> = {}
  ): T {
    return ((...args: any[]) => {
      const traceId = this.startTrace(name, operation, tags);
      
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result && typeof result.then === 'function') {
          return result
            .then((value: any) => {
              this.finishTrace(traceId, 'success');
              return value;
            })
            .catch((error: any) => {
              this.finishTrace(traceId, 'error', { error });
              throw error;
            });
        }
        
        // Handle sync functions
        this.finishTrace(traceId, 'success');
        return result;
      } catch (error) {
        this.finishTrace(traceId, 'error', { error });
        throw error;
      }
    }) as T;
  }

  /**
   * Instrument a database query
   */
  instrumentQuery<T>(query: string, operation: () => Promise<T>): Promise<T> {
    const traceId = this.startTrace(`DB Query: ${query.substring(0, 50)}...`, 'db.query', {
      query: query.substring(0, 200),
    });

    return operation()
      .then(result => {
        this.finishTrace(traceId, 'success', { rowCount: Array.isArray(result) ? result.length : 1 });
        return result;
      })
      .catch(error => {
        this.finishTrace(traceId, 'error', { error });
        throw error;
      });
  }

  /**
   * Instrument an HTTP request
   */
  instrumentHTTPRequest<T>(url: string, method: string, operation: () => Promise<T>): Promise<T> {
    const traceId = this.startTrace(`HTTP ${method} ${url}`, 'http.request', {
      url,
      method,
    });

    return operation()
      .then(result => {
        this.finishTrace(traceId, 'success');
        return result;
      })
      .catch(error => {
        this.finishTrace(traceId, 'error', { error });
        throw error;
      });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Clean up old traces
   */
  cleanupOldTraces(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    this.completedTraces = this.completedTraces.filter(t => t.startTime >= cutoff);
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldTraces();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Export traces for external APM tools
   */
  exportTraces(format: 'jaeger' | 'zipkin' | 'opentelemetry' = 'opentelemetry'): any[] {
    switch (format) {
      case 'opentelemetry':
        return this.exportOpenTelemetryFormat();
      case 'jaeger':
        return this.exportJaegerFormat();
      case 'zipkin':
        return this.exportZipkinFormat();
      default:
        return this.completedTraces;
    }
  }

  /**
   * Export in OpenTelemetry format
   */
  private exportOpenTelemetryFormat(): any[] {
    return this.completedTraces.map(trace => ({
      traceId: trace.id,
      spanId: trace.id,
      operationName: trace.name,
      startTime: trace.startTime * 1000, // Convert to microseconds
      duration: (trace.duration || 0) * 1000,
      tags: trace.tags,
      process: {
        serviceName: 'saga-backend',
        tags: {
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
      },
      spans: trace.spans.map(span => ({
        traceId: trace.id,
        spanId: span.id,
        parentSpanId: span.parentId,
        operationName: span.name,
        startTime: span.startTime * 1000,
        duration: (span.duration || 0) * 1000,
        tags: span.tags,
      })),
    }));
  }

  /**
   * Export in Jaeger format
   */
  private exportJaegerFormat(): any[] {
    return this.completedTraces.map(trace => ({
      traceID: trace.id,
      spans: [
        {
          traceID: trace.id,
          spanID: trace.id,
          operationName: trace.name,
          startTime: trace.startTime * 1000,
          duration: (trace.duration || 0) * 1000,
          tags: Object.entries(trace.tags).map(([key, value]) => ({
            key,
            type: 'string',
            value,
          })),
          process: {
            serviceName: 'saga-backend',
            tags: [
              { key: 'version', value: process.env.npm_package_version || '1.0.0' },
              { key: 'environment', value: process.env.NODE_ENV || 'development' },
            ],
          },
        },
        ...trace.spans.map(span => ({
          traceID: trace.id,
          spanID: span.id,
          parentSpanID: span.parentId,
          operationName: span.name,
          startTime: span.startTime * 1000,
          duration: (span.duration || 0) * 1000,
          tags: Object.entries(span.tags).map(([key, value]) => ({
            key,
            type: 'string',
            value,
          })),
        })),
      ],
    }));
  }

  /**
   * Export in Zipkin format
   */
  private exportZipkinFormat(): any[] {
    const spans: any[] = [];
    
    this.completedTraces.forEach(trace => {
      // Root span
      spans.push({
        traceId: trace.id,
        id: trace.id,
        name: trace.name,
        timestamp: trace.startTime * 1000,
        duration: (trace.duration || 0) * 1000,
        localEndpoint: {
          serviceName: 'saga-backend',
        },
        tags: trace.tags,
      });

      // Child spans
      trace.spans.forEach(span => {
        spans.push({
          traceId: trace.id,
          id: span.id,
          parentId: span.parentId || trace.id,
          name: span.name,
          timestamp: span.startTime * 1000,
          duration: (span.duration || 0) * 1000,
          localEndpoint: {
            serviceName: 'saga-backend',
          },
          tags: span.tags,
        });
      });
    });

    return spans;
  }
}

export const APMService = new APMServiceClass();

// Start periodic cleanup - skip in test environment
if (process.env.NODE_ENV !== 'test') {
  APMService.startPeriodicCleanup();
}