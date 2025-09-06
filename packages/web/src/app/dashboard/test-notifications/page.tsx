'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
      <div className="min-h-screen bg-gradient-to-br from-secondary/10 to-primary/10 p-4">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-foreground">Authentication Required</h1>
          <p className="text-muted-foreground mt-2">Please sign in to test notifications.</p>
          <Link href="/auth/signin">
            <Button className="mt-4">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/10 to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notification System Test</h1>
            <p className="text-muted-foreground">Test and verify the notification system functionality</p>
          </div>
        </div>

        {/* User Info */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Testing as:</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">User ID: {user.id}</p>
            </div>
            <Badge className="bg-primary text-primary-foreground">
              <Bell className="h-3 w-3 mr-1" />
              Test Mode
            </Badge>
          </div>
        </Card>

        {/* Project Selection */}
        {projects.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Project Selection</h3>
            <div className="space-y-2">
              <Label htmlFor="project">Select Project for Testing</Label>
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        )}

        {/* Test Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Create Test Notification */}
          <Card>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Create Test Notification</h3>
                  <p className="text-sm text-muted-foreground">Directly inserts a test notification</p>
                </div>
              </div>
              <Button
                onClick={handleCreateTestNotification}
                disabled={loading}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </div>
          </Card>

          {/* Test Story Trigger */}
          <Card>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-success/10 rounded-lg">
                  <Database className="h-6 w-6 text-success" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Test Story Trigger</h3>
                  <p className="text-sm text-muted-foreground">Simulates a new story being created</p>
                </div>
              </div>
              <Button
                onClick={handleTestStoryTrigger}
                disabled={loading || !selectedProjectId}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </div>
          </Card>

          {/* Test Realtime Subscription */}
          <Card>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-warning/10 rounded-lg">
                  <Zap className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Test Realtime Subscription</h3>
                  <p className="text-sm text-muted-foreground">Listens for new notifications in realtime</p>
                </div>
              </div>
              <Button
                onClick={handleTestRealtimeSubscription}
                disabled={loading}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </div>
          </Card>

          {/* Test Database Triggers */}
          <Card>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <Database className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Test Database Triggers</h3>
                  <p className="text-sm text-muted-foreground">Verifies database functions and triggers</p>
                </div>
              </div>
              <Button
                onClick={handleTestDatabaseTriggers}
                disabled={loading}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </div>
          </Card>

          {/* Get Stats */}
          <Card>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Get Notification Stats</h3>
                  <p className="text-sm text-muted-foreground">Fetches statistics about notifications</p>
                </div>
              </div>
              <Button
                onClick={handleGetStats}
                disabled={loading}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </div>
          </Card>

          {/* Check for New Notifications */}
          <Card>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <Bell className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Check for New Notifications</h3>
                  <p className="text-sm text-muted-foreground">Manually triggers the check function</p>
                </div>
              </div>
              <Button
                onClick={handleCheckNotifications}
                disabled={loading}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </div>
          </Card>
        </div>

        {/* Stats Display */}
        {stats && (
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Notification Stats</h3>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                {JSON.stringify(stats, null, 2)}
              </pre>
            </div>
          </Card>
        )}

        {/* Cleanup */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-destructive">Cleanup Test Data</h3>
                <p className="text-sm text-muted-foreground">Removes all test notifications for your user ID</p>
              </div>
              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cleanup
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
