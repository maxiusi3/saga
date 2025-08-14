# Monitoring and Error Tracking Guide

This document provides comprehensive guidance on the monitoring and error tracking system implemented for the Saga backend.

## Overview

The monitoring system consists of several integrated components:

- **Error Tracking**: Sentry integration for error capture and analysis
- **Application Performance Monitoring (APM)**: Custom APM service for performance tracking
- **Logging**: Structured logging with Winston
- **Metrics**: Custom metrics collection and analysis
- **Analytics**: User behavior and business metrics tracking
- **Alerting**: Automated alert system for critical issues
- **Health Checks**: System health monitoring endpoints

## Components

### 1. Error Tracking (Sentry)

**Location**: `src/config/sentry.ts`

**Features**:
- Automatic error capture and reporting
- Performance monitoring with transactions
- User context tracking
- Custom error filtering and processing
- Integration with Express.js middleware

**Configuration**:
```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0
```

**Usage**:
```typescript
import { SentryService } from '../config/sentry';

// Capture exception
SentryService.captureException(error, {
  tags: { userId: 'user123' },
  extra: { context: 'additional info' }
});

// Start transaction
const transaction = SentryService.startTransaction('operation', 'type');
// ... perform operation
transaction.finish();
```

### 2. Logging Service

**Location**: `src/services/logging-service.ts`

**Features**:
- Structured logging with Winston
- Multiple log levels (error, warn, info, debug)
- Automatic Sentry integration
- Context-aware logging
- File and console outputs

**Usage**:
```typescript
import { LoggingService } from '../services/logging-service';

// Basic logging
LoggingService.info('User logged in', { userId: 'user123' });
LoggingService.error('Database error', { error, query });

// Specialized logging
LoggingService.logUserAction('story_upload', userId, { storyId });
LoggingService.logAPIRequest('POST', '/api/stories', 201, 150);
LoggingService.logSecurityEvent('failed_login', 'medium', { ip, userAgent });
```

### 3. Metrics Service

**Location**: `src/services/metrics-service.ts`

**Features**:
- Custom metrics collection
- Performance and business metrics
- Prometheus export format
- Automatic cleanup and retention
- Real-time metric aggregation

**Usage**:
```typescript
import { MetricsService } from '../services/metrics-service';

// Record metrics
MetricsService.recordCounter('api.requests', 1, { endpoint: '/stories' });
MetricsService.recordTiming('db.query', startTime, { table: 'users' });
MetricsService.recordGauge('memory.usage', memoryUsage, 'bytes');

// Get metrics
const performanceMetrics = MetricsService.getPerformanceMetrics();
const businessMetrics = MetricsService.getBusinessMetrics();
```

### 4. Application Performance Monitoring (APM)

**Location**: `src/services/apm-service.ts`

**Features**:
- Distributed tracing
- Performance trace collection
- Span tracking within traces
- APM metrics calculation (Apdex, throughput, error rate)
- Export to external APM tools

**Usage**:
```typescript
import { APMService } from '../services/apm-service';

// Manual tracing
const traceId = APMService.startTrace('user_signup', 'business_logic');
const spanId = APMService.startSpan(traceId, 'validate_email', 'validation');
// ... perform operation
APMService.finishSpan(traceId, spanId, 'success');
APMService.finishTrace(traceId, 'success');

// Automatic instrumentation
const instrumentedFunction = APMService.instrument(
  'database_query',
  'db.operation',
  originalFunction
);
```

### 5. Analytics Service

**Location**: `src/services/analytics-service.ts`

**Features**:
- User behavior tracking
- Business metrics calculation
- Event aggregation and analysis
- Funnel analysis
- User retention metrics

**Usage**:
```typescript
import { AnalyticsService } from '../services/analytics-service';

// Track events
AnalyticsService.track('user_signup', { method: 'email' }, userId);
AnalyticsService.trackStoryUpload(userId, projectId, storyId, { fileSize });
AnalyticsService.trackPayment(userId, amount, currency, planId, true);

// Get metrics
const businessMetrics = await AnalyticsService.getBusinessMetrics();
const usageMetrics = await AnalyticsService.getUsageMetrics();
```

### 6. Alerting Service

**Location**: `src/services/alerting-service.ts`

**Features**:
- Rule-based alerting system
- Multiple notification channels (email, Slack, webhook)
- Alert lifecycle management
- Configurable thresholds and conditions
- Alert suppression and acknowledgment

**Usage**:
```typescript
import { AlertingService } from '../services/alerting-service';

// Create alert
const alertId = AlertingService.createAlert(
  'performance',
  'high',
  'Slow Response Time',
  'Average response time exceeded 2 seconds'
);

// Manage alerts
AlertingService.acknowledgeAlert(alertId, 'admin@saga.com');
AlertingService.resolveAlert(alertId, 'admin@saga.com');
```

### 7. Health Check Service

**Location**: `src/services/health-check-service.ts`

**Features**:
- Comprehensive system health monitoring
- Database, Redis, and external service checks
- Performance and resource monitoring
- Kubernetes-compatible health endpoints
- Detailed health reporting

**Endpoints**:
- `GET /health` - Comprehensive health check
- `GET /health/simple` - Simple health check for load balancers
- `GET /health/ready` - Readiness probe for Kubernetes
- `GET /health/live` - Liveness probe for Kubernetes
- `GET /health/metrics` - Performance metrics
- `GET /health/prometheus` - Prometheus metrics

## Monitoring Middleware

**Location**: `src/middleware/monitoring.ts`

The monitoring middleware provides automatic instrumentation for all HTTP requests:

- **Request ID**: Unique identifier for each request
- **Request Logging**: Automatic request/response logging
- **User Context**: User information extraction from JWT
- **Error Tracking**: Automatic error capture
- **Performance Monitoring**: Response time and memory tracking
- **Security Monitoring**: Suspicious pattern detection
- **Business Metrics**: Automatic business event tracking

## Configuration

### Environment Variables

```env
# Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0

# Logging
LOG_LEVEL=info

# Monitoring
APM_ENABLED=true
METRICS_RETENTION_HOURS=24
TRACE_SAMPLE_RATE=0.1

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/slack/webhook
ALERT_EMAIL_RECIPIENTS=alerts@saga.com,admin@saga.com
```

### Default Alert Rules

The system comes with pre-configured alert rules:

1. **High Error Rate**: Triggers when error rate > 10% for 5 minutes
2. **Slow Response Time**: Triggers when avg response time > 2 seconds
3. **Database Unhealthy**: Triggers when database health check fails
4. **High Memory Usage**: Triggers when memory usage > 85%
5. **External Service Down**: Triggers when external services are unhealthy
6. **Security Threat**: Triggers on suspicious activity patterns

## Monitoring Dashboard

**Location**: `packages/web/src/app/admin/monitoring/page.tsx`

The monitoring dashboard provides:

- **System Health Overview**: Real-time system status
- **Performance Metrics**: Response times, throughput, error rates
- **Business Metrics**: User activity, story uploads, payments
- **Active Alerts**: Current system alerts and their status
- **Service Health**: Individual service health checks

**Access**: Admin users only (`/admin/monitoring`)

## API Endpoints

### Monitoring API

**Base Path**: `/api/monitoring`

- `GET /analytics` - Analytics dashboard data
- `GET /apm` - APM metrics and traces
- `GET /apm/traces/:traceId` - Specific trace details
- `GET /alerts` - Alert dashboard data
- `POST /alerts/:alertId/acknowledge` - Acknowledge alert
- `POST /alerts/:alertId/resolve` - Resolve alert
- `POST /alerts/:alertId/suppress` - Suppress alert
- `GET /metrics` - System metrics summary
- `GET /metrics/:metricName` - Specific metric data

All monitoring endpoints require admin authentication.

## Best Practices

### 1. Error Handling

```typescript
try {
  // Risky operation
  await riskyOperation();
} catch (error) {
  // Log with context
  LoggingService.error('Operation failed', {
    operation: 'riskyOperation',
    userId,
    error: error as Error,
  });
  
  // Don't re-throw if handled
  throw error;
}
```

### 2. Performance Monitoring

```typescript
// Use APM for critical operations
const traceId = APMService.startTrace('story_processing', 'business_logic');

try {
  // Add spans for sub-operations
  const uploadSpan = APMService.startSpan(traceId, 'file_upload', 'io');
  await uploadFile();
  APMService.finishSpan(traceId, uploadSpan, 'success');
  
  const processSpan = APMService.startSpan(traceId, 'audio_processing', 'compute');
  await processAudio();
  APMService.finishSpan(traceId, processSpan, 'success');
  
  APMService.finishTrace(traceId, 'success');
} catch (error) {
  APMService.finishTrace(traceId, 'error', { error });
  throw error;
}
```

### 3. Business Metrics

```typescript
// Track important business events
AnalyticsService.trackStoryUpload(userId, projectId, storyId, {
  fileSize: file.size,
  duration: audioDuration,
  format: file.mimetype,
});

// Track user actions
AnalyticsService.track('chapter_generated', {
  projectId,
  chapterCount: chapters.length,
  generationTime: Date.now() - startTime,
}, userId);
```

### 4. Custom Alerts

```typescript
// Create custom alert rules
AlertingService.addRule({
  id: 'custom-business-metric',
  name: 'Low Story Upload Rate',
  type: 'business_metric',
  severity: 'medium',
  condition: {
    metric: 'business.stories_uploaded_per_hour',
    operator: 'lt',
    threshold: 5,
    timeWindowMinutes: 60,
    evaluationCount: 2,
  },
  enabled: true,
  cooldownMinutes: 120,
  channels: [
    { type: 'email', config: { recipients: ['product@saga.com'] }, enabled: true }
  ],
  metadata: { team: 'product' },
});
```

## Troubleshooting

### Common Issues

1. **Sentry Not Capturing Errors**
   - Check `SENTRY_DSN` environment variable
   - Verify Sentry project configuration
   - Check error filtering in `beforeSend` function

2. **High Memory Usage**
   - Check metrics retention settings
   - Monitor trace collection limits
   - Review log file sizes

3. **Missing Metrics**
   - Verify metric recording calls
   - Check metric name consistency
   - Review cleanup intervals

4. **Alert Fatigue**
   - Adjust alert thresholds
   - Implement proper cooldown periods
   - Use alert suppression for maintenance

### Debug Commands

```bash
# Check system health
curl http://localhost:3001/health

# Get metrics
curl http://localhost:3001/health/metrics

# Get Prometheus metrics
curl http://localhost:3001/health/prometheus

# Check specific service health
curl http://localhost:3001/health | jq '.checks[] | select(.service == "database")'
```

## Integration with External Tools

### Sentry

Configure Sentry project settings:
- Set up release tracking
- Configure alert rules
- Set up integrations (Slack, email)

### DataDog/New Relic

Export metrics to external APM tools:

```typescript
// Export traces in OpenTelemetry format
const traces = APMService.exportTraces('opentelemetry');
// Send to external service
```

### Grafana/Prometheus

Use the Prometheus metrics endpoint:
```
http://localhost:3001/health/prometheus
```

Configure Grafana dashboards with:
- System health metrics
- Business metrics
- Performance metrics
- Alert status

## Security Considerations

1. **Sensitive Data**: Ensure no sensitive data is logged or sent to monitoring services
2. **Access Control**: Monitoring endpoints require admin authentication
3. **Data Retention**: Configure appropriate data retention policies
4. **Network Security**: Use HTTPS for all external monitoring service communications

## Performance Impact

The monitoring system is designed to have minimal performance impact:

- **Async Processing**: Most monitoring operations are asynchronous
- **Sampling**: Configurable sampling rates for traces and metrics
- **Batching**: Events are batched for external services
- **Memory Management**: Automatic cleanup of old data
- **Conditional Logging**: Debug logging only in development

## Maintenance

### Regular Tasks

1. **Review Alert Rules**: Monthly review of alert thresholds and rules
2. **Clean Up Data**: Automated cleanup runs hourly
3. **Update Dependencies**: Keep monitoring libraries updated
4. **Review Dashboards**: Ensure dashboards show relevant metrics
5. **Test Alerting**: Regularly test alert notification channels

### Monitoring the Monitoring

- Set up alerts for monitoring system failures
- Monitor Sentry quota usage
- Track monitoring system performance impact
- Review log file sizes and rotation