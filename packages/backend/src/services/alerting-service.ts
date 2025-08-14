import { LoggingService } from './logging-service';
import { MetricsService } from './metrics-service';
import { HealthCheckService } from './health-check-service';
import { APMService } from './apm-service';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: Date;
  status: AlertStatus;
  metadata: Record<string, any>;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export type AlertType = 
  | 'system_health'
  | 'performance'
  | 'error_rate'
  | 'security'
  | 'business_metric'
  | 'external_service'
  | 'database'
  | 'memory'
  | 'disk_space'
  | 'custom';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  condition: AlertCondition;
  enabled: boolean;
  cooldownMinutes: number;
  channels: AlertChannel[];
  metadata: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';
  threshold: number | string;
  timeWindowMinutes: number;
  evaluationCount: number; // How many times condition must be true
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

class AlertingServiceClass {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private lastEvaluations: Map<string, Date> = new Map();
  private conditionHistory: Map<string, boolean[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
    // Only start periodic evaluation in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.startPeriodicEvaluation();
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: 'error_rate',
        severity: 'critical',
        condition: {
          metric: 'http.error_rate',
          operator: 'gt',
          threshold: 10, // 10%
          timeWindowMinutes: 5,
          evaluationCount: 3,
        },
        enabled: true,
        cooldownMinutes: 15,
        channels: [
          { type: 'email', config: { recipients: ['alerts@saga.com'] }, enabled: true },
          { type: 'slack', config: { channel: '#alerts' }, enabled: true },
        ],
        metadata: {},
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        type: 'performance',
        severity: 'high',
        condition: {
          metric: 'http.avg_response_time',
          operator: 'gt',
          threshold: 2000, // 2 seconds
          timeWindowMinutes: 5,
          evaluationCount: 2,
        },
        enabled: true,
        cooldownMinutes: 10,
        channels: [
          { type: 'email', config: { recipients: ['alerts@saga.com'] }, enabled: true },
        ],
        metadata: {},
      },
      {
        id: 'database-unhealthy',
        name: 'Database Unhealthy',
        type: 'database',
        severity: 'critical',
        condition: {
          metric: 'health.database.status',
          operator: 'eq',
          threshold: 'unhealthy',
          timeWindowMinutes: 1,
          evaluationCount: 1,
        },
        enabled: true,
        cooldownMinutes: 5,
        channels: [
          { type: 'email', config: { recipients: ['alerts@saga.com'] }, enabled: true },
          { type: 'slack', config: { channel: '#critical-alerts' }, enabled: true },
        ],
        metadata: {},
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        type: 'memory',
        severity: 'medium',
        condition: {
          metric: 'system.memory_usage_percent',
          operator: 'gt',
          threshold: 85, // 85%
          timeWindowMinutes: 10,
          evaluationCount: 3,
        },
        enabled: true,
        cooldownMinutes: 30,
        channels: [
          { type: 'email', config: { recipients: ['alerts@saga.com'] }, enabled: true },
        ],
        metadata: {},
      },
      {
        id: 'external-service-down',
        name: 'External Service Down',
        type: 'external_service',
        severity: 'high',
        condition: {
          metric: 'health.external_service.status',
          operator: 'eq',
          threshold: 'unhealthy',
          timeWindowMinutes: 2,
          evaluationCount: 2,
        },
        enabled: true,
        cooldownMinutes: 15,
        channels: [
          { type: 'email', config: { recipients: ['alerts@saga.com'] }, enabled: true },
        ],
        metadata: {},
      },
      {
        id: 'security-threat',
        name: 'Security Threat Detected',
        type: 'security',
        severity: 'critical',
        condition: {
          metric: 'security.threats_per_minute',
          operator: 'gt',
          threshold: 10,
          timeWindowMinutes: 1,
          evaluationCount: 1,
        },
        enabled: true,
        cooldownMinutes: 5,
        channels: [
          { type: 'email', config: { recipients: ['security@saga.com'] }, enabled: true },
          { type: 'slack', config: { channel: '#security-alerts' }, enabled: true },
        ],
        metadata: {},
      },
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * Create a new alert
   */
  createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    description: string,
    metadata: Record<string, any> = {}
  ): string {
    const alertId = this.generateId();
    
    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      description,
      timestamp: new Date(),
      status: 'active',
      metadata,
    };

    this.alerts.set(alertId, alert);

    // Log the alert
    LoggingService.error(`Alert created: ${title}`, {
      alertId,
      type,
      severity,
      description,
      metadata,
    });

    // Send notifications
    this.sendAlertNotifications(alert);

    return alertId;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    LoggingService.info(`Alert resolved: ${alert.title}`, {
      alertId,
      resolvedBy,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
    });

    return true;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'acknowledged';
    alert.metadata.acknowledgedBy = acknowledgedBy;
    alert.metadata.acknowledgedAt = new Date();

    LoggingService.info(`Alert acknowledged: ${alert.title}`, {
      alertId,
      acknowledgedBy,
    });

    return true;
  }

  /**
   * Suppress an alert
   */
  suppressAlert(alertId: string, suppressedBy: string, reason: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'suppressed';
    alert.metadata.suppressedBy = suppressedBy;
    alert.metadata.suppressedAt = new Date();
    alert.metadata.suppressionReason = reason;

    LoggingService.info(`Alert suppressed: ${alert.title}`, {
      alertId,
      suppressedBy,
      reason,
    });

    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    LoggingService.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  /**
   * Update alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    LoggingService.info(`Alert rule updated: ${rule.name}`, { ruleId });
    return true;
  }

  /**
   * Delete alert rule
   */
  deleteRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    this.rules.delete(ruleId);
    LoggingService.info(`Alert rule deleted: ${rule.name}`, { ruleId });
    return true;
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluate alert rules
   */
  private async evaluateRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        LoggingService.error(`Failed to evaluate alert rule: ${rule.name}`, {
          ruleId: rule.id,
          error: error as Error,
        });
      }
    }
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    // Check cooldown
    const lastEvaluation = this.lastEvaluations.get(rule.id);
    if (lastEvaluation) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastEvaluation.getTime() < cooldownMs) {
        return;
      }
    }

    // Get metric value
    const metricValue = await this.getMetricValue(rule.condition.metric);
    if (metricValue === null) {
      return;
    }

    // Evaluate condition
    const conditionMet = this.evaluateCondition(rule.condition, metricValue);

    // Track condition history
    const history = this.conditionHistory.get(rule.id) || [];
    history.push(conditionMet);
    
    // Keep only recent history
    const maxHistory = rule.condition.evaluationCount * 2;
    if (history.length > maxHistory) {
      history.shift();
    }
    this.conditionHistory.set(rule.id, history);

    // Check if we should trigger alert
    const recentHistory = history.slice(-rule.condition.evaluationCount);
    const shouldTrigger = recentHistory.length === rule.condition.evaluationCount &&
                         recentHistory.every(met => met);

    if (shouldTrigger) {
      // Check if there's already an active alert for this rule
      const existingAlert = Array.from(this.alerts.values())
        .find(alert => 
          alert.metadata.ruleId === rule.id && 
          alert.status === 'active'
        );

      if (!existingAlert) {
        this.createAlert(
          rule.type,
          rule.severity,
          rule.name,
          `Alert condition met: ${rule.condition.metric} ${rule.condition.operator} ${rule.condition.threshold}`,
          {
            ruleId: rule.id,
            metricValue,
            condition: rule.condition,
          }
        );

        this.lastEvaluations.set(rule.id, new Date());
      }
    }
  }

  /**
   * Get metric value
   */
  private async getMetricValue(metric: string): Promise<any> {
    try {
      switch (metric) {
        case 'http.error_rate':
          const performanceMetrics = MetricsService.getPerformanceMetrics();
          return performanceMetrics.errorRate;

        case 'http.avg_response_time':
          const perfMetrics = MetricsService.getPerformanceMetrics();
          return perfMetrics.averageResponseTime;

        case 'system.memory_usage_percent':
          const memoryUsage = process.memoryUsage();
          return (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

        case 'health.database.status':
          const health = await HealthCheckService.performHealthCheck();
          const dbCheck = health.checks.find(c => c.service === 'database');
          return dbCheck?.status || 'unknown';

        case 'health.external_service.status':
          const healthCheck = await HealthCheckService.performHealthCheck();
          const externalServices = healthCheck.checks.filter(c => 
            ['openai', 'aws-s3', 'stripe'].includes(c.service)
          );
          return externalServices.some(s => s.status === 'unhealthy') ? 'unhealthy' : 'healthy';

        case 'security.threats_per_minute':
          // This would be calculated from security events
          return MetricsService.getAverageMetric('security.threats', 60 * 1000);

        default:
          // Try to get from metrics service
          return MetricsService.getAverageMetric(metric, 5 * 60 * 1000);
      }
    } catch (error) {
      LoggingService.error(`Failed to get metric value: ${metric}`, {
        error: error as Error,
      });
      return null;
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(condition: AlertCondition, value: any): boolean {
    switch (condition.operator) {
      case 'gt':
        return Number(value) > Number(condition.threshold);
      case 'gte':
        return Number(value) >= Number(condition.threshold);
      case 'lt':
        return Number(value) < Number(condition.threshold);
      case 'lte':
        return Number(value) <= Number(condition.threshold);
      case 'eq':
        return value === condition.threshold;
      case 'contains':
        return String(value).includes(String(condition.threshold));
      case 'not_contains':
        return !String(value).includes(String(condition.threshold));
      default:
        return false;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    // Find rules that might have channels configured
    const rule = Array.from(this.rules.values())
      .find(r => r.id === alert.metadata.ruleId);

    const channels = rule?.channels || [];

    for (const channel of channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        LoggingService.error(`Failed to send alert notification`, {
          alertId: alert.id,
          channelType: channel.type,
          error: error as Error,
        });
      }
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel.config);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel.config);
        break;
      case 'sms':
        await this.sendSMSNotification(alert, channel.config);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(alert, channel.config);
        break;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert, config: any): Promise<void> {
    // Implementation would depend on email service
    LoggingService.info('Would send email notification', {
      alertId: alert.id,
      recipients: config.recipients,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert, config: any): Promise<void> {
    // Implementation would depend on Slack integration
    LoggingService.info('Would send Slack notification', {
      alertId: alert.id,
      channel: config.channel,
      message: `🚨 ${alert.title}: ${alert.description}`,
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert, config: any): Promise<void> {
    // Implementation would send HTTP POST to webhook URL
    LoggingService.info('Would send webhook notification', {
      alertId: alert.id,
      url: config.url,
      payload: alert,
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(alert: Alert, config: any): Promise<void> {
    // Implementation would depend on SMS service
    LoggingService.info('Would send SMS notification', {
      alertId: alert.id,
      phoneNumbers: config.phoneNumbers,
      message: `${alert.title}: ${alert.description}`,
    });
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(alert: Alert, config: any): Promise<void> {
    // Implementation would depend on PagerDuty integration
    LoggingService.info('Would send PagerDuty notification', {
      alertId: alert.id,
      serviceKey: config.serviceKey,
      incident: alert,
    });
  }

  /**
   * Start periodic rule evaluation
   */
  private startPeriodicEvaluation(): void {
    // Evaluate rules every minute
    setInterval(() => {
      this.evaluateRules();
    }, 60 * 1000);

    LoggingService.info('Alert rule evaluation started');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    averageResolutionTime: number;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const bySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<AlertSeverity, number>);

    const byType = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<AlertType, number>);

    const resolvedAlerts = alerts.filter(a => a.status === 'resolved' && a.resolvedAt);
    const averageResolutionTime = resolvedAlerts.length > 0
      ? resolvedAlerts.reduce((sum, alert) => {
          return sum + (alert.resolvedAt!.getTime() - alert.timestamp.getTime());
        }, 0) / resolvedAlerts.length
      : 0;

    return {
      total: alerts.length,
      active: alerts.filter(a => a.status === 'active').length,
      resolved: resolvedAlerts.length,
      bySeverity,
      byType,
      averageResolutionTime,
    };
  }
}

export const AlertingService = new AlertingServiceClass();