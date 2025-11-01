import React from 'react'
import { Check, CheckCheck, Settings, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from './NotificationItem'
import Link from 'next/link'
import { sagaDropdownPanel, sagaDropdownItem, sagaDropdownSeparator } from '@/components/shared/dropdown-styles'
import { useLocale, useTranslations } from 'next-intl'

interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const locale = useLocale()
  const t = useTranslations('common.notifications')
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
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
      window.location.href = withLocale(actionUrl)
    }
    onClose()
  }

  return (
    <div className={`${sagaDropdownPanel} w-96 max-h-96`}>
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-muted/30 rounded-t-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-foreground">{t('title')}</h3>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs animate-pulse">
                {unreadCount} {t('new')}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs hover:bg-primary/10 hover:text-primary"
                title={t('markAllAsRead')}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                {t('markAllRead')}
              </Button>
            )}

            <Link href={withLocale('/dashboard/settings/notifications')}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="hover:bg-muted"
                title={t('notificationSettings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
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
            <p className="text-sm">{t('failedToLoad')}</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-sm font-medium">{t('noNotifications')}</p>
            <p className="text-xs mt-1">
              {t('noNotificationsDesc')}
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
        <div className="p-3 border-t border-border/50 bg-muted/30">
          <Link href={withLocale('/dashboard/notifications')}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary hover:bg-primary/10"
              onClick={onClose}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {t('viewAll')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
