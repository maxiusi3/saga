import { BaseService } from './base-service';
import { RecordingAnalyticsService } from './recording-analytics-service';

export interface RecordingError {
  id: string;
  userId: string;
  projectId: string;
  sessionId: string;
  errorType: 'permission_denied' | 'file_too_large' | 'upload_failed' | 'quality_validation_failed' | 'device_not_supported' | 'network_error' | 'unknown';
  errorMessage: string;
  stackTrace?: string;
  deviceInfo?: {
    platform: 'ios' | 'android';
    version: string;
    model?: string;
  };
  timestamp: Date;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number; // errors per 100 sessions
  errorsByType: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  errorsByDevice: Array<{
    platform: string;
    model: string;
    errorCount: number;
    errorRate: number;
  }>;
  criticalErrors: number;
  resolvedErrors: number;
  averageResolutionTime: number; // in hours
}

export interface ErrorAlert {
  id: string;
  type: 'spike' | 'threshold' | 'critical_error' | 'new_error_type';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

class RecordingErrorMonitorClass extends BaseService {
  private errors: Map<string, RecordingError[]> = new Map();
  private alerts: ErrorAlert[] = [];
  private errorThresholds = {
    errorRateThreshold: 5, // 5 errors per 100 sessions
    criticalErrorThreshold: 1, // 1 critical error triggers alert
    spikeThreshold: 200, // 200% increase in error rate
  };

  /**
   * Log a recording error
   */
  async logError(errorData: Omit<RecordingError, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const error: RecordingError = {
        ...errorData,
        id: this.generateId(),
        timestamp: new Date(),
        resolved: false,
      };

      // Store error
      const userErrors = this.errors.get(errorData.userId) || [];
      userErrors.push(error);
      this.errors.set(errorData.userId, userErrors);

      // Check for alerts
      await this.checkForAlerts(error);

      console.log('Recording error logged:', {
        errorType: error.errorType,
        severity: error.severity,
        userId: error.userId,
        sessionId: error.sessionId,
      });

      // In production, you would also:
      // 1. Store in database
      // 2. Send to error tracking service (e.g., Sentry)
      // 3. Trigger notifications for critical errors
    } catch (err) {
      console.error('Failed to log recording error:', err);
      // Don't throw - error logging failures shouldn't break the main flow
    }
  }

  /**
   * Get error metrics for analysis
   */
  async getErrorMetrics(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): Promise<ErrorMetrics> {
    try {
      const errors = this.getFilteredErrors(userId, projectId, dateRange);
      
      // Get total sessions for error rate calculation
      const completionMetrics = await RecordingAnalyticsService.getCompletionMetrics(userId, projectId, dateRange);
      const totalSessions = completionMetrics.totalRecordingsSessions;

      const totalErrors = errors.length;
      const errorRate = totalSessions > 0 ? (totalErrors / totalSessions) * 100 : 0;

      // Group errors by type
      const errorTypeMap = new Map<string, number>();
      errors.forEach(error => {
        errorTypeMap.set(error.errorType, (errorTypeMap.get(error.errorType) || 0) + 1);
      });

      const errorsByType = Array.from(errorTypeMap.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
      }));

      // Group errors by device
      const deviceErrorMap = new Map<string, { count: number; sessions: number }>();
      errors.forEach(error => {
        if (error.deviceInfo) {
          const deviceKey = `${error.deviceInfo.platform}-${error.deviceInfo.model || 'Unknown'}`;
          const existing = deviceErrorMap.get(deviceKey) || { count: 0, sessions: 0 };
          existing.count++;
          deviceErrorMap.set(deviceKey, existing);
        }
      });

      const errorsByDevice = Array.from(deviceErrorMap.entries()).map(([device, data]) => {
        const [platform, model] = device.split('-');
        return {
          platform,
          model,
          errorCount: data.count,
          errorRate: data.sessions > 0 ? (data.count / data.sessions) * 100 : 0,
        };
      });

      const criticalErrors = errors.filter(e => e.severity === 'critical').length;
      const resolvedErrors = errors.filter(e => e.resolved).length;

      // Calculate average resolution time for resolved errors
      const resolvedErrorsWithTime = errors.filter(e => e.resolved && e.timestamp);
      const averageResolutionTime = resolvedErrorsWithTime.length > 0
        ? resolvedErrorsWithTime.reduce((sum, error) => {
            // Simplified - in reality you'd track resolution timestamp
            return sum + 24; // Assume 24 hours average for now
          }, 0) / resolvedErrorsWithTime.length
        : 0;

      return {
        totalErrors,
        errorRate,
        errorsByType,
        errorsByDevice,
        criticalErrors,
        resolvedErrors,
        averageResolutionTime,
      };
    } catch (error) {
      console.error('Failed to get error metrics:', error);
      throw new Error('Failed to retrieve error metrics');
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<ErrorAlert[]> {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
    }
  }

  /**
   * Get error trends over time
   */
  async getErrorTrends(userId?: string, projectId?: string, days: number = 7): Promise<Array<{
    date: string;
    errorCount: number;
    errorRate: number;
    criticalErrors: number;
  }>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const errors = this.getFilteredErrors(userId, projectId, { start: startDate, end: endDate });
      
      // Group by day
      const dailyErrors = new Map<string, { errors: RecordingError[]; sessions: number }>();
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dailyErrors.set(dateKey, { errors: [], sessions: 0 });
      }
      
      errors.forEach(error => {
        const dateKey = error.timestamp.toISOString().split('T')[0];
        const dayData = dailyErrors.get(dateKey);
        if (dayData) {
          dayData.errors.push(error);
        }
      });

      return Array.from(dailyErrors.entries()).map(([date, data]) => ({
        date,
        errorCount: data.errors.length,
        errorRate: data.sessions > 0 ? (data.errors.length / data.sessions) * 100 : 0,
        criticalErrors: data.errors.filter(e => e.severity === 'critical').length,
      }));
    } catch (error) {
      console.error('Failed to get error trends:', error);
      throw new Error('Failed to retrieve error trends');
    }
  }

  /**
   * Check for alerts based on new error
   */
  private async checkForAlerts(newError: RecordingError): Promise<void> {
    try {
      // Check for critical errors
      if (newError.severity === 'critical') {
        await this.createAlert({
          type: 'critical_error',
          title: 'Critical Recording Error Detected',
          description: `Critical error: ${newError.errorMessage}`,
          severity: 'critical',
        });
      }

      // Check error rate threshold
      const recentErrors = this.getRecentErrors(1); // Last 1 hour
      const recentSessions = 100; // Simplified - would get from analytics
      const currentErrorRate = recentSessions > 0 ? (recentErrors.length / recentSessions) * 100 : 0;

      if (currentErrorRate > this.errorThresholds.errorRateThreshold) {
        await this.createAlert({
          type: 'threshold',
          title: 'High Error Rate Detected',
          description: `Error rate (${currentErrorRate.toFixed(1)}%) exceeds threshold (${this.errorThresholds.errorRateThreshold}%)`,
          severity: 'high',
        });
      }

      // Check for new error types
      const errorTypeExists = this.alerts.some(alert => 
        alert.type === 'new_error_type' && 
        alert.description.includes(newError.errorType)
      );

      if (!errorTypeExists) {
        const errorTypeCount = this.getAllErrors().filter(e => e.errorType === newError.errorType).length;
        if (errorTypeCount === 1) { // First occurrence of this error type
          await this.createAlert({
            type: 'new_error_type',
            title: 'New Error Type Detected',
            description: `New error type detected: ${newError.errorType}`,
            severity: 'medium',
          });
        }
      }
    } catch (error) {
      console.error('Failed to check for alerts:', error);
    }
  }

  /**
   * Create a new alert
   */
  private async createAlert(alertData: Omit<ErrorAlert, 'id' | 'triggeredAt' | 'acknowledged'>): Promise<void> {
    const alert: ErrorAlert = {
      ...alertData,
      id: this.generateId(),
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // In production, you would also:
    // 1. Send notifications (email, Slack, etc.)
    // 2. Store in database
    // 3. Trigger automated responses for critical alerts
  }

  /**
   * Get filtered errors based on criteria
   */
  private getFilteredErrors(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): RecordingError[] {
    let allErrors: RecordingError[] = [];
    
    if (userId) {
      allErrors = this.errors.get(userId) || [];
    } else {
      // Get all errors from all users
      for (const userErrors of this.errors.values()) {
        allErrors.push(...userErrors);
      }
    }

    return allErrors.filter(error => {
      if (projectId && error.projectId !== projectId) return false;
      if (dateRange) {
        if (error.timestamp < dateRange.start || error.timestamp > dateRange.end) return false;
      }
      return true;
    });
  }

  /**
   * Get recent errors within specified hours
   */
  private getRecentErrors(hours: number): RecordingError[] {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.getAllErrors().filter(error => error.timestamp >= cutoffTime);
  }

  /**
   * Get all errors across all users
   */
  private getAllErrors(): RecordingError[] {
    const allErrors: RecordingError[] = [];
    for (const userErrors of this.errors.values()) {
      allErrors.push(...userErrors);
    }
    return allErrors;
  }
}

export const RecordingErrorMonitor = new RecordingErrorMonitorClass();