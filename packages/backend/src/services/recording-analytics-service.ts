import { BaseService } from './base-service';
import { RecordingMetadata, RecordingQuality } from '@saga/shared';

export interface RecordingAnalyticsEvent {
  id: string;
  userId: string;
  projectId: string;
  sessionId: string;
  eventType: 'recording_started' | 'recording_stopped' | 'recording_reviewed' | 'recording_sent' | 'recording_discarded' | 'recording_retry';
  timestamp: Date;
  metadata?: Partial<RecordingMetadata>;
  quality?: RecordingQuality;
  duration?: number;
  retryCount?: number;
  reviewDuration?: number;
}

export interface RecordingCompletionMetrics {
  totalRecordingsSessions: number;
  completedRecordings: number;
  discardedRecordings: number;
  completionRate: number;
  averageRetryCount: number;
  averageReviewDuration: number;
  averageRecordingDuration: number;
}

export interface RecordingQualityMetrics {
  totalRecordings: number;
  validRecordings: number;
  qualityIssues: {
    duration: number;
    fileSize: number;
    format: number;
    quality: number;
    corruption: number;
  };
  averageDuration: number;
  averageFileSize: number;
  mostCommonIssues: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

export interface RecordingDeviceMetrics {
  platformDistribution: {
    ios: number;
    android: number;
  };
  deviceModels: Array<{
    model: string;
    count: number;
    completionRate: number;
  }>;
  environmentFactors: {
    headphonesUsage: number;
    backgroundNoiseDistribution: {
      low: number;
      medium: number;
      high: number;
    };
  };
}

class RecordingAnalyticsServiceClass extends BaseService {
  private analyticsEvents: Map<string, RecordingAnalyticsEvent[]> = new Map();

  /**
   * Track a recording analytics event
   */
  async trackRecordingEvent(event: Omit<RecordingAnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const analyticsEvent: RecordingAnalyticsEvent = {
        ...event,
        id: this.generateId(),
        timestamp: new Date(),
      };

      // Store event in memory (in production, this would go to a database)
      const userEvents = this.analyticsEvents.get(event.userId) || [];
      userEvents.push(analyticsEvent);
      this.analyticsEvents.set(event.userId, userEvents);

      // Log for debugging
      console.log('Recording analytics event tracked:', {
        eventType: analyticsEvent.eventType,
        sessionId: analyticsEvent.sessionId,
        userId: analyticsEvent.userId,
      });

      // In production, you would also:
      // 1. Store in database
      // 2. Send to analytics service (e.g., Mixpanel, Amplitude)
      // 3. Update real-time metrics
    } catch (error) {
      console.error('Failed to track recording event:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Get recording completion metrics for a user or project
   */
  async getCompletionMetrics(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): Promise<RecordingCompletionMetrics> {
    try {
      const events = this.getFilteredEvents(userId, projectId, dateRange);
      
      // Group events by session
      const sessionGroups = this.groupEventsBySession(events);
      
      let totalSessions = 0;
      let completedRecordings = 0;
      let discardedRecordings = 0;
      let totalRetryCount = 0;
      let totalReviewDuration = 0;
      let totalRecordingDuration = 0;
      let recordingCount = 0;

      for (const [sessionId, sessionEvents] of sessionGroups) {
        totalSessions++;
        
        const hasStarted = sessionEvents.some(e => e.eventType === 'recording_started');
        const hasSent = sessionEvents.some(e => e.eventType === 'recording_sent');
        const hasDiscarded = sessionEvents.some(e => e.eventType === 'recording_discarded');
        
        if (hasStarted) {
          if (hasSent) {
            completedRecordings++;
            
            // Calculate metrics for completed recordings
            const retryEvents = sessionEvents.filter(e => e.eventType === 'recording_retry');
            totalRetryCount += retryEvents.length;
            
            const reviewEvents = sessionEvents.filter(e => e.eventType === 'recording_reviewed');
            if (reviewEvents.length > 0) {
              const avgReviewDuration = reviewEvents.reduce((sum, e) => sum + (e.reviewDuration || 0), 0) / reviewEvents.length;
              totalReviewDuration += avgReviewDuration;
            }
            
            const sentEvent = sessionEvents.find(e => e.eventType === 'recording_sent');
            if (sentEvent?.duration) {
              totalRecordingDuration += sentEvent.duration;
              recordingCount++;
            }
          } else if (hasDiscarded) {
            discardedRecordings++;
          }
        }
      }

      const completionRate = totalSessions > 0 ? (completedRecordings / totalSessions) * 100 : 0;
      const averageRetryCount = completedRecordings > 0 ? totalRetryCount / completedRecordings : 0;
      const averageReviewDuration = completedRecordings > 0 ? totalReviewDuration / completedRecordings : 0;
      const averageRecordingDuration = recordingCount > 0 ? totalRecordingDuration / recordingCount : 0;

      return {
        totalRecordingsSessions: totalSessions,
        completedRecordings,
        discardedRecordings,
        completionRate,
        averageRetryCount,
        averageReviewDuration,
        averageRecordingDuration,
      };
    } catch (error) {
      console.error('Failed to get completion metrics:', error);
      throw new Error('Failed to retrieve recording completion metrics');
    }
  }

  /**
   * Get recording quality metrics
   */
  async getQualityMetrics(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): Promise<RecordingQualityMetrics> {
    try {
      const events = this.getFilteredEvents(userId, projectId, dateRange)
        .filter(e => e.eventType === 'recording_sent' && e.quality);

      let totalRecordings = events.length;
      let validRecordings = 0;
      let totalDuration = 0;
      let totalFileSize = 0;
      
      const qualityIssues = {
        duration: 0,
        fileSize: 0,
        format: 0,
        quality: 0,
        corruption: 0,
      };

      const issueCounter = new Map<string, number>();

      for (const event of events) {
        if (event.quality) {
          if (event.quality.isValid) {
            validRecordings++;
          }
          
          totalDuration += event.quality.duration;
          totalFileSize += event.quality.fileSize;
          
          // Count quality issues
          for (const issue of event.quality.issues) {
            if (qualityIssues.hasOwnProperty(issue.type)) {
              qualityIssues[issue.type as keyof typeof qualityIssues]++;
            }
            
            const issueKey = `${issue.type}_${issue.severity}`;
            issueCounter.set(issueKey, (issueCounter.get(issueKey) || 0) + 1);
          }
        }
      }

      // Calculate most common issues
      const mostCommonIssues = Array.from(issueCounter.entries())
        .map(([type, count]) => ({
          type,
          count,
          percentage: totalRecordings > 0 ? (count / totalRecordings) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 issues

      return {
        totalRecordings,
        validRecordings,
        qualityIssues,
        averageDuration: totalRecordings > 0 ? totalDuration / totalRecordings : 0,
        averageFileSize: totalRecordings > 0 ? totalFileSize / totalRecordings : 0,
        mostCommonIssues,
      };
    } catch (error) {
      console.error('Failed to get quality metrics:', error);
      throw new Error('Failed to retrieve recording quality metrics');
    }
  }

  /**
   * Get device and environment metrics
   */
  async getDeviceMetrics(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): Promise<RecordingDeviceMetrics> {
    try {
      const events = this.getFilteredEvents(userId, projectId, dateRange)
        .filter(e => e.metadata?.deviceInfo);

      const platformCounts = { ios: 0, android: 0 };
      const deviceModelCounts = new Map<string, { count: number; completed: number }>();
      let headphonesUsage = 0;
      const backgroundNoiseCounts = { low: 0, medium: 0, high: 0 };

      // Group by session to avoid double counting
      const sessionGroups = this.groupEventsBySession(events);

      for (const [sessionId, sessionEvents] of sessionGroups) {
        const latestEvent = sessionEvents[sessionEvents.length - 1];
        const metadata = latestEvent.metadata;
        
        if (metadata?.deviceInfo) {
          // Platform distribution
          platformCounts[metadata.deviceInfo.platform]++;
          
          // Device model tracking
          const model = metadata.deviceInfo.model || 'Unknown';
          const modelData = deviceModelCounts.get(model) || { count: 0, completed: 0 };
          modelData.count++;
          
          // Check if session was completed
          const wasCompleted = sessionEvents.some(e => e.eventType === 'recording_sent');
          if (wasCompleted) {
            modelData.completed++;
          }
          
          deviceModelCounts.set(model, modelData);
        }

        if (metadata?.recordingEnvironment) {
          // Headphones usage
          if (metadata.recordingEnvironment.hasHeadphones) {
            headphonesUsage++;
          }
          
          // Background noise distribution
          const noise = metadata.recordingEnvironment.backgroundNoise;
          if (noise && backgroundNoiseCounts.hasOwnProperty(noise)) {
            backgroundNoiseCounts[noise]++;
          }
        }
      }

      // Convert device models to array format
      const deviceModels = Array.from(deviceModelCounts.entries())
        .map(([model, data]) => ({
          model,
          count: data.count,
          completionRate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const totalSessions = sessionGroups.size;

      return {
        platformDistribution: platformCounts,
        deviceModels,
        environmentFactors: {
          headphonesUsage: totalSessions > 0 ? (headphonesUsage / totalSessions) * 100 : 0,
          backgroundNoiseDistribution: {
            low: totalSessions > 0 ? (backgroundNoiseCounts.low / totalSessions) * 100 : 0,
            medium: totalSessions > 0 ? (backgroundNoiseCounts.medium / totalSessions) * 100 : 0,
            high: totalSessions > 0 ? (backgroundNoiseCounts.high / totalSessions) * 100 : 0,
          },
        },
      };
    } catch (error) {
      console.error('Failed to get device metrics:', error);
      throw new Error('Failed to retrieve recording device metrics');
    }
  }

  /**
   * Get detailed duration analysis
   */
  async getDurationAnalysis(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): Promise<{
    averageDuration: number;
    medianDuration: number;
    shortRecordings: number;
    optimalRecordings: number;
    longRecordings: number;
    durationTrend: 'increasing' | 'decreasing' | 'stable';
    distributionData: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    timeSeriesData: Array<{
      date: string;
      averageDuration: number;
      recordingCount: number;
    }>;
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const events = this.getFilteredEvents(userId, projectId, dateRange)
        .filter(e => e.eventType === 'recording_sent' && e.duration);

      if (events.length === 0) {
        return {
          averageDuration: 0,
          medianDuration: 0,
          shortRecordings: 0,
          optimalRecordings: 0,
          longRecordings: 0,
          durationTrend: 'stable',
          distributionData: [],
          timeSeriesData: [],
          insights: [],
          recommendations: [],
        };
      }

      // Calculate basic statistics
      const durations = events.map(e => e.duration!).sort((a, b) => a - b);
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const medianDuration = durations[Math.floor(durations.length / 2)];

      // Categorize recordings
      let shortRecordings = 0;
      let optimalRecordings = 0;
      let longRecordings = 0;

      durations.forEach(duration => {
        if (duration < 30000) { // < 30 seconds
          shortRecordings++;
        } else if (duration <= 300000) { // 30s - 5 minutes
          optimalRecordings++;
        } else { // > 5 minutes
          longRecordings++;
        }
      });

      // Create distribution data
      const ranges = [
        { range: '0-30s', min: 0, max: 30000 },
        { range: '30s-1m', min: 30000, max: 60000 },
        { range: '1-2m', min: 60000, max: 120000 },
        { range: '2-5m', min: 120000, max: 300000 },
        { range: '5-10m', min: 300000, max: 600000 },
        { range: '10m+', min: 600000, max: Infinity },
      ];

      const distributionData = ranges.map(range => {
        const count = durations.filter(d => d >= range.min && d < range.max).length;
        return {
          range: range.range,
          count,
          percentage: events.length > 0 ? (count / events.length) * 100 : 0,
        };
      });

      // Calculate trend (simplified - compare first half vs second half)
      let durationTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (events.length >= 4) {
        const midPoint = Math.floor(events.length / 2);
        const firstHalfAvg = events.slice(0, midPoint).reduce((sum, e) => sum + e.duration!, 0) / midPoint;
        const secondHalfAvg = events.slice(midPoint).reduce((sum, e) => sum + e.duration!, 0) / (events.length - midPoint);
        
        const difference = secondHalfAvg - firstHalfAvg;
        const threshold = firstHalfAvg * 0.1; // 10% threshold
        
        if (difference > threshold) {
          durationTrend = 'increasing';
        } else if (difference < -threshold) {
          durationTrend = 'decreasing';
        }
      }

      // Create time series data (group by day)
      const timeSeriesMap = new Map<string, { totalDuration: number; count: number }>();
      
      events.forEach(event => {
        const dateKey = event.timestamp.toISOString().split('T')[0];
        const existing = timeSeriesMap.get(dateKey) || { totalDuration: 0, count: 0 };
        existing.totalDuration += event.duration!;
        existing.count += 1;
        timeSeriesMap.set(dateKey, existing);
      });

      const timeSeriesData = Array.from(timeSeriesMap.entries())
        .map(([date, data]) => ({
          date,
          averageDuration: data.totalDuration / data.count,
          recordingCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Generate insights
      const insights: string[] = [];
      const recommendations: string[] = [];

      if (averageDuration < 30000) {
        insights.push(`Very short recordings: Average duration is ${this.formatDuration(averageDuration)}`);
        recommendations.push('Encourage storytellers to share more detailed stories with better prompts');
      } else if (averageDuration > 300000) {
        insights.push(`Very long recordings: Average duration is ${this.formatDuration(averageDuration)}`);
        recommendations.push('Consider breaking long stories into chapters or segments');
      } else {
        insights.push(`Optimal recording length: Average duration is ${this.formatDuration(averageDuration)}`);
      }

      const shortPercentage = (shortRecordings / events.length) * 100;
      if (shortPercentage > 50) {
        insights.push(`${shortPercentage.toFixed(1)}% of recordings are very short (< 30 seconds)`);
        recommendations.push('Provide more engaging prompts to encourage longer storytelling');
      }

      const longPercentage = (longRecordings / events.length) * 100;
      if (longPercentage > 20) {
        insights.push(`${longPercentage.toFixed(1)}% of recordings are very long (> 5 minutes)`);
        recommendations.push('Consider implementing chapter breaks for longer stories');
      }

      if (durationTrend === 'increasing') {
        insights.push('Recording duration is trending upward - storytellers are becoming more engaged');
      } else if (durationTrend === 'decreasing') {
        insights.push('Recording duration is trending downward - may indicate fatigue or disengagement');
        recommendations.push('Review recent prompts and consider refreshing the question library');
      }

      return {
        averageDuration,
        medianDuration,
        shortRecordings,
        optimalRecordings,
        longRecordings,
        durationTrend,
        distributionData,
        timeSeriesData,
        insights,
        recommendations,
      };
    } catch (error) {
      console.error('Failed to get duration analysis:', error);
      throw new Error('Failed to retrieve duration analysis');
    }
  }

  private formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes === 0) {
      return `${seconds} seconds`;
    } else if (minutes < 60) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Get insights and recommendations based on analytics data
   */
  async getRecordingInsights(userId?: string, projectId?: string): Promise<{
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const [completionMetrics, qualityMetrics, deviceMetrics] = await Promise.all([
        this.getCompletionMetrics(userId, projectId),
        this.getQualityMetrics(userId, projectId),
        this.getDeviceMetrics(userId, projectId),
      ]);

      const insights: string[] = [];
      const recommendations: string[] = [];

      // Completion rate insights
      if (completionMetrics.completionRate < 50) {
        insights.push(`Low completion rate: ${completionMetrics.completionRate.toFixed(1)}% of recording sessions are completed`);
        recommendations.push('Consider simplifying the recording interface or providing better guidance');
      } else if (completionMetrics.completionRate > 80) {
        insights.push(`High completion rate: ${completionMetrics.completionRate.toFixed(1)}% of recording sessions are completed`);
      }

      // Retry rate insights
      if (completionMetrics.averageRetryCount > 2) {
        insights.push(`High retry rate: Users retry recordings ${completionMetrics.averageRetryCount.toFixed(1)} times on average`);
        recommendations.push('Improve recording quality validation or provide better recording tips');
      }

      // Quality insights
      const qualityRate = qualityMetrics.totalRecordings > 0 ? (qualityMetrics.validRecordings / qualityMetrics.totalRecordings) * 100 : 0;
      if (qualityRate < 70) {
        insights.push(`Quality issues: ${(100 - qualityRate).toFixed(1)}% of recordings have quality problems`);
        recommendations.push('Implement better recording quality guidance or automatic quality enhancement');
      }

      // Duration insights
      if (completionMetrics.averageRecordingDuration < 30000) { // Less than 30 seconds
        insights.push('Short recordings: Users are recording very brief messages');
        recommendations.push('Encourage longer, more detailed storytelling with better prompts');
      } else if (completionMetrics.averageRecordingDuration > 300000) { // More than 5 minutes
        insights.push('Long recordings: Users are creating detailed stories');
      }

      // Device insights
      if (deviceMetrics.environmentFactors.headphonesUsage < 30) {
        insights.push(`Low headphone usage: Only ${deviceMetrics.environmentFactors.headphonesUsage.toFixed(1)}% use headphones`);
        recommendations.push('Recommend headphone usage for better recording quality');
      }

      return { insights, recommendations };
    } catch (error) {
      console.error('Failed to get recording insights:', error);
      return { insights: [], recommendations: [] };
    }
  }

  // Private helper methods

  private getFilteredEvents(userId?: string, projectId?: string, dateRange?: { start: Date; end: Date }): RecordingAnalyticsEvent[] {
    let allEvents: RecordingAnalyticsEvent[] = [];
    
    if (userId) {
      allEvents = this.analyticsEvents.get(userId) || [];
    } else {
      // Get all events from all users
      for (const userEvents of this.analyticsEvents.values()) {
        allEvents.push(...userEvents);
      }
    }

    return allEvents.filter(event => {
      if (projectId && event.projectId !== projectId) return false;
      if (dateRange) {
        if (event.timestamp < dateRange.start || event.timestamp > dateRange.end) return false;
      }
      return true;
    });
  }

  private groupEventsBySession(events: RecordingAnalyticsEvent[]): Map<string, RecordingAnalyticsEvent[]> {
    const sessionGroups = new Map<string, RecordingAnalyticsEvent[]>();
    
    for (const event of events) {
      const sessionEvents = sessionGroups.get(event.sessionId) || [];
      sessionEvents.push(event);
      sessionGroups.set(event.sessionId, sessionEvents);
    }
    
    return sessionGroups;
  }

  private generateId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const RecordingAnalyticsService = new RecordingAnalyticsServiceClass();