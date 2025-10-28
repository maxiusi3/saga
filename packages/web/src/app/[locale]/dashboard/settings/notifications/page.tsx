'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, Mail, Save, ArrowLeft } from 'lucide-react'
import { useNotificationSettings } from '@/hooks/useNotifications'
import { getNotificationDisplayInfo, SagaNotificationType } from '@saga/shared'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

const notificationTypes: { type: SagaNotificationType; title: string; description: string }[] = [
  {
    type: 'new_story',
    title: 'New Stories',
    description: 'When someone records a new story in your projects'
  },
  {
    type: 'new_comment',
    title: 'Comments on Your Stories',
    description: 'When someone comments on stories you recorded'
  },
  {
    type: 'new_follow_up_question',
    title: 'Follow-up Questions',
    description: 'When someone asks follow-up questions on your stories'
  },
  {
    type: 'story_response',
    title: 'Story Activity',
    description: 'When there\'s new activity on stories in your projects'
  },
  {
    type: 'project_invitation',
    title: 'Project Invitations',
    description: 'When someone invites you to join a project'
  },
  {
    type: 'member_joined',
    title: 'New Members',
    description: 'When new members join your projects'
  }
]

export default function NotificationSettingsPage() {
  const { settings, loading, error, updateSetting } = useNotificationSettings()
  const [localSettings, setLocalSettings] = useState<Record<string, { enabled: boolean; emailEnabled: boolean }>>({})
  const [saving, setSaving] = useState(false)

  // Initialize local settings from fetched settings
  useEffect(() => {
    const settingsMap: Record<string, { enabled: boolean; emailEnabled: boolean }> = {}
    
    notificationTypes.forEach(({ type }) => {
      const setting = settings.find(s => s.notification_type === type && !s.project_id)
      settingsMap[type] = {
        enabled: setting?.enabled ?? true,
        emailEnabled: setting?.email_enabled ?? false
      }
    })
    
    setLocalSettings(settingsMap)
  }, [settings])

  const handleToggle = (type: SagaNotificationType, field: 'enabled' | 'emailEnabled', value: boolean) => {
    setLocalSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const promises = Object.entries(localSettings).map(([type, setting]) =>
        updateSetting(null, type as NotificationType, setting.enabled, setting.emailEnabled)
      )
      
      await Promise.all(promises)
      toast.success('Notification settings saved successfully')
    } catch (err) {
      toast.error('Failed to save notification settings')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = () => {
    return Object.entries(localSettings).some(([type, localSetting]) => {
      const originalSetting = settings.find(s => s.notification_type === type && !s.project_id)
      return (
        localSetting.enabled !== (originalSetting?.enabled ?? true) ||
        localSetting.emailEnabled !== (originalSetting?.email_enabled ?? false)
      )
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notification Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage how and when you receive notifications
          </p>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive bg-destructive/10 text-destructive">
          <p className="text-sm">{error}</p>
        </Card>
      )}

      {/* Global Settings */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Global Notification Preferences</h2>
          <p className="text-sm text-muted-foreground mb-6">
            These settings apply to all your projects. You can override them for specific projects later.
          </p>

          <div className="space-y-6">
            {notificationTypes.map(({ type, title, description }) => {
              const displayInfo = getNotificationDisplayInfo(type)
              const setting = localSettings[type] || { enabled: true, emailEnabled: false }

              return (
                <div key={type} className="flex items-start space-x-4 p-4 border rounded-lg">
                  <div className={`p-2 rounded-lg bg-primary/10`}>
                    <span className={`text-lg text-primary`}>{displayInfo.icon}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-foreground">{title}</h3>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <Switch
                            checked={setting.enabled}
                            onCheckedChange={(checked) => handleToggle(type, 'enabled', checked)}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <Switch
                            checked={setting.emailEnabled}
                            onCheckedChange={(checked) => handleToggle(type, 'emailEnabled', checked)}
                            disabled={!setting.enabled}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{description}</p>
                    
                    <div className="flex items-center space-x-4 mt-2">
                      <Badge variant="outline">
                        {displayInfo.label}
                      </Badge>
                      {setting.enabled && (
                        <span className="text-xs text-positive-foreground">✓ In-app notifications enabled</span>
                      )}
                      {setting.emailEnabled && (
                        <span className="text-xs text-primary">✓ Email notifications enabled</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Save Button */}
      {hasChanges() && (
        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      )}

      {/* Additional Info */}
      <Card className="p-6 bg-muted">
        <h3 className="font-medium text-foreground mb-2">About Notifications</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            • <strong>In-app notifications</strong> appear in your notification bell and on the notifications page
          </p>
          <p>
            • <strong>Email notifications</strong> are sent to your registered email address
          </p>
          <p>
            • Notifications are automatically marked as read when you visit the related content
          </p>
          <p>
            • You can customize notification settings for individual projects in their settings pages
          </p>
        </div>
      </Card>
    </div>
  )
}
