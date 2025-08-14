'use client'

import { useState, useEffect } from 'react'
import { MonitoringDashboard } from '@/components/monitoring/monitoring-dashboard'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter } from 'next/navigation'

export default function MonitoringPage() {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/signin')
        return
      }

      // Check if user has admin role
      if (user.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setAuthorized(true)
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Monitor system health, performance, and analytics
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <MonitoringDashboard />
      </div>
    </div>
  )
}