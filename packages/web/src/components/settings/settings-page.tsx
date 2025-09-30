'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { 
  User,
  Bell,
  Shield,
  Eye,
  CreditCard,
  Users,
  Settings,
  Search,
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
  AlertTriangle
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
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('account')
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

  const settingsSections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'projects', label: 'Projects', icon: Users },
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ]

  const filteredSections = settingsSections.filter(section =>
    section.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-display text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account, preferences, and privacy settings
          </p>
        </div>
        
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <Card variant="content">
            <CardContent className="p-4">
              <nav className="space-y-2">
                {filteredSections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveTab(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        activeTab === section.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{section.label}</span>
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Account Settings */}
            <TabsContent value="account" className="space-y-6">
              <Card variant="content">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <Avatar size="xl">
                      <AvatarImage src={profileForm.avatar} />
                      <AvatarFallback className="text-lg">
                        {profileForm.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button variant="secondary" size="sm">
                        <Camera className="w-4 h-4 mr-1" />
                        Change Photo
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG or GIF. Max size 2MB.
                      </p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileForm.phone || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileForm.bio || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell your family a bit about yourself..."
                      rows={3}
                    />
                  </div>

                  <Button variant="primary" onClick={handleSaveProfile} disabled={isLoading}>
                    <Save className="w-4 h-4 mr-1" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card variant="content">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Email Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationForm.emailNotifications}
                        onCheckedChange={(checked) => 
                          setNotificationForm(prev => ({ ...prev, emailNotifications: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Push Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive push notifications on your devices</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationForm.pushNotifications}
                        onCheckedChange={(checked) => 
                          setNotificationForm(prev => ({ ...prev, pushNotifications: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Story Updates</p>
                          <p className="text-sm text-muted-foreground">Get notified when new stories are shared</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationForm.storyUpdates}
                        onCheckedChange={(checked) => 
                          setNotificationForm(prev => ({ ...prev, storyUpdates: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Follow-up Questions</p>
                          <p className="text-sm text-muted-foreground">Get notified about new follow-up questions</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationForm.followUpQuestions}
                        onCheckedChange={(checked) => 
                          setNotificationForm(prev => ({ ...prev, followUpQuestions: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Weekly Digest</p>
                          <p className="text-sm text-muted-foreground">Receive a weekly summary of family activity</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationForm.weeklyDigest}
                        onCheckedChange={(checked) => 
                          setNotificationForm(prev => ({ ...prev, weeklyDigest: checked }))
                        }
                      />
                    </div>
                  </div>

                  <Button variant="primary" onClick={handleSaveNotifications} disabled={isLoading}>
                    <Save className="w-4 h-4 mr-1" />
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Accessibility Settings */}
            <TabsContent value="accessibility" className="space-y-6">
              <Card variant="content">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Accessibility className="w-5 h-5" />
                    Accessibility Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="fontSize">Font Size</Label>
                      <Select
                        value={accessibilityForm.fontSize}
                        onValueChange={(value: any) => 
                          setAccessibilityForm(prev => ({ ...prev, fontSize: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                          <SelectItem value="extra-large">Extra Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Palette className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">High Contrast Mode</p>
                          <p className="text-sm text-muted-foreground">Increase contrast for better readability</p>
                        </div>
                      </div>
                      <Switch
                        checked={accessibilityForm.highContrast}
                        onCheckedChange={(checked) => 
                          setAccessibilityForm(prev => ({ ...prev, highContrast: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Reduced Motion</p>
                          <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
                        </div>
                      </div>
                      <Switch
                        checked={accessibilityForm.reducedMotion}
                        onCheckedChange={(checked) => 
                          setAccessibilityForm(prev => ({ ...prev, reducedMotion: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Screen Reader Support</p>
                          <p className="text-sm text-muted-foreground">Optimize for screen reader compatibility</p>
                        </div>
                      </div>
                      <Switch
                        checked={accessibilityForm.screenReader}
                        onCheckedChange={(checked) => 
                          setAccessibilityForm(prev => ({ ...prev, screenReader: checked }))
                        }
                      />
                    </div>
                  </div>

                  <Button variant="primary" onClick={handleSaveAccessibility} disabled={isLoading}>
                    <Save className="w-4 h-4 mr-1" />
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Project Settings */}
            <TabsContent value="projects" className="space-y-6">
              <Card variant="content">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Project Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Manage your project settings, member permissions, and archival options.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary">
                      <Users className="w-4 h-4 mr-1" />
                      Manage Members
                    </Button>
                    <Button variant="secondary">
                      <Download className="w-4 h-4 mr-1" />
                      Export Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing Settings */}
            <TabsContent value="billing" className="space-y-6">
              <Card variant="content">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Billing & Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">Current Plan</span>
                      <Badge variant="primary">Family Saga Package</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Active until December 2024
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Button variant="secondary">
                      <CreditCard className="w-4 h-4 mr-1" />
                      Update Payment Method
                    </Button>
                    <Button variant="secondary">
                      <Download className="w-4 h-4 mr-1" />
                      Download Invoices
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Settings */}
            <TabsContent value="privacy" className="space-y-6">
              <Card variant="content">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Privacy & Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Data Management</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Control how your data is used and stored.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="secondary">
                          <Download className="w-4 h-4 mr-1" />
                          Export My Data
                        </Button>
                        <Button variant="destructive-outline">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete Account
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-warning">
                            Account Deletion
                          </p>
                          <p className="text-xs text-warning/80 mt-1">
                            Deleting your account will permanently remove all your stories, 
                            comments, and project data. This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}