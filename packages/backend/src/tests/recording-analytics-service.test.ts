import { RecordingAnalyticsService } from '../services/recording-analytics-service';
import { RecordingQuality, RecordingMetadata } from '@saga/shared';

describe('RecordingAnalyticsService', () => {
  beforeEach(() => {
    // Clear any existing data before each test
    (RecordingAnalyticsService as any).analyticsEvents.clear();
  });

  describe('trackRecordingEvent', () => {
    it('should track a recording event successfully', async () => {
      const eventData = {
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-789',
        eventType: 'recording_started' as const,
      };

      await RecordingAnalyticsService.trackRecordingEvent(eventData);

      // Verify event was stored (accessing private property for testing)
      const userEvents = (RecordingAnalyticsService as any).analyticsEvents.get('user-123');
      expect(userEvents).toHaveLength(1);
      expect(userEvents[0]).toMatchObject({
        ...eventData,
        id: expect.any(String),
        timestamp: expect.any(Date),
      });
    });

    it('should handle tracking errors gracefully', async () => {
      // This test verifies that analytics failures don't throw errors
      const eventData = {
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-789',
        eventType: 'recording_started' as const,
      };

      // Should not throw even if there are internal errors
      await expect(RecordingAnalyticsService.trackRecordingEvent(eventData)).resolves.not.toThrow();
    });
  });

  describe('getCompletionMetrics', () => {
    beforeEach(async () => {
      // Set up test data
      const baseEvent = {
        userId: 'user-123',
        projectId: 'project-456',
      };

      // Session 1: Complete recording
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-1',
        eventType: 'recording_started',
      });
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-1',
        eventType: 'recording_stopped',
        duration: 30000,
      });
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-1',
        eventType: 'recording_sent',
        duration: 30000,
        retryCount: 1,
      });

      // Session 2: Discarded recording
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-2',
        eventType: 'recording_started',
      });
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-2',
        eventType: 'recording_discarded',
      });

      // Session 3: Another complete recording with retry
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-3',
        eventType: 'recording_started',
      });
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-3',
        eventType: 'recording_retry',
      });
      await RecordingAnalyticsService.trackRecordingEvent({
        ...baseEvent,
        sessionId: 'session-3',
        eventType: 'recording_sent',
        duration: 45000,
        retryCount: 2,
      });
    });

    it('should calculate completion metrics correctly', async () => {
      const metrics = await RecordingAnalyticsService.getCompletionMetrics('user-123');

      expect(metrics).toEqual({
        totalRecordingsSessions: 3,
        completedRecordings: 2,
        discardedRecordings: 1,
        completionRate: (2 / 3) * 100, // 66.67%
        averageRetryCount: (1 + 2) / 2, // 1.5
        averageReviewDuration: 0, // No review duration data in test
        averageRecordingDuration: (30000 + 45000) / 2, // 37500ms
      });
    });

    it('should filter by project ID', async () => {
      // Add data for different project
      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-different',
        sessionId: 'session-4',
        eventType: 'recording_started',
      });

      const metrics = await RecordingAnalyticsService.getCompletionMetrics('user-123', 'project-456');

      expect(metrics.totalRecordingsSessions).toBe(3); // Should not include session-4
    });

    it('should handle empty data gracefully', async () => {
      const metrics = await RecordingAnalyticsService.getCompletionMetrics('nonexistent-user');

      expect(metrics).toEqual({
        totalRecordingsSessions: 0,
        completedRecordings: 0,
        discardedRecordings: 0,
        completionRate: 0,
        averageRetryCount: 0,
        averageReviewDuration: 0,
        averageRecordingDuration: 0,
      });
    });
  });

  describe('getQualityMetrics', () => {
    beforeEach(async () => {
      const mockQuality: RecordingQuality = {
        isValid: true,
        duration: 30000,
        fileSize: 1024000, // 1MB
        format: 'm4a',
        issues: [
          {
            type: 'duration',
            severity: 'warning',
            message: 'Recording is short',
            suggestion: 'Consider longer recordings',
          },
        ],
      };

      const invalidQuality: RecordingQuality = {
        isValid: false,
        duration: 5000,
        fileSize: 512000,
        format: 'm4a',
        issues: [
          {
            type: 'duration',
            severity: 'error',
            message: 'Recording too short',
            suggestion: 'Record for at least 10 seconds',
          },
          {
            type: 'quality',
            severity: 'warning',
            message: 'Low audio quality',
            suggestion: 'Use headphones for better quality',
          },
        ],
      };

      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-1',
        eventType: 'recording_sent',
        quality: mockQuality,
      });

      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-2',
        eventType: 'recording_sent',
        quality: invalidQuality,
      });
    });

    it('should calculate quality metrics correctly', async () => {
      const metrics = await RecordingAnalyticsService.getQualityMetrics('user-123');

      expect(metrics.totalRecordings).toBe(2);
      expect(metrics.validRecordings).toBe(1);
      expect(metrics.qualityIssues.duration).toBe(2);
      expect(metrics.qualityIssues.quality).toBe(1);
      expect(metrics.averageDuration).toBe((30000 + 5000) / 2);
      expect(metrics.averageFileSize).toBe((1024000 + 512000) / 2);
      expect(metrics.mostCommonIssues).toHaveLength(3); // duration_warning, duration_error, quality_warning
    });
  });

  describe('getDeviceMetrics', () => {
    beforeEach(async () => {
      const iosMetadata: Partial<RecordingMetadata> = {
        deviceInfo: {
          platform: 'ios',
          version: '16.0',
          model: 'iPhone 14',
        },
        recordingEnvironment: {
          hasHeadphones: true,
          backgroundNoise: 'low',
        },
      };

      const androidMetadata: Partial<RecordingMetadata> = {
        deviceInfo: {
          platform: 'android',
          version: '13',
          model: 'Samsung Galaxy S23',
        },
        recordingEnvironment: {
          hasHeadphones: false,
          backgroundNoise: 'medium',
        },
      };

      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-1',
        eventType: 'recording_sent',
        metadata: iosMetadata,
      });

      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-2',
        eventType: 'recording_sent',
        metadata: androidMetadata,
      });
    });

    it('should calculate device metrics correctly', async () => {
      const metrics = await RecordingAnalyticsService.getDeviceMetrics('user-123');

      expect(metrics.platformDistribution).toEqual({
        ios: 1,
        android: 1,
      });

      expect(metrics.deviceModels).toHaveLength(2);
      expect(metrics.deviceModels.find(d => d.model === 'iPhone 14')).toMatchObject({
        model: 'iPhone 14',
        count: 1,
        completionRate: 100, // Session was completed (recording_sent)
      });

      expect(metrics.environmentFactors.headphonesUsage).toBe(50); // 1 out of 2 sessions
      expect(metrics.environmentFactors.backgroundNoiseDistribution).toEqual({
        low: 50,
        medium: 50,
        high: 0,
      });
    });
  });

  describe('getRecordingInsights', () => {
    beforeEach(async () => {
      // Set up data that will trigger specific insights
      const baseEvent = {
        userId: 'user-123',
        projectId: 'project-456',
      };

      // Low completion rate scenario
      for (let i = 1; i <= 10; i++) {
        await RecordingAnalyticsService.trackRecordingEvent({
          ...baseEvent,
          sessionId: `session-${i}`,
          eventType: 'recording_started',
        });

        if (i <= 3) {
          // Only 3 out of 10 complete (30% completion rate)
          await RecordingAnalyticsService.trackRecordingEvent({
            ...baseEvent,
            sessionId: `session-${i}`,
            eventType: 'recording_sent',
            duration: 15000, // Short recordings (15 seconds)
            retryCount: 3, // High retry count
          });
        } else {
          await RecordingAnalyticsService.trackRecordingEvent({
            ...baseEvent,
            sessionId: `session-${i}`,
            eventType: 'recording_discarded',
          });
        }
      }

      // Add quality issues
      const poorQuality: RecordingQuality = {
        isValid: false,
        duration: 15000,
        fileSize: 100000,
        format: 'm4a',
        issues: [
          { type: 'duration', severity: 'error', message: 'Too short' },
          { type: 'quality', severity: 'error', message: 'Poor quality' },
        ],
      };

      for (let i = 1; i <= 3; i++) {
        await RecordingAnalyticsService.trackRecordingEvent({
          ...baseEvent,
          sessionId: `session-${i}`,
          eventType: 'recording_sent',
          quality: poorQuality,
        });
      }
    });

    it('should generate appropriate insights and recommendations', async () => {
      const result = await RecordingAnalyticsService.getRecordingInsights('user-123');

      expect(result.insights).toContain(
        expect.stringContaining('Low completion rate: 30.0% of recording sessions are completed')
      );
      expect(result.insights).toContain(
        expect.stringContaining('High retry rate: Users retry recordings 3.0 times on average')
      );
      expect(result.insights).toContain(
        expect.stringContaining('Quality issues: 100.0% of recordings have quality problems')
      );
      expect(result.insights).toContain(
        expect.stringContaining('Short recordings: Users are recording very brief messages')
      );

      expect(result.recommendations).toContain(
        'Consider simplifying the recording interface or providing better guidance'
      );
      expect(result.recommendations).toContain(
        'Improve recording quality validation or provide better recording tips'
      );
      expect(result.recommendations).toContain(
        'Implement better recording quality guidance or automatic quality enhancement'
      );
      expect(result.recommendations).toContain(
        'Encourage longer, more detailed storytelling with better prompts'
      );
    });

    it('should handle empty data gracefully', async () => {
      const result = await RecordingAnalyticsService.getRecordingInsights('nonexistent-user');

      expect(result.insights).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('date range filtering', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Mock the timestamp for events
      const originalTrackEvent = RecordingAnalyticsService.trackRecordingEvent;
      let callCount = 0;

      jest.spyOn(RecordingAnalyticsService, 'trackRecordingEvent').mockImplementation(async (eventData) => {
        const result = await originalTrackEvent.call(RecordingAnalyticsService, eventData);
        
        // Manually set timestamps for testing
        const userEvents = (RecordingAnalyticsService as any).analyticsEvents.get(eventData.userId) || [];
        if (userEvents.length > 0) {
          const lastEvent = userEvents[userEvents.length - 1];
          if (callCount === 0) {
            lastEvent.timestamp = yesterday;
          } else if (callCount === 1) {
            lastEvent.timestamp = now;
          } else {
            lastEvent.timestamp = tomorrow;
          }
        }
        callCount++;
        
        return result;
      });

      // Add events with different timestamps
      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-yesterday',
        eventType: 'recording_sent',
      });

      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-today',
        eventType: 'recording_sent',
      });

      await RecordingAnalyticsService.trackRecordingEvent({
        userId: 'user-123',
        projectId: 'project-456',
        sessionId: 'session-tomorrow',
        eventType: 'recording_sent',
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should filter events by date range', async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const metrics = await RecordingAnalyticsService.getCompletionMetrics(
        'user-123',
        undefined,
        { start: startOfToday, end: endOfToday }
      );

      // Should only include today's event
      expect(metrics.totalRecordingsSessions).toBe(1);
    });
  });
});