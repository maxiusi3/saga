import { LoggingService } from './logging-service';

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
  dimensions?: Record<string, string>;
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface BusinessMetrics {
  activeUsers: number;
  storiesUploaded: number;
  chaptersGenerated: number;
  exportsRequested: number;
  paymentsProcessed: number;
}

class MetricsServiceClass {
  private metrics: Map<string, MetricData[]> = new Map();
  private readonly MAX_METRICS_PER_TYPE = 1000;
  private readonly METRIC_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Limit array size
    if (metricArray.length > this.MAX_METRICS_PER_TYPE) {
      metricArray.shift();
    }

    // Log performance metrics
    LoggingService.logPerformanceMetric(name, value, unit, { tags });
  }

  /**
   * Record timing metric
   */
  recordTiming(name: string, startTime: number, tags?: Record<string, string>): void {
    const duration = Date.now() - startTime;
    this.recordMetric(name, duration, 'ms', tags);
  }

  /**
   * Record counter metric
   */
  recordCounter(name: string, increment: number = 1, tags?: Record<string, string>): void {
    this.recordMetric(name, increment, 'count', tags);
  }

  /**
   * Record gauge metric
   */
  recordGauge(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.recordMetric(name, value, unit, tags);
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, since?: number): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    
    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }
    
    return [...metrics];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Calculate average for a metric over time period
   */
  getAverageMetric(name: string, timeWindowMs: number): number {
    const since = Date.now() - timeWindowMs;
    const metrics = this.getMetrics(name, since);
    
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  /**
   * Get performance metrics summary
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    return {
      requestCount: this.getMetrics('http.requests', Date.now() - timeWindow).length,
      averageResponseTime: this.getAverageMetric('http.response_time', timeWindow),
      errorRate: this.calculateErrorRate(timeWindow),
      activeConnections: this.getLatestMetricValue('http.active_connections') || 0,
      memoryUsage: this.getLatestMetricValue('system.memory_usage') || 0,
      cpuUsage: this.getLatestMetricValue('system.cpu_usage') || 0,
    };
  }

  /**
   * Get business metrics summary
   */
  getBusinessMetrics(): BusinessMetrics {
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    
    return {
      activeUsers: this.getLatestMetricValue('business.active_users') || 0,
      storiesUploaded: this.getMetrics('business.stories_uploaded', Date.now() - timeWindow).length,
      chaptersGenerated: this.getMetrics('business.chapters_generated', Date.now() - timeWindow).length,
      exportsRequested: this.getMetrics('business.exports_requested', Date.now() - timeWindow).length,
      paymentsProcessed: this.getMetrics('business.payments_processed', Date.now() - timeWindow).length,
    };
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(timeWindowMs: number): number {
    const since = Date.now() - timeWindowMs;
    const totalRequests = this.getMetrics('http.requests', since).length;
    const errorRequests = this.getMetrics('http.errors', since).length;
    
    if (totalRequests === 0) return 0;
    
    return (errorRequests / totalRequests) * 100;
  }

  /**
   * Get latest metric value
   */
  private getLatestMetricValue(name: string): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;
    
    return metrics[metrics.length - 1].value;
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.METRIC_RETENTION_MS;
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoff);
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;
      
      const latestMetric = metrics[metrics.length - 1];
      const metricName = name.replace(/\./g, '_');
      
      // Add help text
      lines.push(`# HELP ${metricName} ${name} metric`);
      lines.push(`# TYPE ${metricName} gauge`);
      
      // Add metric with tags
      let metricLine = `${metricName}`;
      if (latestMetric.tags && Object.keys(latestMetric.tags).length > 0) {
        const tagPairs = Object.entries(latestMetric.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        metricLine += `{${tagPairs}}`;
      }
      metricLine += ` ${latestMetric.value}`;
      
      lines.push(metricLine);
    }
    
    return lines.join('\n');
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Every hour
  }

  // Convenience methods for common metrics
  recordHttpRequest(method: string, path: string, statusCode: number, responseTime: number): void {
    this.recordCounter('http.requests', 1, { method, path, status: statusCode.toString() });
    this.recordTiming('http.response_time', Date.now() - responseTime, { method, path });
    
    if (statusCode >= 400) {
      this.recordCounter('http.errors', 1, { method, path, status: statusCode.toString() });
    }
  }

  recordDatabaseQuery(operation: string, table: string, duration: number): void {
    this.recordTiming('database.query_time', Date.now() - duration, { operation, table });
    this.recordCounter('database.queries', 1, { operation, table });
  }

  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string): void {
    this.recordCounter(`cache.${operation}`, 1, { key: key.substring(0, 50) });
  }

  recordFileUpload(fileType: string, fileSize: number, uploadTime: number): void {
    this.recordCounter('uploads.count', 1, { type: fileType });
    this.recordGauge('uploads.size', fileSize, 'bytes', { type: fileType });
    this.recordTiming('uploads.duration', Date.now() - uploadTime, { type: fileType });
  }

  recordAudioProcessing(provider: string, duration: number, success: boolean): void {
    this.recordTiming('audio.processing_time', Date.now() - duration, { provider });
    this.recordCounter('audio.processed', 1, { provider, success: success.toString() });
  }

  recordPayment(amount: number, currency: string, success: boolean): void {
    this.recordCounter('payments.count', 1, { currency, success: success.toString() });
    if (success) {
      this.recordGauge('payments.amount', amount, currency);
    }
  }

  recordUserAction(action: string, userId: string): void {
    this.recordCounter('user.actions', 1, { action, user: userId.substring(0, 8) });
  }

  recordSystemResource(resource: 'memory' | 'cpu' | 'disk', value: number, unit: string): void {
    this.recordGauge(`system.${resource}_usage`, value, unit);
  }

  recordWebSocketConnection(event: 'connect' | 'disconnect'): void {
    this.recordCounter(`websocket.${event}`, 1);
    
    // Update active connections gauge
    const currentConnections = this.getLatestMetricValue('websocket.active_connections') || 0;
    const newConnections = event === 'connect' ? currentConnections + 1 : Math.max(0, currentConnections - 1);
    this.recordGauge('websocket.active_connections', newConnections, 'count');
  }
}

export const MetricsService = new MetricsServiceClass();

// Start periodic cleanup (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  MetricsService.startPeriodicCleanup();
}