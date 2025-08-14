'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface ReminderSettings {
  email: {
    enabled: boolean;
    expiryWarning: {
      enabled: boolean;
      daysBefore: number[];
    };
    renewalReminder: {
      enabled: boolean;
      daysBefore: number[];
    };
    usageReminder: {
      enabled: boolean;
      frequency: 'weekly' | 'monthly';
      threshold: number;
    };
    engagementReminder: {
      enabled: boolean;
      inactivityDays: number;
    };
  };
  push: {
    enabled: boolean;
    expiryWarning: {
      enabled: boolean;
      daysBefore: number[];
    };
    renewalReminder: {
      enabled: boolean;
      daysBefore: number[];
    };
    usageReminder: {
      enabled: boolean;
      frequency: 'weekly' | 'monthly';
      threshold: number;
    };
    engagementReminder: {
      enabled: boolean;
      inactivityDays: number;
    };
  };
  preferences: {
    timezone: string;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
  };
}

export interface ScheduledReminder {
  id: string;
  type: 'expiry_warning' | 'renewal_reminder' | 'usage_reminder' | 'engagement_reminder';
  method: 'email' | 'push';
  projectId: string;
  projectName: string;
  scheduledFor: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  content: {
    subject: string;
    message: string;
    actionUrl?: string;
  };
  metadata?: Record<string, any>;
}

interface UseSubscriptionRemindersOptions {
  projectId?: string;
  autoRefresh?: boolean;
}

interface UseSubscriptionRemindersReturn {
  settings: ReminderSettings | null;
  scheduledReminders: ScheduledReminder[];
  loading: boolean;
  error: string | null;
  updateSettings: (settings: ReminderSettings) => Promise<void>;
  testReminder: (type: 'email' | 'push') => Promise<void>;
  cancelReminder: (reminderId: string) => Promise<void>;
  getUpcomingReminders: () => Promise<ScheduledReminder[]>;
  refresh: () => Promise<void>;
}

export function useSubscriptionReminders(
  options: UseSubscriptionRemindersOptions = {}
): UseSubscriptionRemindersReturn {
  const { projectId, autoRefresh = false } = options;

  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [scheduledReminders, setScheduledReminders] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/reminder-settings`
        : '/reminder-settings';

      const response = await api.get(endpoint);

      if (response.data.success) {
        setSettings(response.data.data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch reminder settings');
      }
    } catch (err: any) {
      console.error('Error fetching reminder settings:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch reminder settings');
    }
  }, [projectId]);

  const fetchScheduledReminders = useCallback(async () => {
    try {
      const endpoint = projectId 
        ? `/projects/${projectId}/scheduled-reminders`
        : '/scheduled-reminders';

      const response = await api.get(endpoint);

      if (response.data.success) {
        const reminders = response.data.data.map((reminder: any) => ({
          ...reminder,
          scheduledFor: new Date(reminder.scheduledFor)
        }));
        setScheduledReminders(reminders);
      }
    } catch (err: any) {
      console.error('Error fetching scheduled reminders:', err);
    }
  }, [projectId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchScheduledReminders()]);
    setLoading(false);
  }, [fetchSettings, fetchScheduledReminders]);

  const updateSettings = useCallback(async (newSettings: ReminderSettings) => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/reminder-settings`
        : '/reminder-settings';

      const response = await api.put(endpoint, newSettings);

      if (response.data.success) {
        setSettings(newSettings);
        // Refresh scheduled reminders as they may have changed
        await fetchScheduledReminders();
      } else {
        setError(response.data.error?.message || 'Failed to update reminder settings');
      }
    } catch (err: any) {
      console.error('Error updating reminder settings:', err);
      setError(err.response?.data?.error?.message || 'Failed to update reminder settings');
      throw err;
    }
  }, [projectId, fetchScheduledReminders]);

  const testReminder = useCallback(async (type: 'email' | 'push') => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/test-reminder`
        : '/test-reminder';

      const response = await api.post(endpoint, { type });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to send test reminder');
      }
    } catch (err: any) {
      console.error('Error sending test reminder:', err);
      setError(err.response?.data?.error?.message || 'Failed to send test reminder');
      throw err;
    }
  }, [projectId]);

  const cancelReminder = useCallback(async (reminderId: string) => {
    try {
      setError(null);
      
      const response = await api.delete(`/scheduled-reminders/${reminderId}`);

      if (response.data.success) {
        setScheduledReminders(prev => 
          prev.map(reminder => 
            reminder.id === reminderId 
              ? { ...reminder, status: 'cancelled' as const }
              : reminder
          )
        );
      } else {
        throw new Error(response.data.error?.message || 'Failed to cancel reminder');
      }
    } catch (err: any) {
      console.error('Error cancelling reminder:', err);
      setError(err.response?.data?.error?.message || 'Failed to cancel reminder');
      throw err;
    }
  }, []);

  const getUpcomingReminders = useCallback(async (): Promise<ScheduledReminder[]> => {
    try {
      const endpoint = projectId 
        ? `/projects/${projectId}/upcoming-reminders`
        : '/upcoming-reminders';

      const response = await api.get(endpoint, {
        params: { days: 30 } // Get reminders for next 30 days
      });

      if (response.data.success) {
        return response.data.data.map((reminder: any) => ({
          ...reminder,
          scheduledFor: new Date(reminder.scheduledFor)
        }));
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch upcoming reminders');
      }
    } catch (err: any) {
      console.error('Error fetching upcoming reminders:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch upcoming reminders');
      throw err;
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchScheduledReminders, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [autoRefresh, fetchScheduledReminders]);

  return {
    settings,
    scheduledReminders,
    loading,
    error,
    updateSettings,
    testReminder,
    cancelReminder,
    getUpcomingReminders,
    refresh: fetchData
  };
}

// Hook for managing reminder templates and content
export function useReminderTemplates() {
  const [templates, setTemplates] = useState<{
    email: Record<string, { subject: string; body: string; }>;
    push: Record<string, { title: string; body: string; }>;
  }>({
    email: {},
    push: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/reminder-templates');

      if (response.data.success) {
        setTemplates(response.data.data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch reminder templates');
      }
    } catch (err: any) {
      console.error('Error fetching reminder templates:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch reminder templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (
    type: 'email' | 'push',
    templateKey: string,
    content: { subject?: string; title?: string; body: string; }
  ) => {
    try {
      setError(null);
      
      const response = await api.put(`/reminder-templates/${type}/${templateKey}`, content);

      if (response.data.success) {
        setTemplates(prev => ({
          ...prev,
          [type]: {
            ...prev[type],
            [templateKey]: content
          }
        }));
      } else {
        throw new Error(response.data.error?.message || 'Failed to update template');
      }
    } catch (err: any) {
      console.error('Error updating reminder template:', err);
      setError(err.response?.data?.error?.message || 'Failed to update template');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    updateTemplate,
    refresh: fetchTemplates
  };
}

// Hook for reminder analytics
export function useReminderAnalytics(projectId?: string) {
  const [analytics, setAnalytics] = useState<{
    sent: number;
    opened: number;
    clicked: number;
    effectiveness: {
      expiryWarnings: { sent: number; renewals: number; rate: number; };
      renewalReminders: { sent: number; renewals: number; rate: number; };
      usageReminders: { sent: number; engagement: number; rate: number; };
      engagementReminders: { sent: number; activity: number; rate: number; };
    };
    trends: {
      period: string;
      sentCount: number[];
      openRate: number[];
      clickRate: number[];
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/reminder-analytics`
        : '/reminder-analytics';

      const response = await api.get(endpoint);

      if (response.data.success) {
        setAnalytics(response.data.data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch reminder analytics');
      }
    } catch (err: any) {
      console.error('Error fetching reminder analytics:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch reminder analytics');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refresh: fetchAnalytics
  };
}

export default useSubscriptionReminders;