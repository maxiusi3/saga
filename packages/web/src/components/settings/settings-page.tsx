'use client'

import React, { useState, useEffect } from 'react'
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
import { settingsService, UserProfile, NotificationSettings, AccessibilitySettings } from '@/services/settings-service'
import { toast } from 'react-hot-toast'
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
  Monitor,
  Type
} from 'lucide-react'

interface SettingsPageProps {
  // Props are now optional since we'll load from API
  userProfile?: UserProfile
  notificationSettings?: NotificationSettings
  accessibilitySettings?: AccessibilitySettings
}

export function SettingsPage({
  userProfile: initialProfile,
  notificationSettings: initialNotifications,
  accessibilitySettings: initialAccessibility
}: SettingsPageProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  
  // Form states
  const [profileForm, setProfileForm] = useState<UserProfile | null>(initialProfile || null)
  const [notificationForm, setNotificationForm] = useState<NotificationSettings | null>(initialNotifications || null)
  const [accessibilityForm, setAccessibilityForm] = useState<AccessibilitySettings | null>(initialAccessibility || null)

  // Load settings from API on component mount
  useEffect(() => {
    loadAllSettings()
  }, [])

  const loadAllSettings = async () => {
    setIsInitialLoading(true)
    try {
      const [profile, notifications, accessibility] = await Promise.all([
        settingsService.getUserProfile().catch((err) => {
          console.error('Failed to load profile:', err)
          return {
            id: '',
            name: '',
            email: '',
            phone: '',
            avatar: '',
            bio: ''
          }
        }),
        settingsService.getNotificationSettings().catch((err) => {
          console.error('Failed to load notifications:', err)
          return {
            emailNotifications: true,
            pushNotifications: true,
            storyUpdates: true,
            followUpQuestions: true,
            weeklyDigest: false,
            marketingEmails: false
          }
        }),
        settingsService.getAccessibilitySettings().catch((err) => {
          console.error('Failed to load accessibility:', err)
          return {
            fontSize: 'standard' as const,
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        })
      ])
      
      setProfileForm(profile)
      setNotificationForm(notifications)
      setAccessibilityForm(accessibility)
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings. Using default values.')
      // Set default values
      setProfileForm({ id: '', name: '', email: '', phone: '', avatar: '', bio: '' })
      setNotificationForm({ 
        emailNotifications: true, 
        pushNotifications: true, 
        storyUpdates: true,
        followUpQuestions: true,
        weeklyDigest: false,
        marketingEmails: false
      })
      setAccessibilityForm({ fontSize: 'standard', highContrast: false, reducedMotion: false, screenReader: false })
    } finally {
      setIsInitialLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!profileForm) return
    
    setIsLoading(true)
    try {
      const updated = await settingsService.updateUserProfile(profileForm)
      setProfileForm(updated)
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    if (!notificationForm) return
    
    setIsLoading(true)
    try {
      const updated = await settingsService.updateNotificationSettings(notificationForm)
      setNotificationForm(updated)
      toast.success('Notification settings updated successfully')
    } catch (error) {
      console.error('Failed to update notifications:', error)
      toast.error('Failed to update notification settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveAccessibility = async () => {
    if (!accessibilityForm) return
    
    setIsLoading(true)
    try {
      const updated = await settingsService.updateAccessibilitySettings(accessibilityForm)
      setAccessibilityForm(updated)
      toast.success('Accessibility settings updated successfully')
    } catch (error) {
      console.error('Failed to update accessibility settings:', error)
      toast.error('Failed to update accessibility settings')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state while initial data loads
  if (isInitialLoading || !profileForm || !notificationForm || !accessibilityForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Loading your preferences...</p>
          </div>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <EnhancedCard key={i}>
                <div className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </EnhancedCard>
            ))}
          </div>
        </div>
      </div>
    )
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
                    <AvatarImage src={profileForm?.avatar} />
                    <AvatarFallback className="text-xl bg-sage-100 text-sage-700">
                      {profileForm?.name?.charAt(0) || 'U'}
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
                      value={profileForm?.name || ''}
                      onChange={(e) => setProfileForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm?.email || ''}
                      onChange={(e) => setProfileForm(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileForm?.phone || ''}
                      onChange={(e) => setProfileForm(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
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

          {/* Quick Access */}
          <EnhancedCard>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-sage-600" />
                Quick Access
              </h2>
              
              <div className="space-y-6">
                <p className="text-sm text-gray-600 mb-4">
                  Quickly adjust accessibility and display settings for better usability.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-sage-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Palette className="w-5 h-5 text-sage-600" />
                      <div>
                        <p className="font-medium text-gray-900">High Contrast</p>
                        <p className="text-sm text-gray-600">Improve text visibility</p>
                      </div>
                    </div>
                    <ModernSwitch 
                      checked={accessibilityForm?.highContrast || false}
                      onCheckedChange={(checked) => 
                        setAccessibilityForm(prev => prev ? ({ ...prev, highContrast: checked }) : null)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-sage-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Eye className="w-5 h-5 text-sage-600" />
                      <div>
                        <p className="font-medium text-gray-900">Reduced Motion</p>
                        <p className="text-sm text-gray-600">Minimize animations</p>
                      </div>
                    </div>
                    <ModernSwitch 
                      checked={accessibilityForm?.reducedMotion || false}
                      onCheckedChange={(checked) => 
                        setAccessibilityForm(prev => prev ? ({ ...prev, reducedMotion: checked }) : null)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-sage-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-5 h-5 text-sage-600" />
                      <div>
                        <p className="font-medium text-gray-900">Screen Reader</p>
                        <p className="text-sm text-gray-600">Enhanced screen reader support</p>
                      </div>
                    </div>
                    <ModernSwitch 
                      checked={accessibilityForm?.screenReader || false}
                      onCheckedChange={(checked) => 
                        setAccessibilityForm(prev => prev ? ({ ...prev, screenReader: checked }) : null)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-sage-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Type className="w-5 h-5 text-sage-600" />
                      <div>
                        <p className="font-medium text-gray-900">Font Size</p>
                        <p className="text-sm text-gray-600">Current: {accessibilityForm?.fontSize || 'standard'}</p>
                      </div>
                    </div>
                    <Select 
                      value={accessibilityForm?.fontSize || 'standard'} 
                      onValueChange={(value) => 
                        setAccessibilityForm(prev => prev ? ({ ...prev, fontSize: value as any }) : null)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="extra-large">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <EnhancedButton onClick={handleSaveAccessibility} disabled={isLoading} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Save Quick Access Settings
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
                    checked={notificationForm?.emailNotifications || false}
                    onCheckedChange={(checked) => 
                      setNotificationForm(prev => prev ? ({ ...prev, emailNotifications: checked }) : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Push Notifications</p>
                    <p className="text-sm text-gray-600">Get notified on your devices</p>
                  </div>
                  <ModernSwitch 
                    checked={notificationForm?.pushNotifications || false}
                    onCheckedChange={(checked) => 
                      setNotificationForm(prev => prev ? ({ ...prev, pushNotifications: checked }) : null)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Weekly Digest</p>
                    <p className="text-sm text-gray-600">Weekly summary of family activity</p>
                  </div>
                  <ModernSwitch 
                    checked={notificationForm?.weeklyDigest || false}
                    onCheckedChange={(checked) => 
                      setNotificationForm(prev => prev ? ({ ...prev, weeklyDigest: checked }) : null)
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