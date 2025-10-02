'use client'

import React, { useState } from 'react'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { ModernSwitch } from '@/components/ui/modern-switch'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  User,
  Bell,
  Shield,
  Eye,
  CreditCard,
  Users,
  Settings,
  Save,
  Camera,
  Mail,
  Phone,
  Globe,
  Volume2,
  Palette,
  Accessibility,
  Download,
  Trash2,
  AlertTriangle,
  Lock,
  Smartphone,
  Clock,
  Languages,
  Database,
  Key,
  Fingerprint,
  Monitor
} from 'lucide-react'

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  avatar?: string
  bio?: string
}

interface NotificationSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  storyUpdates: boolean
  followUpQuestions: boolean
  weeklyDigest: boolean
  marketingEmails: boolean
}

interface AccessibilitySettings {
  fontSize: 'standard' | 'large' | 'extra-large'
  highContrast: boolean
  reducedMotion: boolean
  screenReader: boolean
}

interface SettingsPageProps {
  userProfile: UserProfile
  notificationSettings: NotificationSettings
  accessibilitySettings: AccessibilitySettings
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>
  onUpdateNotifications?: (settings: NotificationSettings) => Promise<void>
  onUpdateAccessibility?: (settings: AccessibilitySettings) => Promise<void>
}

export function SettingsPage({
  userProfile,
  notificationSettings,
  accessibilitySettings,
  onUpdateProfile,
  onUpdateNotifications,
  onUpdateAccessibility
}: SettingsPageProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  // Form states
  const [profileForm, setProfileForm] = useState(userProfile)
  const [notificationForm, setNotificationForm] = useState(notificationSettings)
  const [accessibilityForm, setAccessibilityForm] = useState(accessibilitySettings)

  const handleSaveProfile = async () => {
    setIsLoading(true)
    try {
      await onUpdateProfile?.(profileForm)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setIsLoading(true)
    try {
      await onUpdateNotifications?.(notificationForm)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveAccessibility = async () => {
    setIsLoading(true)
    try {
      await onUpdateAccessibility?.(accessibilityForm)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account preferences and privacy settings</p>
        </div>

        <div className="space-y-6">
          {/* User Information */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-sage-600" />
                User Information
              </h2>
              
              <div className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={profileForm.avatar} />
                    <AvatarFallback className="text-xl bg-sage-100 text-sage-700">
                      {profileForm.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <EnhancedButton variant="secondary" size="sm">
                      <Camera className="w-4 h-4 mr-2" />
                      Change Photo
                    </EnhancedButton>
                    <p className="text-sm text-gray-500 mt-1">
                      JPG, PNG or GIF. Max size 2MB.
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileForm.phone || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                      className="mt-1"
                    />
                  </div>
                </div>

                <EnhancedButton onClick={handleSaveProfile} disabled={isLoading} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </EnhancedButton>
              </div>
            </div>
          </EnhancedCard>

          {/* Audio Settings */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-sage-600" />
                Audio Settings
              </h2>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">Volume</Label>
                  <div className="flex items-center gap-4">
                    <Volume2 className="w-4 h-4 text-gray-400" />
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      defaultValue="75"
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <span className="text-sm text-gray-600 w-8">75%</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">Audio Quality</Label>
                  <Select defaultValue="high">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Faster loading)</SelectItem>
                      <SelectItem value="medium">Medium (Balanced)</SelectItem>
                      <SelectItem value="high">High (Best quality)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </EnhancedCard>

          {/* Privacy & Security */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-sage-600" />
                Privacy & Security
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Profile Visibility</p>
                    <p className="text-sm text-gray-600">Make your profile visible to other family members</p>
                  </div>
                  <ModernSwitch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Story Sharing</p>
                    <p className="text-sm text-gray-600">Allow others to share your stories</p>
                  </div>
                  <ModernSwitch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Data Analytics</p>
                    <p className="text-sm text-gray-600">Help improve our service with usage data</p>
                  </div>
                  <ModernSwitch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-600">Add an extra layer of security</p>
                  </div>
                  <ModernSwitch />
                </div>
              </div>
            </div>
          </EnhancedCard>

          {/* Notifications */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5 text-sage-600" />
                Notifications
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Email Notifications</p>
                    <p className="text-sm text-gray-600">Receive updates via email</p>
                  </div>
                  <ModernSwitch 
                    checked={notificationForm.emailNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationForm(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Push Notifications</p>
                    <p className="text-sm text-gray-600">Get notified on your devices</p>
                  </div>
                  <ModernSwitch 
                    checked={notificationForm.pushNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationForm(prev => ({ ...prev, pushNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Weekly Digest</p>
                    <p className="text-sm text-gray-600">Weekly summary of family activity</p>
                  </div>
                  <ModernSwitch 
                    checked={notificationForm.weeklyDigest}
                    onCheckedChange={(checked) => 
                      setNotificationForm(prev => ({ ...prev, weeklyDigest: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </EnhancedCard>

          {/* Language & Region */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Languages className="w-5 h-5 text-sage-600" />
                Language & Region
              </h2>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">Timezone</Label>
                  <Select defaultValue="pst">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pst">Pacific Standard Time</SelectItem>
                      <SelectItem value="mst">Mountain Standard Time</SelectItem>
                      <SelectItem value="cst">Central Standard Time</SelectItem>
                      <SelectItem value="est">Eastern Standard Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </EnhancedCard>

          {/* Data Management */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Database className="w-5 h-5 text-sage-600" />
                Data Management
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Export My Data</p>
                    <p className="text-sm text-gray-600">Download all your stories and data</p>
                  </div>
                  <EnhancedButton variant="secondary">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </EnhancedButton>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Data Privacy</p>
                    <p className="text-sm text-gray-600">Control how your data is used</p>
                  </div>
                  <ModernSwitch defaultChecked />
                </div>
              </div>
            </div>
          </EnhancedCard>

          {/* Account Management */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Key className="w-5 h-5 text-sage-600" />
                Account Management
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Change Password</p>
                    <p className="text-sm text-gray-600">Update your account password</p>
                  </div>
                  <EnhancedButton variant="secondary">
                    <Lock className="w-4 h-4 mr-2" />
                    Change
                  </EnhancedButton>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-600">Add extra security to your account</p>
                  </div>
                  <EnhancedButton variant="secondary">
                    <Fingerprint className="w-4 h-4 mr-2" />
                    Setup
                  </EnhancedButton>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Connected Devices</p>
                    <p className="text-sm text-gray-600">Manage your logged-in devices</p>
                  </div>
                  <EnhancedButton variant="secondary">
                    <Monitor className="w-4 h-4 mr-2" />
                    Manage
                  </EnhancedButton>
                </div>
              </div>
            </div>
          </EnhancedCard>

          {/* Danger Zone */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-red-600 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </h2>
              
              <div className="space-y-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900 mb-1">Delete Account</h3>
                      <p className="text-sm text-red-700 mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <EnhancedButton variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </EnhancedButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </EnhancedCard>
        </div>
      </div>
    </div>
  )
}