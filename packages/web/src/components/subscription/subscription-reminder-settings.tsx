'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTranslations } from 'next-intl';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Calendar, 
  Clock,
  Settings,
  Check,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

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
      threshold: number; // percentage of subscription period
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
      start: string; // HH:MM format
      end: string; // HH:MM format
    };
    frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
  };
}

interface SubscriptionReminderSettingsProps {
  settings: ReminderSettings;
  onSave: (settings: ReminderSettings) => Promise<void>;
  onTest: (type: 'email' | 'push') => Promise<void>;
  loading?: boolean;
  className?: string;
}

export function SubscriptionReminderSettings({
  settings,
  onSave,
  onTest,
  loading = false,
  className = ''
}: SubscriptionReminderSettingsProps) {
  const t = useTranslations('subscription.actions')
  const [localSettings, setLocalSettings] = useState<ReminderSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const updateSettings = (path: string, value: any) => {
    const keys = path.split('.');
    const newSettings = { ...localSettings };
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await onSave(localSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save reminder settings:', error);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      await onTest('email');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      await onTest('push');
    } finally {
      setTestingPush(false);
    }
  };

  const renderDaysSelector = (
    path: string,
    currentDays: number[],
    label: string
  ) => {
    const dayOptions = [1, 3, 7, 14, 30];
    
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex flex-wrap gap-2">
          {dayOptions.map((day) => (
            <button
              key={day}
              onClick={() => {
                const newDays = currentDays.includes(day)
                  ? currentDays.filter(d => d !== day)
                  : [...currentDays, day].sort((a, b) => a - b);
                updateSettings(path, newDays);
              }}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                currentDays.includes(day)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {day} day{day !== 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="h-5 w-5 mr-2 text-gray-600" />
            Subscription Reminders
          </h2>
          <p className="text-gray-600">
            Configure when and how you want to be reminded about your subscription
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {hasChanges && (
            <Badge variant="secondary">Unsaved changes</Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? t('saving') : t('saveSettings')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Reminders */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-blue-600" />
              Email Reminders
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleTestEmail}
                variant="outline"
                size="sm"
                disabled={testingEmail || !localSettings.email.enabled}
              >
                {testingEmail ? 'Sending...' : 'Test Email'}
              </Button>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.email.enabled}
                  onChange={(e) => updateSettings('email.enabled', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
          </div>

          <div className={`space-y-4 ${!localSettings.email.enabled ? 'opacity-50' : ''}`}>
            {/* Expiry Warning */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-red-900 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Expiry Warnings
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.email.expiryWarning.enabled}
                    onChange={(e) => updateSettings('email.expiryWarning.enabled', e.target.checked)}
                    disabled={!localSettings.email.enabled}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>
              {localSettings.email.expiryWarning.enabled && (
                <div>
                  {renderDaysSelector(
                    'email.expiryWarning.daysBefore',
                    localSettings.email.expiryWarning.daysBefore,
                    'Send warnings before expiry:'
                  )}
                </div>
              )}
            </div>

            {/* Renewal Reminder */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-green-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Renewal Reminders
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.email.renewalReminder.enabled}
                    onChange={(e) => updateSettings('email.renewalReminder.enabled', e.target.checked)}
                    disabled={!localSettings.email.enabled}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </label>
              </div>
              {localSettings.email.renewalReminder.enabled && (
                <div>
                  {renderDaysSelector(
                    'email.renewalReminder.daysBefore',
                    localSettings.email.renewalReminder.daysBefore,
                    'Send renewal reminders:'
                  )}
                </div>
              )}
            </div>

            {/* Usage Reminder */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Usage Reminders
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.email.usageReminder.enabled}
                    onChange={(e) => updateSettings('email.usageReminder.enabled', e.target.checked)}
                    disabled={!localSettings.email.enabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
              {localSettings.email.usageReminder.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Frequency:</label>
                    <select
                      value={localSettings.email.usageReminder.frequency}
                      onChange={(e) => updateSettings('email.usageReminder.frequency', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Send when usage is below: {localSettings.email.usageReminder.threshold}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="10"
                      value={localSettings.email.usageReminder.threshold}
                      onChange={(e) => updateSettings('email.usageReminder.threshold', parseInt(e.target.value))}
                      className="mt-2 w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Engagement Reminder */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-900 flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Engagement Reminders
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.email.engagementReminder.enabled}
                    onChange={(e) => updateSettings('email.engagementReminder.enabled', e.target.checked)}
                    disabled={!localSettings.email.enabled}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </label>
              </div>
              {localSettings.email.engagementReminder.enabled && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Send after {localSettings.email.engagementReminder.inactivityDays} days of inactivity
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    step="1"
                    value={localSettings.email.engagementReminder.inactivityDays}
                    onChange={(e) => updateSettings('email.engagementReminder.inactivityDays', parseInt(e.target.value))}
                    className="mt-2 w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Push Notifications */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Smartphone className="h-5 w-5 mr-2 text-green-600" />
              Push Notifications
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleTestPush}
                variant="outline"
                size="sm"
                disabled={testingPush || !localSettings.push.enabled}
              >
                {testingPush ? 'Sending...' : 'Test Push'}
              </Button>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.push.enabled}
                  onChange={(e) => updateSettings('push.enabled', e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
          </div>

          <div className={`space-y-4 ${!localSettings.push.enabled ? 'opacity-50' : ''}`}>
            {/* Similar structure to email reminders but for push notifications */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-red-900 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Expiry Warnings
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.push.expiryWarning.enabled}
                    onChange={(e) => updateSettings('push.expiryWarning.enabled', e.target.checked)}
                    disabled={!localSettings.push.enabled}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>
              {localSettings.push.expiryWarning.enabled && (
                <div>
                  {renderDaysSelector(
                    'push.expiryWarning.daysBefore',
                    localSettings.push.expiryWarning.daysBefore,
                    'Send push notifications before expiry:'
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-green-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Renewal Reminders
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.push.renewalReminder.enabled}
                    onChange={(e) => updateSettings('push.renewalReminder.enabled', e.target.checked)}
                    disabled={!localSettings.push.enabled}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </label>
              </div>
              {localSettings.push.renewalReminder.enabled && (
                <div>
                  {renderDaysSelector(
                    'push.renewalReminder.daysBefore',
                    localSettings.push.renewalReminder.daysBefore,
                    'Send push renewal reminders:'
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-900 flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Engagement Reminders
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.push.engagementReminder.enabled}
                    onChange={(e) => updateSettings('push.engagementReminder.enabled', e.target.checked)}
                    disabled={!localSettings.push.enabled}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </label>
              </div>
              {localSettings.push.engagementReminder.enabled && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Send after {localSettings.push.engagementReminder.inactivityDays} days of inactivity
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    step="1"
                    value={localSettings.push.engagementReminder.inactivityDays}
                    onChange={(e) => updateSettings('push.engagementReminder.inactivityDays', parseInt(e.target.value))}
                    className="mt-2 w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Preferences */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2 text-gray-600" />
          Notification Preferences
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={localSettings.preferences.timezone}
              onChange={(e) => updateSettings('preferences.timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Frequency
            </label>
            <select
              value={localSettings.preferences.frequency}
              onChange={(e) => updateSettings('preferences.frequency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="immediate">Immediate</option>
              <option value="daily_digest">Daily Digest</option>
              <option value="weekly_digest">Weekly Digest</option>
            </select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Quiet Hours
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.preferences.quietHours.enabled}
                  onChange={(e) => updateSettings('preferences.quietHours.enabled', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            {localSettings.preferences.quietHours.enabled && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600">From:</label>
                  <input
                    type="time"
                    value={localSettings.preferences.quietHours.start}
                    onChange={(e) => updateSettings('preferences.quietHours.start', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">To:</label>
                  <input
                    type="time"
                    value={localSettings.preferences.quietHours.end}
                    onChange={(e) => updateSettings('preferences.quietHours.end', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Information */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">About Subscription Reminders</h4>
            <p className="text-sm text-blue-800 mt-1">
              These reminders help you stay on top of your subscription and maximize your family's 
              storytelling experience. You can adjust or disable any reminder type at any time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default SubscriptionReminderSettings;