'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

interface HealthCheck {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  details?: any
  error?: string
}

interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: HealthCheck[]
  summary: {
    healthy: number
    unhealthy: number
    degraded: number
    total: number
  }
}

interface PerformanceMetrics {
  requestCount: number
  averageResponseTime: number
  errorRate: number
  activeConnections: number
  memoryUsage: number
  cpuUsage: number
}

interface BusinessMetrics {
  activeUsers: number
  storiesUploaded: number
  chaptersGenerated: number
  exportsRequested: number
  paymentsProcessed: number
}

interface MetricsData {
  timestamp: string
  performance: PerformanceMetrics
  business: BusinessMetrics
}

export function MonitoringDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealthData = async () => {
    try {
      const [healthResponse, metricsResponse] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/health/metrics')
      ])

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setHealth(healthData)
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(metricsData)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()

    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100'
      case 'unhealthy':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Monitoring Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={fetchHealthData}
                className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-sm text-gray-600">
            Last updated: {new Date(health?.timestamp || Date.now()).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
          </label>
          <button
            onClick={fetchHealthData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* System Status Overview */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.status)}`}>
                {health.status.toUpperCase()}
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              <p className="text-sm text-gray-600">Overall system health</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">{formatUptime(health.uptime)}</div>
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-900">Uptime</h3>
              <p className="text-sm text-gray-600">System running time</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">{health.version}</div>
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-900">Version</h3>
              <p className="text-sm text-gray-600">{health.environment} environment</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">{health.summary.healthy}</div>
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-900">Healthy Services</h3>
              <p className="text-sm text-gray-600">
                {health.summary.unhealthy > 0 && (
                  <span className="text-red-600">{health.summary.unhealthy} unhealthy</span>
                )}
                {health.summary.degraded > 0 && (
                  <span className="text-yellow-600">{health.summary.degraded} degraded</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Requests (5min)</span>
                <span className="text-sm font-medium">{metrics.performance.requestCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Response Time</span>
                <span className="text-sm font-medium">{Math.round(metrics.performance.averageResponseTime)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Error Rate</span>
                <span className={`text-sm font-medium ${metrics.performance.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.performance.errorRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Connections</span>
                <span className="text-sm font-medium">{metrics.performance.activeConnections}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resources</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Memory Usage</span>
                <span className="text-sm font-medium">{formatBytes(metrics.performance.memoryUsage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">CPU Usage</span>
                <span className="text-sm font-medium">{metrics.performance.cpuUsage.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Metrics (24h)</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Users</span>
                <span className="text-sm font-medium">{metrics.business.activeUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Stories Uploaded</span>
                <span className="text-sm font-medium">{metrics.business.storiesUploaded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Chapters Generated</span>
                <span className="text-sm font-medium">{metrics.business.chaptersGenerated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Exports Requested</span>
                <span className="text-sm font-medium">{metrics.business.exportsRequested}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Health Checks */}
      {health && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Service Health Checks</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {health.checks.map((check, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(check.status)}`}>
                      {check.status}
                    </div>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {check.service.replace(/[-_]/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{check.responseTime}ms</span>
                    {check.error && (
                      <span className="text-red-600 truncate max-w-xs" title={check.error}>
                        {check.error}
                      </span>
                    )}
                  </div>
                </div>
                {check.details && (
                  <div className="mt-2 text-xs text-gray-500">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}