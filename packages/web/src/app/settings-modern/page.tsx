'use client'

import { SettingsPage } from '@/components/settings/settings-page'

// Mock data for the settings page
const mockUserProfile = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1 (555) 123-4567',
  avatar: '/api/placeholder/80/80',
  bio: 'Family storyteller and memory keeper'
}

const mockNotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  storyUpdates: true,
  followUpQuestions: false,
  weeklyDigest: true,
  marketingEmails: false
}

const mockAccessibilitySettings = {
  fontSize: 'standard' as const,
  highContrast: false,
  reducedMotion: false,
  screenReader: false
}

export default function SettingsModernPage() {
  const handleUpdateProfile = async (updates: any) => {
    console.log('Updating profile:', updates)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const handleUpdateNotifications = async (settings: any) => {
    console.log('Updating notifications:', settings)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const handleUpdateAccessibility = async (settings: any) => {
    console.log('Updating accessibility:', settings)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return (
    <SettingsPage
      userProfile={mockUserProfile}
      notificationSettings={mockNotificationSettings}
      accessibilitySettings={mockAccessibilitySettings}
      onUpdateProfile={handleUpdateProfile}
      onUpdateNotifications={handleUpdateNotifications}
      onUpdateAccessibility={handleUpdateAccessibility}
    />
  )
}