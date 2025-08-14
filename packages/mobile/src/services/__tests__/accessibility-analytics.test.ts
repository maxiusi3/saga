import { AccessibilityAnalytics } from '../accessibility-analytics';

describe('AccessibilityAnalytics', () => {
  beforeEach(() => {
    // Clear events before each test
    AccessibilityAnalytics.clearEvents();
  });

  describe('Font Size Tracking', () => {
    it('should track font size changes', () => {
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_font_size_changed');
      expect(events[0].properties).toEqual({
        from_size: 'standard',
        to_size: 'large',
      });
    });

    it('should track multiple font size changes', () => {
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      AccessibilityAnalytics.trackFontSizeChanged('large', 'extraLarge');
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(2);
    });
  });

  describe('Contrast Mode Tracking', () => {
    it('should track contrast mode changes', () => {
      AccessibilityAnalytics.trackContrastModeChanged('normal', 'high');
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_contrast_mode_changed');
      expect(events[0].properties).toEqual({
        from_mode: 'normal',
        to_mode: 'high',
      });
    });
  });

  describe('Settings Screen Tracking', () => {
    it('should track settings screen opens', () => {
      AccessibilityAnalytics.trackSettingsScreenOpened();
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_settings_opened');
      expect(events[0].properties?.opened_at).toBeDefined();
    });

    it('should track settings reset', () => {
      AccessibilityAnalytics.trackSettingsReset();
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_settings_reset');
      expect(events[0].properties?.reset_at).toBeDefined();
    });
  });

  describe('System Accessibility Tracking', () => {
    it('should track screen reader detection', () => {
      AccessibilityAnalytics.trackSystemAccessibilityDetected('screen_reader', true);
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('system_accessibility_detected');
      expect(events[0].properties).toEqual({
        feature: 'screen_reader',
        enabled: true,
        detected_at: expect.any(String),
      });
    });

    it('should track reduce motion detection', () => {
      AccessibilityAnalytics.trackSystemAccessibilityDetected('reduce_motion', false);
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].properties?.feature).toBe('reduce_motion');
      expect(events[0].properties?.enabled).toBe(false);
    });
  });

  describe('Feature Usage Tracking', () => {
    it('should track feature usage', () => {
      AccessibilityAnalytics.trackFeatureUsage('high_contrast', 5000);
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_feature_usage');
      expect(events[0].properties).toEqual({
        feature: 'high_contrast',
        duration_ms: 5000,
        used_at: expect.any(String),
      });
    });
  });

  describe('Error Tracking', () => {
    it('should track accessibility errors', () => {
      AccessibilityAnalytics.trackAccessibilityError('Failed to load font', 'font_loading');
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_error');
      expect(events[0].properties).toEqual({
        error: 'Failed to load font',
        context: 'font_loading',
        error_at: expect.any(String),
      });
    });
  });

  describe('Satisfaction Tracking', () => {
    it('should track user satisfaction', () => {
      AccessibilityAnalytics.trackAccessibilitySatisfaction(5, 'font_size');
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('accessibility_satisfaction');
      expect(events[0].properties).toEqual({
        rating: 5,
        feature: 'font_size',
        rated_at: expect.any(String),
      });
    });
  });

  describe('Usage Metrics', () => {
    beforeEach(() => {
      // Set up some test data
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      AccessibilityAnalytics.trackFontSizeChanged('large', 'extraLarge');
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      AccessibilityAnalytics.trackContrastModeChanged('normal', 'high');
      AccessibilityAnalytics.trackContrastModeChanged('high', 'normal');
      AccessibilityAnalytics.trackSystemAccessibilityDetected('screen_reader', true);
      AccessibilityAnalytics.trackSystemAccessibilityDetected('reduce_motion', true);
    });

    it('should calculate usage metrics correctly', () => {
      const metrics = AccessibilityAnalytics.getUsageMetrics();
      
      expect(metrics.fontSizeDistribution).toEqual({
        large: 2,
        extraLarge: 1,
      });
      
      expect(metrics.contrastModeUsage).toEqual({
        high: 1,
        normal: 1,
      });
      
      expect(metrics.settingsChangeFrequency).toBe(5);
      expect(metrics.screenReaderUsage).toBe(1);
      expect(metrics.reduceMotionUsage).toBe(1);
    });

    it('should calculate adoption rate', () => {
      AccessibilityAnalytics.trackSettingsScreenOpened();
      AccessibilityAnalytics.trackSettingsScreenOpened();
      
      const adoptionRate = AccessibilityAnalytics.getAdoptionRate();
      expect(adoptionRate).toBe(250); // 5 changes / 2 opens * 100
    });

    it('should get popular features', () => {
      const popularFeatures = AccessibilityAnalytics.getPopularFeatures();
      
      expect(popularFeatures).toEqual([
        { feature: 'font_size_large', usage: 2 },
        { feature: 'font_size_extraLarge', usage: 1 },
        { feature: 'high_contrast', usage: 1 },
      ]);
    });

    it('should calculate error rate', () => {
      AccessibilityAnalytics.trackAccessibilityError('Test error');
      
      const errorRate = AccessibilityAnalytics.getErrorRate();
      expect(errorRate).toBeGreaterThan(0);
    });
  });

  describe('Date Range Queries', () => {
    it('should get events in date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      
      const eventsInRange = AccessibilityAnalytics.getEventsInRange(oneHourAgo, now);
      expect(eventsInRange).toHaveLength(1);
      
      const eventsOutOfRange = AccessibilityAnalytics.getEventsInRange(twoHoursAgo, oneHourAgo);
      expect(eventsOutOfRange).toHaveLength(0);
    });

    it('should get daily usage stats', () => {
      AccessibilityAnalytics.trackSettingsScreenOpened();
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      AccessibilityAnalytics.trackContrastModeChanged('normal', 'high');
      AccessibilityAnalytics.trackAccessibilityError('Test error');
      
      const today = new Date();
      const stats = AccessibilityAnalytics.getDailyUsageStats(today);
      
      expect(stats.totalEvents).toBe(4);
      expect(stats.settingsOpened).toBe(1);
      expect(stats.fontSizeChanges).toBe(1);
      expect(stats.contrastModeChanges).toBe(1);
      expect(stats.errors).toBe(1);
    });
  });

  describe('Data Management', () => {
    it('should clear events', () => {
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      expect(AccessibilityAnalytics.exportEvents()).toHaveLength(1);
      
      AccessibilityAnalytics.clearEvents();
      expect(AccessibilityAnalytics.exportEvents()).toHaveLength(0);
    });

    it('should export events', () => {
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      AccessibilityAnalytics.trackContrastModeChanged('normal', 'high');
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('accessibility_font_size_changed');
      expect(events[1].event).toBe('accessibility_contrast_mode_changed');
    });
  });

  describe('Event Properties', () => {
    it('should include timestamps in events', () => {
      const beforeTime = new Date();
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large');
      const afterTime = new Date();
      
      const events = AccessibilityAnalytics.exportEvents();
      const eventTime = events[0].timestamp;
      
      expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should accept additional properties', () => {
      AccessibilityAnalytics.trackFontSizeChanged('standard', 'large', {
        user_id: 'test-user',
        session_id: 'test-session',
      });
      
      const events = AccessibilityAnalytics.exportEvents();
      expect(events[0].properties).toEqual({
        from_size: 'standard',
        to_size: 'large',
        user_id: 'test-user',
        session_id: 'test-session',
      });
    });
  });
});