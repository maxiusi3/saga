'use client'

import { useState } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCheck, Search, Filter, Trash2, Settings } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { getNotificationDisplayInfo, SagaNotificationType } from '@saga/shared'
import Link from 'next/link'

export default function NotificationsPage() {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markAllAsRead,
    refresh 
  } = useNotifications()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | SagaNotificationType>('all')

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = searchQuery === '' || 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.project_title?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterType === 'all' || notification.notification_type === filterType
    
    return matchesSearch && matchesFilter
  })

  const handleNotificationClick = (actionUrl?: string) => {
    if (actionUrl) {
      window.location.href = actionUrl
    }
  }

  const notificationTypes: { value: 'all' | SagaNotificationType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'new_story', label: 'New Stories' },
    { value: 'new_comment', label: 'Comments' },
    { value: 'new_follow_up_question', label: 'Questions' },
    { value: 'story_response', label: 'Activity' },
    { value: 'project_invitation', label: 'Invitations' },
    { value: 'member_joined', label: 'New Members' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <div className="flex items-center space-x-2 mt-2">
            {unreadCount > 0 && (
              <Badge className="bg-furbridge-orange text-white">
                {unreadCount} unread
              </Badge>
            )}
            <span className="text-sm text-gray-500">
              {notifications.length} total notifications
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <FurbridgeButton
              variant="outline"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </FurbridgeButton>
          )}
          
          <Link href="/dashboard/settings/notifications">
            <FurbridgeButton variant="ghost">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </FurbridgeButton>
          </Link>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {notificationTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setFilterType(type.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filterType === type.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {error ? (
        <FurbridgeCard className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <p className="font-medium">Failed to load notifications</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
          <FurbridgeButton onClick={refresh} variant="outline">
            Try Again
          </FurbridgeButton>
        </FurbridgeCard>
      ) : filteredNotifications.length === 0 ? (
        <FurbridgeCard className="p-8 text-center">
          {searchQuery || filterType !== 'all' ? (
            <>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching notifications</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search or filter criteria
              </p>
              <FurbridgeButton 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('')
                  setFilterType('all')
                }}
              >
                Clear filters
              </FurbridgeButton>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
              <p className="text-gray-600">
                You'll see notifications here when there's activity in your projects
              </p>
            </>
          )}
        </FurbridgeCard>
      ) : (
        <FurbridgeCard className="divide-y">
          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification.action_url)}
              showActions={true}
            />
          ))}
        </FurbridgeCard>
      )}

      {/* Load More */}
      {notifications.length >= 50 && (
        <div className="text-center">
          <FurbridgeButton variant="outline" onClick={refresh}>
            Load More
          </FurbridgeButton>
        </div>
      )}
    </div>
  )
}
