interface OnboardingAnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: Date;
}

class OnboardingAnalyticsService {
  private events: OnboardingAnalyticsEvent[] = [];

  // Track onboarding step progression
  trackStepStarted(step: string, properties?: Record<string, any>) {
    this.trackEvent('onboarding_step_started', {
      step,
      ...properties,
    });
  }

  trackStepCompleted(step: string, properties?: Record<string, any>) {
    this.trackEvent('onboarding_step_completed', {
      step,
      ...properties,
    });
  }

  // Track invitation validation
  trackInvitationValidated(success: boolean, properties?: Record<string, any>) {
    this.trackEvent('invitation_validated', {
      success,
      ...properties,
    });
  }

  // Track privacy acceptance
  trackPrivacyAccepted(properties?: Record<string, any>) {
    this.trackEvent('privacy_accepted', properties);
  }

  // Track onboarding completion
  trackOnboardingCompleted(properties?: Record<string, any>) {
    this.trackEvent('onboarding_completed', {
      completion_time: new Date().toISOString(),
      ...properties,
    });
  }

  // Track onboarding abandonment
  trackOnboardingAbandoned(step: string, properties?: Record<string, any>) {
    this.trackEvent('onboarding_abandoned', {
      abandoned_at_step: step,
      ...properties,
    });
  }

  // Track errors
  trackError(error: string, step?: string, properties?: Record<string, any>) {
    this.trackEvent('onboarding_error', {
      error,
      step,
      ...properties,
    });
  }

  // Generic event tracking
  private trackEvent(event: string, properties?: Record<string, any>) {
    const analyticsEvent: OnboardingAnalyticsEvent = {
      event,
      properties,
      timestamp: new Date(),
    };

    this.events.push(analyticsEvent);

    // In a real implementation, you would send this to your analytics service
    // For now, we'll just log it for development
    if (__DEV__) {
      console.log('📊 Onboarding Analytics:', analyticsEvent);
    }

    // TODO: Send to actual analytics service (e.g., Mixpanel, Amplitude, etc.)
    // this.sendToAnalyticsService(analyticsEvent);
  }

  // Get completion rate metrics
  getCompletionRate(): number {
    const startedEvents = this.events.filter(e => e.event === 'onboarding_step_started' && e.properties?.step === 'welcome');
    const completedEvents = this.events.filter(e => e.event === 'onboarding_completed');
    
    if (startedEvents.length === 0) return 0;
    return (completedEvents.length / startedEvents.length) * 100;
  }

  // Get step-by-step funnel data
  getFunnelData() {
    const steps = ['welcome', 'user-info', 'privacy', 'complete'];
    const funnel = steps.map(step => {
      const started = this.events.filter(e => 
        e.event === 'onboarding_step_started' && e.properties?.step === step
      ).length;
      const completed = this.events.filter(e => 
        e.event === 'onboarding_step_completed' && e.properties?.step === step
      ).length;
      
      return {
        step,
        started,
        completed,
        completion_rate: started > 0 ? (completed / started) * 100 : 0,
      };
    });

    return funnel;
  }

  // Clear events (for testing or privacy)
  clearEvents() {
    this.events = [];
  }

  // Export events for debugging
  exportEvents() {
    return [...this.events];
  }
}

export const OnboardingAnalytics = new OnboardingAnalyticsService();