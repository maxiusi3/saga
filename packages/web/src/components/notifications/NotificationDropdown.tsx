import React from 'react'
import { Check, CheckCheck, Settings, Trash2, ExternalLink } from 'lucide-react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from './NotificationItem'
import Link from 'next/link'

interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markAllAsRead 
  } = useNotifications()

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  const handleNotificationClick = (actionUrl?: string) => {
    if (actionUrl) {
      window.location.href = actionUrl
    }
    onClose()
  }

  return (
    <FurbridgeCard className="w-96 max-h-96 overflow-hidden shadow-lg border">
      {/* Header */}
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {unreadCount > 0 && (
              <FurbridgeButton
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </FurbridgeButton>
            )}
            
            <Link href="/dashboard/settings/notifications">
              <FurbridgeButton
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <Settings className="h-4 w-4" />
              </FurbridgeButton>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">
            <p className="text-sm">Failed to load notifications</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs mt-1">
              You'll see notifications here when there's activity in your projects
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.slice(0, 10).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification.action_url)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 10 && (
        <div className="p-3 border-t bg-muted/50">
          <Link href="/dashboard/notifications">
            <FurbridgeButton
              variant="ghost"
              size="sm"
              className="w-full text-primary"
              onClick={onClose}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View all notifications
            </FurbridgeButton>
          </Link>
        </div>
      )}
    </FurbridgeCard>
  )
}
