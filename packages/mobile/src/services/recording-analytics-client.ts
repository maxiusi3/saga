import { RecordingQuality, RecordingMetadata } from '@saga/shared';
import { apiClient } from './api-client';

export interface RecordingAnalyticsClient {
  trackRecordingStarted(sessionId: string, projectId: string, metadata?: Partial<RecordingMetadata>): Promise<void>;
  trackRecordingStopped(sessionId: string, projectId: string, duration: number, metadata?: Partial<RecordingMetadata>): Promise<void>;
  trackRecordingReviewed(sessionId: string, projectId: string, duration: number, quality: RecordingQuality, reviewDuration?: number): Promise<void>;
  trackRecordingSent(sessionId: string, projectId: string, duration: number, quality: RecordingQuality, retryCount?: number): Promise<void>;
  trackRecordingDiscarded(sessionId: string, projectId: string, retryCount?: number): Promise<void>;
  trackRecordingRetry(sessionId: string, projectId: string, retryCount: number): Promise<void>;
}

class RecordingAnalyticsClientImpl implements RecordingAnalyticsClient {
  private async trackEvent(
    eventType: string,
    sessionId: string,
    projectId: string,
    additionalData: any = {}
  ): Promise<void> {
    try {
      await apiClient.post('/recording-analytics/events', {
        sessionId,
        projectId,
        eventType,
        ...additionalData,
      });
    } catch (error) {
      console.warn('Failed to track recording analytics event:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  async trackRecordingStarted(
    sessionId: string,
    projectId: string,
    metadata?: Partial<RecordingMetadata>
  ): Promise<void> {
    await this.trackEvent('recording_started', sessionId, projectId, { metadata });
  }

  async trackRecordingStopped(
    sessionId: string,
    projectId: string,
    duration: number,
    metadata?: Partial<RecordingMetadata>
  ): Promise<void> {
    await this.trackEvent('recording_stopped', sessionId, projectId, {
      duration,
      metadata,
    });
  }

  async trackRecordingReviewed(
    sessionId: string,
    projectId: string,
    duration: number,
    quality: RecordingQuality,
    reviewDuration?: number
  ): Promise<void> {
    await this.trackEvent('recording_reviewed', sessionId, projectId, {
      duration,
      quality,
      reviewDuration,
    });
  }

  async trackRecordingSent(
    sessionId: string,
    projectId: string,
    duration: number,
    quality: RecordingQuality,
    retryCount?: number
  ): Promise<void> {
    await this.trackEvent('recording_sent', sessionId, projectId, {
      duration,
      quality,
      retryCount,
    });
  }

  async trackRecordingDiscarded(
    sessionId: string,
    projectId: string,
    retryCount?: number
  ): Promise<void> {
    await this.trackEvent('recording_discarded', sessionId, projectId, {
      retryCount,
    });
  }

  async trackRecordingRetry(
    sessionId: string,
    projectId: string,
    retryCount: number
  ): Promise<void> {
    await this.trackEvent('recording_retry', sessionId, projectId, {
      retryCount,
    });
  }
}

export const recordingAnalyticsClient = new RecordingAnalyticsClientImpl();