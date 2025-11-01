'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCheck, Search, Filter, Trash2, Settings } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { getNotificationDisplayInfo, SagaNotificationType } from '@saga/shared'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

export default function NotificationsPage() {
  const locale = useLocale()
  const t = useTranslations('notifications-page')
  const withLocale = (path: string) => {
    if (!path?.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
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
      const target = actionUrl.startsWith('/') ? withLocale(actionUrl) : actionUrl
      window.location.href = target
    }
  }

  const notificationTypes: { value: 'all' | SagaNotificationType; label: string }[] = [
    { value: 'all', label: t('filter.all') },
    { value: 'new_story', label: t('filter.newStories') },
    { value: 'new_comment', label: t('filter.comments') },
    { value: 'new_follow_up_question', label: t('filter.questions') },
    { value: 'story_response', label: t('filter.activity') },
    { value: 'project_invitation', label: t('filter.invitations') },
    { value: 'member_joined', label: t('filter.newMembers') }
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
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <div className="flex items-center space-x-2 mt-2">
            {unreadCount > 0 && (
              <Badge variant="primary">
                {unreadCount} {t('unread')}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {notifications.length} {t('total')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {t('markAllRead')}
            </Button>
          )}
          
          <Link href={withLocale('/dashboard/settings/notifications')}>
            <Button variant="ghost">
              <Settings className="h-4 w-4 mr-2" />
              {t('settings')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex space-x-1 bg-muted rounded-lg p-1">
            {notificationTypes.map((type) => (
              <Button
                key={type.value}
                variant={filterType === type.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterType(type.value)}
                className="h-auto py-1"
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {error ? (
        <Card className="p-8 text-center">
          <div className="text-destructive mb-4">
            <p className="font-medium">{t('error.failedToLoad')}</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button onClick={refresh} variant="outline">
            {t('error.tryAgain')}
          </Button>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card className="p-8 text-center">
          {searchQuery || filterType !== 'all' ? (
            <>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noMatching')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('empty.noMatchingDesc')}
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('')
                  setFilterType('all')
                }}
              >
                {t('empty.clearFilters')}
              </Button>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noNotifications')}</h3>
              <p className="text-muted-foreground">
                {t('empty.noNotificationsDesc')}
              </p>
            </>
          )}
        </Card>
      ) : (
        <Card className="divide-y">
          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification.action_url)}
              showActions={true}
            />
          ))}
        </Card>
      )}

      {/* Load More */}
      {notifications.length >= 50 && (
        <div className="text-center">
          <Button variant="outline" onClick={refresh}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
