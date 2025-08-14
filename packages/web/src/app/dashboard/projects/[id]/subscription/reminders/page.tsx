'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../../../components/ui/card';
import { Button } from '../../../../../../components/ui/button';
import { Loading } from '../../../../../../components/ui/loading';
import { SubscriptionReminderSettings } from '../../../../../../components/subscription/subscription-reminder-settings';
import { UpcomingReminders } from '../../../../../../components/subscription/upcoming-reminders';
import { useSubscriptionReminders } from '../../../../../../hooks/use-subscription-reminders';
import { useSubscription } from '../../../../../../hooks/use-subscription';
import { ArrowLeft, Bell, Settings, Calendar, AlertTriangle } from 'lucide-react';

export default function SubscriptionRemindersPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<'settings' | 'upcoming'>('settings');
  const [previewReminder, setPreviewReminder] = useState<any>(null);

  const { subscription, loading: subscriptionLoading } = useSubscription({ projectId });
  
  const {
    settings,
    scheduledReminders,
    loading: remindersLoading,
    error: remindersError,
    updateSettings,
    testReminder,
    cancelReminder,
    refresh
  } = useSubscriptionReminders({ projectId, autoRefresh: true });

  const loading = subscriptionLoading || remindersLoading;
  const projectName = subscription?.projectName || 'Project';

  const handleSaveSettings = async (newSettings: any) => {
    try {
      await updateSettings(newSettings);
    } catch (error) {
      console.error('Failed to save reminder settings:', error);
      throw error;
    }
  };

  const handleTestReminder = async (type: 'email' | 'push') => {
    try {
      await testReminder(type);
      // Could show a success toast here
    } catch (error) {
      console.error('Failed to send test reminder:', error);
      throw error;
    }
  };

  const handleCancelReminder = async (reminderId: string) => {
    try {
      await cancelReminder(reminderId);
    } catch (error) {
      console.error('Failed to cancel reminder:', error);
    }
  };

  const handlePreviewReminder = (reminder: any) => {
    setPreviewReminder(reminder);
  };

  const handleEditReminder = (reminder: any) => {
    // Could open an edit modal or navigate to edit page
    console.log('Edit reminder:', reminder);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Reminders</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        <Loading />
      </div>
    );
  }

  if (remindersError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Reminders</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Reminders</h3>
          <p className="text-red-600 mb-4">{remindersError}</p>
          <div className="flex justify-center space-x-3">
            <Button onClick={refresh} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Reminders</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <Card className="p-8 text-center">
          <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reminder Settings</h3>
          <p className="text-gray-600 mb-4">
            Reminder settings will be available once your subscription is active.
          </p>
          <Button onClick={() => router.push(`/dashboard/projects/${projectId}/subscription`)}>
            Manage Subscription
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Reminders</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => router.push(`/dashboard/projects/${projectId}/subscription`)}
            variant="outline"
          >
            Manage Subscription
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline mr-2" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upcoming'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Upcoming ({scheduledReminders.filter(r => r.status === 'scheduled').length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'settings' && (
          <SubscriptionReminderSettings
            settings={settings}
            onSave={handleSaveSettings}
            onTest={handleTestReminder}
            loading={remindersLoading}
          />
        )}

        {activeTab === 'upcoming' && (
          <UpcomingReminders
            reminders={scheduledReminders}
            onCancel={handleCancelReminder}
            onPreview={handlePreviewReminder}
            onEdit={handleEditReminder}
            loading={remindersLoading}
          />
        )}
      </div>

      {/* Preview Modal */}
      {previewReminder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Reminder Preview</h2>
                <Button
                  onClick={() => setPreviewReminder(null)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-2">Subject/Title:</div>
                  <div className="font-medium text-gray-900">{previewReminder.content.subject}</div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-2">Message:</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{previewReminder.content.message}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600 mb-1">Type:</div>
                    <div className="font-medium text-blue-900 capitalize">
                      {previewReminder.type.replace('_', ' ')}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-600 mb-1">Method:</div>
                    <div className="font-medium text-green-900 capitalize">
                      {previewReminder.method}
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-sm text-yellow-600 mb-1">Scheduled For:</div>
                  <div className="font-medium text-yellow-900">
                    {new Intl.DateTimeFormat('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }).format(previewReminder.scheduledFor)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Email Reminders</h3>
          <p className="text-sm text-gray-600 mb-3">
            {settings.email.enabled ? 'Enabled' : 'Disabled'}
          </p>
          <div className="text-2xl font-bold text-blue-600">
            {scheduledReminders.filter(r => r.method === 'email' && r.status === 'scheduled').length}
          </div>
          <div className="text-sm text-gray-600">Scheduled</div>
        </Card>
        
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Push Notifications</h3>
          <p className="text-sm text-gray-600 mb-3">
            {settings.push.enabled ? 'Enabled' : 'Disabled'}
          </p>
          <div className="text-2xl font-bold text-green-600">
            {scheduledReminders.filter(r => r.method === 'push' && r.status === 'scheduled').length}
          </div>
          <div className="text-sm text-gray-600">Scheduled</div>
        </Card>
        
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Next Reminder</h3>
          <p className="text-sm text-gray-600 mb-3">
            {scheduledReminders.filter(r => r.status === 'scheduled').length > 0 ? 'Upcoming' : 'None scheduled'}
          </p>
          <div className="text-2xl font-bold text-purple-600">
            {scheduledReminders.filter(r => r.status === 'scheduled').length > 0
              ? Math.ceil((scheduledReminders
                  .filter(r => r.status === 'scheduled')
                  .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0]
                  ?.scheduledFor.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 0}
          </div>
          <div className="text-sm text-gray-600">Days</div>
        </Card>
      </div>
    </div>
  );
}