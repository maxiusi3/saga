import React from 'react'
import { Check, Trash2, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Badge } from '@/components/ui/badge'
import {
  SagaNotification,
  getNotificationDisplayInfo,
  formatNotificationTime
} from '@saga/shared'
import { useNotifications } from '@/hooks/useNotifications'

interface NotificationItemProps {
  notification: SagaNotification
  onClick?: () => void
  showActions?: boolean
}

export function NotificationItem({ 
  notification, 
  onClick, 
  showActions = true 
}: NotificationItemProps) {
  const { markAsRead, deleteNotification } = useNotifications()
  const displayInfo = getNotificationDisplayInfo(notification.notification_type)

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await markAsRead(notification.id)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteNotification(notification.id)
  }

  const handleClick = () => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    onClick?.()
  }

  return (
    <div
      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
        !notification.is_read ? 'bg-primary/5 border-l-2 border-l-primary' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar or Icon */}
        <div className="flex-shrink-0">
          {notification.sender_avatar ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={notification.sender_avatar} />
              <AvatarFallback>
                {notification.sender_name?.charAt(0) || displayInfo.icon}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className={`h-8 w-8 rounded-full ${displayInfo.bgColor} flex items-center justify-center`}>
              <span className="text-sm">{displayInfo.icon}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'} text-foreground`}>
                {notification.title}
              </p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {notification.message}
              </p>
              
              {notification.preview_text && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                  "{notification.preview_text}"
                </p>
              )}

              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className={`text-xs ${displayInfo.color}`}>
                  {displayInfo.label}
                </Badge>
                
                {notification.project_title && (
                  <span className="text-xs text-muted-foreground">
                    in {notification.project_title}
                  </span>
                )}
                
                <span className="text-xs text-muted-foreground/80">
                  {formatNotificationTime(notification.created_at)}
                </span>
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex items-center space-x-1 ml-2">
                {!notification.is_read && (
                  <FurbridgeButton
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAsRead}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Mark as read"
                  >
                    <Check className="h-3 w-3" />
                  </FurbridgeButton>
                )}
                
                <FurbridgeButton
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                  title="Delete notification"
                >
                  <Trash2 className="h-3 w-3" />
                </FurbridgeButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
      )}
    </div>
  )
}
