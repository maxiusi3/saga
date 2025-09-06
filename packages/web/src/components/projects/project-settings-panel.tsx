'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/utils'
import { apiClient } from '@/lib/api'

interface ProjectSettings {
  id: string
  name: string
  description: string
  isPublic: boolean
  allowGuestAccess: boolean
  autoGenerateChapterSummaries: boolean
  notificationSettings: {
    newStoryNotifications: boolean
    newInteractionNotifications: boolean
    weeklyDigest: boolean
  }
  subscriptionStatus: 'active' | 'expired' | 'trial'
  subscriptionExpiresAt?: string
  archivalStatus: 'active' | 'archived'
}

interface ProjectSettingsPanelProps {
  projectId: string
  currentSettings: ProjectSettings
  isProjectOwner: boolean
  onSettingsUpdate: (settings: ProjectSettings) => void
}

export function ProjectSettingsPanel({ 
  projectId, 
  currentSettings, 
  isProjectOwner,
  onSettingsUpdate 
}: ProjectSettingsPanelProps) {
  const [settings, setSettings] = useState<ProjectSettings>(currentSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleSettingChange = (key: keyof ProjectSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
    setHasChanges(true)
  }

  const handleNotificationChange = (key: keyof ProjectSettings['notificationSettings'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [key]: value
      }
    }))
    setHasChanges(true)
  }

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      const response = await apiClient.put(`/api/projects/${projectId}/settings`, settings)
      onSettingsUpdate(response.data.data)
      setHasChanges(false)
      toast.success('Project settings updated successfully')
    } catch (error) {
      console.error('Failed to update project settings:', error)
      toast.error('Failed to update project settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRenewSubscription = async () => {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/renew-subscription`)
      window.location.href = response.data.data.checkoutUrl
    } catch (error) {
      console.error('Failed to initiate subscription renewal:', error)
      toast.error('Failed to initiate subscription renewal')
    }
  }

  const getSubscriptionStatusBadge = () => {
    switch (settings.subscriptionStatus) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success-foreground">
            Active
          </span>
        )
      case 'trial':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            Trial
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive-foreground">
            Expired
          </span>
        )
    }
  }

  const getArchivalStatusBadge = () => {
    if (settings.archivalStatus === 'archived') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          Archived (Read-only)
        </span>
      )
    }
    return null
  }

  return (
    <div className="bg-background rounded-lg shadow">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-medium text-foreground">Project Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your project configuration and preferences
        </p>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Project Status */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Project Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subscription Status</p>
                <p className="text-xs text-muted-foreground">
                  {settings.subscriptionExpiresAt && (
                    <>Expires {formatRelativeTime(settings.subscriptionExpiresAt)}</>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {getSubscriptionStatusBadge()}
                {settings.subscriptionStatus === 'expired' && isProjectOwner && (
                  <button
                    onClick={handleRenewSubscription}
                    className="text-sm font-medium text-primary hover:text-primary/90"
                  >
                    Renew
                  </button>
                )}
              </div>
            </div>
            
            {settings.archivalStatus === 'archived' && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Archival Status</p>
                  <p className="text-xs text-muted-foreground">
                    Project is in read-only mode
                  </p>
                </div>
                {getArchivalStatusBadge()}
              </div>
            )}
          </div>
        </div>

        {/* Basic Settings */}
        {isProjectOwner && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Basic Settings</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium text-muted-foreground">
                  Project Name
                </label>
                <input
                  type="text"
                  id="project-name"
                  value={settings.name}
                  onChange={(e) => handleSettingChange('name', e.target.value)}
                  className="mt-1 block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  disabled={settings.archivalStatus === 'archived'}
                />
              </div>
              
              <div>
                <label htmlFor="project-description" className="block text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <textarea
                  id="project-description"
                  rows={3}
                  value={settings.description}
                  onChange={(e) => handleSettingChange('description', e.target.value)}
                  className="mt-1 block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  disabled={settings.archivalStatus === 'archived'}
                />
              </div>
            </div>
          </div>
        )}

        {/* Feature Settings */}
        {isProjectOwner && settings.archivalStatus !== 'archived' && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Features</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Auto-generate Chapter Summaries</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically create AI-powered summaries when chapters are completed
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoGenerateChapterSummaries}
                    onChange={(e) => handleSettingChange('autoGenerateChapterSummaries', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">New Story Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when new stories are recorded
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notificationSettings.newStoryNotifications}
                  onChange={(e) => handleNotificationChange('newStoryNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">New Interaction Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when someone comments or asks questions
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notificationSettings.newInteractionNotifications}
                  onChange={(e) => handleNotificationChange('newInteractionNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a weekly summary of project activity
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notificationSettings.weeklyDigest}
                  onChange={(e) => handleNotificationChange('weeklyDigest', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-4 border-t border-border">
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSettings(currentSettings)
                  setHasChanges(false)
                }}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="btn-primary"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}