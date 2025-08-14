'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

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

interface UseSubscriptionNotificationsReturn {
  notifications: SubscriptionNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSubscriptionNotifications(): UseSubscriptionNotificationsReturn {
  const [notifications, setNotifications] = useState<SubscriptionNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/notifications/subscription');
      
      if (response.data.success) {
        const data = response.data.data.map((notification: any) => ({
          ...notification,
          timestamp: new Date(notification.timestamp),
          metadata: notification.metadata ? {
            ...notification.metadata,
            subscriptionExpiresAt: notification.metadata.subscriptionExpiresAt 
              ? new Date(notification.metadata.subscriptionExpiresAt)
              : undefined
          } : undefined
        }));

        setNotifications(data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch notifications');
      }
    } catch (err: any) {
      console.error('Error fetching subscription notifications:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      
      if (response.data.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, isRead: true }
              : notification
          )
        );
      } else {
        setError(response.data.error?.message || 'Failed to mark notification as read');
      }
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      setError(err.response?.data?.error?.message || 'Failed to mark notification as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await api.patch('/notifications/subscription/read-all');
      
      if (response.data.success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
      } else {
        setError(response.data.error?.message || 'Failed to mark all notifications as read');
      }
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
      setError(err.response?.data?.error?.message || 'Failed to mark all notifications as read');
    }
  }, []);

  const dismiss = useCallback(async (notificationId: string) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      
      if (response.data.success) {
        setNotifications(prev => 
          prev.filter(notification => notification.id !== notificationId)
        );
      } else {
        setError(response.data.error?.message || 'Failed to dismiss notification');
      }
    } catch (err: any) {
      console.error('Error dismissing notification:', err);
      setError(err.response?.data?.error?.message || 'Failed to dismiss notification');
    }
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up real-time updates via WebSocket or polling
  useEffect(() => {
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh: fetchNotifications
  };
}

// Hook for creating subscription notifications (for admin/system use)
export function useCreateSubscriptionNotification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNotification = useCallback(async (
    notificationData: Omit<SubscriptionNotification, 'id' | 'timestamp' | 'isRead'>
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/notifications/subscription', notificationData);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.error?.message || 'Failed to create notification');
        return null;
      }
    } catch (err: any) {
      console.error('Error creating subscription notification:', err);
      setError(err.response?.data?.error?.message || 'Failed to create notification');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createNotification,
    loading,
    error
  };
}

// Utility function to generate notification content based on subscription events
export function generateSubscriptionNotification(
  event: 'expiry_warning' | 'expired' | 'renewed' | 'payment_failed' | 'archival_notice',
  projectName: string,
  projectId: string,
  metadata?: any
): Omit<SubscriptionNotification, 'id' | 'timestamp' | 'isRead'> {
  switch (event) {
    case 'expiry_warning':
      return {
        type: 'expiry_warning',
        title: 'Subscription Expiring Soon',
        message: `Your subscription for "${projectName}" expires in ${metadata?.daysUntilExpiry || 'a few'} days. Renew now to avoid service interruption.`,
        projectId,
        projectName,
        priority: metadata?.daysUntilExpiry <= 3 ? 'high' : 'medium',
        actionText: 'Renew Now',
        actionUrl: `/projects/${projectId}/subscription/renew`,
        metadata
      };

    case 'expired':
      return {
        type: 'expired',
        title: 'Subscription Expired',
        message: `Your subscription for "${projectName}" has expired. The project is now in archival mode with limited functionality.`,
        projectId,
        projectName,
        priority: 'high',
        actionText: 'Reactivate',
        actionUrl: `/projects/${projectId}/subscription/renew`,
        metadata
      };

    case 'renewed':
      return {
        type: 'renewed',
        title: 'Subscription Renewed',
        message: `Great news! Your subscription for "${projectName}" has been successfully renewed. All features are now active.`,
        projectId,
        projectName,
        priority: 'low',
        actionText: 'View Project',
        actionUrl: `/projects/${projectId}`,
        metadata
      };

    case 'payment_failed':
      return {
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `We couldn't process the payment for "${projectName}". Please update your payment method to avoid service interruption.`,
        projectId,
        projectName,
        priority: 'high',
        actionText: 'Update Payment',
        actionUrl: `/projects/${projectId}/subscription/payment`,
        metadata
      };

    case 'archival_notice':
      return {
        type: 'archival_notice',
        title: 'Project Archived',
        message: `"${projectName}" has been moved to archival mode. Your stories are safe, but interactive features are disabled.`,
        projectId,
        projectName,
        priority: 'medium',
        actionText: 'Learn More',
        actionUrl: `/projects/${projectId}/archival`,
        metadata
      };

    default:
      return {
        type: 'archival_notice',
        title: 'Subscription Update',
        message: `There's an update about your subscription for "${projectName}".`,
        projectId,
        projectName,
        priority: 'low',
        metadata
      };
  }
}

export default useSubscriptionNotifications;