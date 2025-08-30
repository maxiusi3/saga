'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { subscriptionService, ProjectSubscription, SubscriptionStatus } from '@/services/subscription.service'

interface SubscriptionStatusProps {
  projectId?: string
  showDetails?: boolean
  className?: string
}

export function SubscriptionStatusCard({ projectId, showDetails = false, className = '' }: SubscriptionStatusProps) {
  const [subscription, setSubscription] = useState<ProjectSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      loadProjectSubscription()
    }
  }, [projectId])

  const loadProjectSubscription = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const sub = await subscriptionService.getProjectSubscription(projectId)
      setSubscription(sub)
    } catch (error) {
      console.error('Failed to load subscription:', error)
      setError('Failed to load subscription status')
    } finally {
      setLoading(false)
    }
  }

  const handleRenewSubscription = async () => {
    if (!projectId || !subscription) return

    try {
      // This would typically open a payment flow
      console.log('Renewing subscription for project:', projectId)
      // await subscriptionService.renewProjectSubscription(projectId, 'default-plan')
      // loadProjectSubscription() // Reload after renewal
    } catch (error) {
      console.error('Failed to renew subscription:', error)
    }
  }

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </Card>
    )
  }

  if (error || !subscription) {
    return (
      <Card className={`p-4 border-red-200 bg-red-50 ${className}`}>
        <p className="text-sm text-red-800">{error || 'Subscription information unavailable'}</p>
      </Card>
    )
  }

  const daysUntilExpiration = subscriptionService.getDaysUntilExpiration(subscription.endDate)
  const statusColor = subscriptionService.getSubscriptionStatusColor(subscription)
  const shouldRenew = subscriptionService.shouldRecommendRenewal(subscription)

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-medium text-gray-900">订阅状态</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
              {subscriptionService.formatSubscriptionStatus(subscription)}
            </span>
          </div>

          {subscription.status === 'active' && (
            <div className="text-sm text-gray-600 space-y-1">
              {subscription.mode === 'interactive' ? (
                <>
                  <p>交互模式有效期至: {new Date(subscription.endDate).toLocaleDateString()}</p>
                  {daysUntilExpiration > 0 ? (
                    <p>剩余 {daysUntilExpiration} 天</p>
                  ) : (
                    <p className="text-orange-600 font-medium">即将到期</p>
                  )}
                </>
              ) : (
                <p>项目处于归档模式 - 可查看和导出，但无法添加新内容</p>
              )}
            </div>
          )}

          {subscription.status === 'expired' && (
            <p className="text-sm text-red-600">
              订阅已于 {new Date(subscription.endDate).toLocaleDateString()} 过期
            </p>
          )}

          {showDetails && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">已创建故事:</span>
                  <span className="ml-2 font-medium">{subscription.usage.storiesCreated}</span>
                </div>
                <div>
                  <span className="text-gray-500">邀请成员:</span>
                  <span className="ml-2 font-medium">{subscription.usage.membersInvited}</span>
                </div>
                <div>
                  <span className="text-gray-500">总时长:</span>
                  <span className="ml-2 font-medium">
                    {Math.round(subscription.usage.totalDuration / 60)} 分钟
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">最后活动:</span>
                  <span className="ml-2 font-medium">
                    {subscription.usage.lastActivity 
                      ? new Date(subscription.usage.lastActivity).toLocaleDateString()
                      : '无'
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {shouldRenew && (
          <Button
            onClick={handleRenewSubscription}
            size="sm"
            className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            续订
          </Button>
        )}
      </div>

      {/* Feature Availability */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">当前可用功能</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className={`flex items-center space-x-2 ${subscription.features.canCreateStories ? 'text-green-600' : 'text-gray-400'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={subscription.features.canCreateStories ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              <span>创建新故事</span>
            </div>
            <div className={`flex items-center space-x-2 ${subscription.features.canInviteMembers ? 'text-green-600' : 'text-gray-400'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={subscription.features.canInviteMembers ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              <span>邀请成员</span>
            </div>
            <div className={`flex items-center space-x-2 ${subscription.features.canReceivePrompts ? 'text-green-600' : 'text-gray-400'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={subscription.features.canReceivePrompts ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              <span>AI引导提示</span>
            </div>
            <div className={`flex items-center space-x-2 ${subscription.features.canExportData ? 'text-green-600' : 'text-gray-400'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={subscription.features.canExportData ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              <span>数据导出</span>
            </div>
          </div>
        </div>
      )}

      {/* Archival Mode Info */}
      {subscription.mode === 'archival' && showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 mb-2">归档模式功能</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              {subscriptionService.getArchivalModeFeatures().map((feature, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Renewal Recommendation */}
      {shouldRenew && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800 mb-1">建议续订</h4>
                <p className="text-sm text-yellow-700 mb-3">
                  您的交互模式即将到期。续订以继续创建新故事和接收AI提示。
                </p>
                <Button
                  onClick={handleRenewSubscription}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  立即续订
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// Overall subscription status for dashboard
export function OverallSubscriptionStatus({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscriptionStatus()
  }, [])

  const loadSubscriptionStatus = async () => {
    try {
      const subscriptionStatus = await subscriptionService.getSubscriptionStatus()
      setStatus(subscriptionStatus)
    } catch (error) {
      console.error('Failed to load subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !status) {
    return null
  }

  if (!status.hasActiveSubscription) {
    return (
      <Card className={`p-4 border-yellow-200 bg-yellow-50 ${className}`}>
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-medium text-yellow-800">需要订阅</h3>
            <p className="text-sm text-yellow-700">购买Saga包以开始创建家庭故事项目</p>
          </div>
          <Button className="bg-yellow-600 hover:bg-yellow-700 text-white">
            查看套餐
          </Button>
        </div>
      </Card>
    )
  }

  if (status.expiringProjects.length > 0) {
    return (
      <Card className={`p-4 border-orange-200 bg-orange-50 ${className}`}>
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-medium text-orange-800">项目即将到期</h3>
            <p className="text-sm text-orange-700">
              {status.expiringProjects.length} 个项目的交互模式即将到期
            </p>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            查看详情
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-4 border-green-200 bg-green-50 ${className}`}>
      <div className="flex items-center space-x-3">
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div className="flex-1">
          <h3 className="font-medium text-green-800">订阅正常</h3>
          <p className="text-sm text-green-700">
            {status.activeProjects} 个活跃项目，{status.archivedProjects} 个归档项目
          </p>
        </div>
      </div>
    </Card>
  )
}
