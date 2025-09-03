'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'
import { notificationTester } from '@/lib/test-notifications'
import { projectService } from '@/lib/projects'
import { Bell, TestTube, Database, Zap, BarChart3, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

export default function TestNotificationsPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [realtimeCleanup, setRealtimeCleanup] = useState<(() => void) | null>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    loadProjects()
    return () => {
      // Cleanup realtime subscription on unmount
      if (realtimeCleanup) {
        realtimeCleanup()
      }
    }
  }, [])

  const loadProjects = async () => {
    if (!user?.id) return
    
    try {
      const userProjects = await projectService.getUserProjects(user.id)
      setProjects(userProjects)
      if (userProjects.length > 0) {
        setSelectedProjectId(userProjects[0].id)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('Failed to load projects')
    }
  }

  const handleCreateTestNotification = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      await notificationTester.createTestNotification(user.id)
    } finally {
      setLoading(false)
    }
  }

  const handleTestStoryTrigger = async () => {
    if (!user?.id || !selectedProjectId) {
      toast.error('Please select a project first')
      return
    }
    
    setLoading(true)
    try {
      await notificationTester.testStoryNotificationTrigger(selectedProjectId, user.id)
    } finally {
      setLoading(false)
    }
  }

  const handleTestRealtimeSubscription = async () => {
    if (!user?.id) return
    
    try {
      // Clean up existing subscription
      if (realtimeCleanup) {
        realtimeCleanup()
      }
      
      const cleanup = await notificationTester.testRealtimeSubscription(user.id)
      setRealtimeCleanup(() => cleanup)
    } catch (error) {
      console.error('Error setting up realtime subscription:', error)
      toast.error('Failed to setup realtime subscription')
    }
  }

  const handleTestDatabaseTriggers = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      await notificationTester.testDatabaseTriggers(user.id)
    } finally {
      setLoading(false)
    }
  }

  const handleGetStats = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const notificationStats = await notificationTester.getNotificationStats(user.id)
      setStats(notificationStats)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckNotifications = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      await notificationTester.checkForNewNotifications(user.id)
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      await notificationTester.cleanupTestNotifications(user.id)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">Authentication Required</h1>
          <p className="text-gray-600 mt-2">Please sign in to test notifications.</p>
          <Link href="/auth/signin">
            <FurbridgeButton className="mt-4">
              Sign In
            </FurbridgeButton>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <FurbridgeButton variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </FurbridgeButton>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notification System Test</h1>
            <p className="text-gray-600">Test and verify the notification system functionality</p>
          </div>
        </div>

        {/* User Info */}
        <FurbridgeCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Testing as:</h3>
              <p className="text-sm text-gray-600">{user.email}</p>
              <p className="text-xs text-gray-500">User ID: {user.id}</p>
            </div>
            <Badge className="bg-furbridge-teal text-white">
              <Bell className="h-3 w-3 mr-1" />
              Test Mode
            </Badge>
          </div>
        </FurbridgeCard>

        {/* Project Selection */}
        {projects.length > 0 && (
          <FurbridgeCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Selection</h3>
            <div className="space-y-2">
              <Label htmlFor="project">Select Project for Testing</Label>
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-furbridge-teal"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          </FurbridgeCard>
        )}

        {/* Test Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Tests */}
          <FurbridgeCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TestTube className="h-5 w-5 mr-2 text-furbridge-teal" />
              Basic Tests
            </h3>
            <div className="space-y-3">
              <FurbridgeButton
                onClick={handleCreateTestNotification}
                disabled={loading}
                className="w-full"
              >
                Create Test Notification
              </FurbridgeButton>
              
              <FurbridgeButton
                onClick={handleCheckNotifications}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Check Recent Notifications
              </FurbridgeButton>
            </div>
          </FurbridgeCard>

          {/* Database Tests */}
          <FurbridgeCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="h-5 w-5 mr-2 text-furbridge-orange" />
              Database Tests
            </h3>
            <div className="space-y-3">
              <FurbridgeButton
                onClick={handleTestStoryTrigger}
                disabled={loading || !selectedProjectId}
                className="w-full"
              >
                Test Story Notification Trigger
              </FurbridgeButton>
              
              <FurbridgeButton
                onClick={handleTestDatabaseTriggers}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Test Database Triggers
              </FurbridgeButton>
            </div>
          </FurbridgeCard>

          {/* Real-time Tests */}
          <FurbridgeCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Zap className="h-5 w-5 mr-2 text-furbridge-warm-gray" />
              Real-time Tests
            </h3>
            <div className="space-y-3">
              <FurbridgeButton
                onClick={handleTestRealtimeSubscription}
                disabled={loading}
                className="w-full"
              >
                {realtimeCleanup ? 'Restart' : 'Enable'} Real-time Subscription
              </FurbridgeButton>
              
              {realtimeCleanup && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  ✅ Real-time subscription active
                </div>
              )}
            </div>
          </FurbridgeCard>

          {/* Statistics */}
          <FurbridgeCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-furbridge-teal" />
              Statistics
            </h3>
            <div className="space-y-3">
              <FurbridgeButton
                onClick={handleGetStats}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Get Notification Stats
              </FurbridgeButton>
              
              {stats && (
                <div className="text-sm bg-gray-50 p-3 rounded">
                  <div>Total: {stats.total}</div>
                  <div>Unread: {stats.unread}</div>
                  <div>Types: {Object.keys(stats.byType).join(', ')}</div>
                </div>
              )}
            </div>
          </FurbridgeCard>
        </div>

        {/* Cleanup */}
        <FurbridgeCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Trash2 className="h-5 w-5 mr-2 text-red-500" />
            Cleanup
          </h3>
          <FurbridgeButton
            onClick={handleCleanup}
            disabled={loading}
            variant="outline"
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          >
            Clean Up Test Notifications
          </FurbridgeButton>
        </FurbridgeCard>

        {/* Instructions */}
        <FurbridgeCard className="p-6 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Testing Instructions</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>1. <strong>Enable Real-time Subscription</strong> first to see notifications as they arrive</p>
            <p>2. <strong>Create Test Notification</strong> to verify basic notification creation</p>
            <p>3. <strong>Test Story Trigger</strong> to verify database triggers are working</p>
            <p>4. <strong>Check Recent Notifications</strong> to see what was created</p>
            <p>5. <strong>Get Stats</strong> to see notification counts and types</p>
            <p>6. <strong>Clean Up</strong> when done testing</p>
          </div>
        </FurbridgeCard>
      </div>
    </div>
  )
}
