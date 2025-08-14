interface AccessibilityAnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: Date;
}

interface AccessibilityUsageMetrics {
  fontSizeDistribution: Record<string, number>;
  contrastModeUsage: Record<string, number>;
  settingsChangeFrequency: number;
  screenReaderUsage: number;
  reduceMotionUsage: number;
}

class AccessibilityAnalyticsService {
  private events: AccessibilityAnalyticsEvent[] = [];

  // Track font size changes
  trackFontSizeChanged(fromSize: string, toSize: string, properties?: Record<string, any>) {
    this.trackEvent('accessibility_font_size_changed', {
      from_size: fromSize,
      to_size: toSize,
      ...properties,
    });
  }

  // Track contrast mode changes
  trackContrastModeChanged(fromMode: string, toMode: string, properties?: Record<string, any>) {
    this.trackEvent('accessibility_contrast_mode_changed', {
      from_mode: fromMode,
      to_mode: toMode,
      ...properties,
    });
  }

  // Track settings screen access
  trackSettingsScreenOpened(properties?: Record<string, any>) {
    this.trackEvent('accessibility_settings_opened', {
      opened_at: new Date().toISOString(),
      ...properties,
    });
  }

  // Track settings reset
  trackSettingsReset(properties?: Record<string, any>) {
    this.trackEvent('accessibility_settings_reset', {
      reset_at: new Date().toISOString(),
      ...properties,
    });
  }

  // Track system accessibility features usage
  trackSystemAccessibilityDetected(feature: 'screen_reader' | 'reduce_motion', enabled: boolean, properties?: Record<string, any>) {
    this.trackEvent('system_accessibility_detected', {
      feature,
      enabled,
      detected_at: new Date().toISOString(),
      ...properties,
    });
  }

  // Track accessibility feature usage patterns
  trackFeatureUsage(feature: string, duration?: number, properties?: Record<string, any>) {
    this.trackEvent('accessibility_feature_usage', {
      feature,
      duration_ms: duration,
      used_at: new Date().toISOString(),
      ...properties,
    });
  }

  // Track accessibility-related errors
  trackAccessibilityError(error: string, context?: string, properties?: Record<string, any>) {
    this.trackEvent('accessibility_error', {
      error,
      context,
      error_at: new Date().toISOString(),
      ...properties,
    });
  }

  // Track user satisfaction with accessibility features
  trackAccessibilitySatisfaction(rating: number, feature?: string, properties?: Record<string, any>) {
    this.trackEvent('accessibility_satisfaction', {
      rating,
      feature,
      rated_at: new Date().toISOString(),
      ...properties,
    });
  }

  // Generic event tracking
  private trackEvent(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AccessibilityAnalyticsEvent = {
      event,
      properties,
      timestamp: new Date(),
    };

    this.events.push(analyticsEvent);

    // In a real implementation, you would send this to your analytics service
    // For now, we'll just log it for development
    if (__DEV__) {
      console.log('♿ Accessibility Analytics:', analyticsEvent);
    }

    // TODO: Send to actual analytics service (e.g., Mixpanel, Amplitude, etc.)
    // this.sendToAnalyticsService(analyticsEvent);
  }

  // Get accessibility usage metrics
  getUsageMetrics(): AccessibilityUsageMetrics {
    const fontSizeEvents = this.events.filter(e => e.event === 'accessibility_font_size_changed');
    const contrastModeEvents = this.events.filter(e => e.event === 'accessibility_contrast_mode_changed');
    const systemAccessibilityEvents = this.events.filter(e => e.event === 'system_accessibility_detected');

    // Calculate font size distribution
    const fontSizeDistribution: Record<string, number> = {};
    fontSizeEvents.forEach(event => {
      const toSize = event.properties?.to_size;
      if (toSize) {
        fontSizeDistribution[toSize] = (fontSizeDistribution[toSize] || 0) + 1;
      }
    });

    // Calculate contrast mode usage
    const contrastModeUsage: Record<string, number> = {};
    contrastModeEvents.forEach(event => {
      const toMode = event.properties?.to_mode;
      if (toMode) {
        contrastModeUsage[toMode] = (contrastModeUsage[toMode] || 0) + 1;
      }
    });

    // Calculate settings change frequency
    const settingsChangeEvents = this.events.filter(e => 
      e.event === 'accessibility_font_size_changed' || 
      e.event === 'accessibility_contrast_mode_changed'
    );
    const settingsChangeFrequency = settingsChangeEvents.length;

    // Calculate system accessibility feature usage
    const screenReaderEvents = systemAccessibilityEvents.filter(e => 
      e.properties?.feature === 'screen_reader' && e.properties?.enabled === true
    );
    const reduceMotionEvents = systemAccessibilityEvents.filter(e => 
      e.properties?.feature === 'reduce_motion' && e.properties?.enabled === true
    );

    return {
      fontSizeDistribution,
      contrastModeUsage,
      settingsChangeFrequency,
      screenReaderUsage: screenReaderEvents.length,
      reduceMotionUsage: reduceMotionEvents.length,
    };
  }

  // Get accessibility adoption rate
  getAdoptionRate(): number {
    const settingsOpenedEvents = this.events.filter(e => e.event === 'accessibility_settings_opened');
    const settingsChangedEvents = this.events.filter(e => 
      e.event === 'accessibility_font_size_changed' || 
      e.event === 'accessibility_contrast_mode_changed'
    );
    
    if (settingsOpenedEvents.length === 0) return 0;
    return (settingsChangedEvents.length / settingsOpenedEvents.length) * 100;
  }

  // Get most popular accessibility features
  getPopularFeatures(): Array<{ feature: string; usage: number }> {
    const featureUsage: Record<string, number> = {};
    
    this.events.forEach(event => {
      if (event.event === 'accessibility_font_size_changed') {
        const toSize = event.properties?.to_size;
        if (toSize && toSize !== 'standard') {
          featureUsage[`font_size_${toSize}`] = (featureUsage[`font_size_${toSize}`] || 0) + 1;
        }
      } else if (event.event === 'accessibility_contrast_mode_changed') {
        const toMode = event.properties?.to_mode;
        if (toMode === 'high') {
          featureUsage['high_contrast'] = (featureUsage['high_contrast'] || 0) + 1;
        }
      }
    });

    return Object.entries(featureUsage)
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage);
  }

  // Get accessibility error rate
  getErrorRate(): number {
    const totalEvents = this.events.length;
    const errorEvents = this.events.filter(e => e.event === 'accessibility_error');
    
    if (totalEvents === 0) return 0;
    return (errorEvents.length / totalEvents) * 100;
  }

  // Clear events (for testing or privacy)
  clearEvents() {
    this.events = [];
  }

  // Export events for debugging
  exportEvents() {
    return [...this.events];
  }

  // Get events within a date range
  getEventsInRange(startDate: Date, endDate: Date) {
    return this.events.filter(event => 
      event.timestamp >= startDate && event.timestamp <= endDate
    );
  }

  // Get daily usage statistics
  getDailyUsageStats(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dayEvents = this.getEventsInRange(startOfDay, endOfDay);
    
    return {
      totalEvents: dayEvents.length,
      settingsOpened: dayEvents.filter(e => e.event === 'accessibility_settings_opened').length,
      fontSizeChanges: dayEvents.filter(e => e.event === 'accessibility_font_size_changed').length,
      contrastModeChanges: dayEvents.filter(e => e.event === 'accessibility_contrast_mode_changed').length,
      errors: dayEvents.filter(e => e.event === 'accessibility_error').length,
    };
  }
}

export const AccessibilityAnalytics = new AccessibilityAnalyticsService();