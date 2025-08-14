'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, Clock, AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

export interface SubscriptionNotification {
  id: string;
  type: 'expiry_warning' | 'expired' | 'renewed' | 'payment_failed' | 'archival_notice';
  title: string;
  message: string;
  projectId: string;
  projectName: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
  actionText?: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: {
    daysUntilExpiry?: number;
    subscriptionExpiresAt?: Date;
    renewalUrl?: string;
  };
}

interface SubscriptionNotificationsProps {
  notifications: SubscriptionNotification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDismiss?: (notificationId: string) => void;
  onAction?: (notification: SubscriptionNotification) => void;
  maxVisible?: number;
  className?: string;
}

export function SubscriptionNotifications({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onAction,
  maxVisible = 5,
  className = ''
}: SubscriptionNotificationsProps) {
  const [visibleNotifications, setVisibleNotifications] = useState<SubscriptionNotification[]>([]);

  useEffect(() => {
    // Sort by priority and timestamp, show unread first
    const sorted = [...notifications]
      .sort((a, b) => {
        // Unread first
        if (a.isRead !== b.isRead) {
          return a.isRead ? 1 : -1;
        }
        // Then by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        // Then by timestamp (newest first)
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, maxVisible);

    setVisibleNotifications(sorted);
  }, [notifications, maxVisible]);

  const getNotificationConfig = (type: SubscriptionNotification['type']) => {
    switch (type) {
      case 'expiry_warning':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'expired':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'renewed':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'payment_failed':
        return {
          icon: CreditCard,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'archival_notice':
        return {
          icon: Bell,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      default:
        return {
          icon: Bell,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notification: SubscriptionNotification) => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  const handleAction = (notification: SubscriptionNotification) => {
    onAction?.(notification);
  };

  const handleDismiss = (notification: SubscriptionNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(notification.id);
  };

  if (visibleNotifications.length === 0) {
    return (
      <Card className={`p-6 text-center ${className}`}>
        <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">No subscription notifications</p>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Subscription Notifications
        </h3>
        {notifications.some(n => !n.isRead) && onMarkAllAsRead && (
          <Button
            onClick={onMarkAllAsRead}
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-700"
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {visibleNotifications.map((notification) => {
          const config = getNotificationConfig(notification.type);
          const Icon = config.icon;

          return (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                !notification.isRead ? 'ring-2 ring-blue-200' : ''
              } ${config.bgColor} ${config.borderColor} border`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className={`text-sm font-medium ${config.color}`}>
                            {notification.title}
                          </h4>
                          {!notification.isRead && (
                            <Badge variant="secondary" className="text-xs">
                              New
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {notification.priority}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>{notification.projectName}</span>
                            <span>•</span>
                            <span>{formatTimeAgo(notification.timestamp)}</span>
                          </div>
                          
                          {notification.metadata?.daysUntilExpiry !== undefined && (
                            <span className="text-xs font-medium text-yellow-600">
                              {notification.metadata.daysUntilExpiry} days left
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {notification.actionText && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(notification);
                            }}
                            size="sm"
                            variant={notification.priority === 'high' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {notification.actionText}
                          </Button>
                        )}
                        
                        {onDismiss && (
                          <Button
                            onClick={(e) => handleDismiss(notification, e)}
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Show more link if there are more notifications */}
      {notifications.length > maxVisible && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="text-blue-600">
            View all {notifications.length} notifications
          </Button>
        </div>
      )}
    </div>
  );
}

// Notification Bell Icon with Badge
export function NotificationBell({
  unreadCount,
  onClick,
  className = ''
}: {
  unreadCount: number;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-2 text-gray-600 hover:text-gray-900 transition-colors ${className}`}
    >
      <Bell className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default SubscriptionNotifications;