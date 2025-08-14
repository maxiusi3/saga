'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface SubscriptionData {
  id: string;
  projectId: string;
  status: 'active' | 'expired' | 'expiring_soon' | 'cancelled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  daysUntilExpiry?: number;
  isArchived: boolean;
  canRenew: boolean;
  packageName: string;
  packagePrice: number;
  features: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
    interactiveService: boolean;
    archivalAccess: boolean;
    dataExport: boolean;
  };
  usage: {
    projectsCreated: number;
    facilitatorsInvited: number;
    storytellersInvited: number;
    storiesRecorded: number;
    interactionsCreated: number;
  };
  nextBillingDate?: Date;
  paymentMethod?: {
    type: 'card' | 'apple_pay' | 'google_pay';
    last4?: string;
    brand?: string;
  };
}

interface UseSubscriptionOptions {
  projectId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  renewSubscription: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  updatePaymentMethod: (paymentMethodId: string) => Promise<void>;
}

export function useSubscription(options: UseSubscriptionOptions = {}): UseSubscriptionReturn {
  const { projectId, autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await api.get(`/projects/${projectId}/subscription`);
      
      if (response.data.success) {
        const data = response.data.data;
        
        // Transform dates from strings to Date objects
        const transformedData: SubscriptionData = {
          ...data,
          currentPeriodStart: new Date(data.currentPeriodStart),
          currentPeriodEnd: new Date(data.currentPeriodEnd),
          nextBillingDate: data.nextBillingDate ? new Date(data.nextBillingDate) : undefined,
        };

        // Calculate days until expiry
        const now = new Date();
        const expiryDate = transformedData.currentPeriodEnd;
        const timeDiff = expiryDate.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        transformedData.daysUntilExpiry = daysDiff;
        
        // Determine status based on expiry
        if (daysDiff <= 0) {
          transformedData.status = 'expired';
        } else if (daysDiff <= 7) {
          transformedData.status = 'expiring_soon';
        } else if (transformedData.status !== 'cancelled') {
          transformedData.status = 'active';
        }

        setSubscription(transformedData);
      } else {
        setError(response.data.error?.message || 'Failed to fetch subscription');
      }
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const renewSubscription = useCallback(async () => {
    if (!projectId) return;

    try {
      setError(null);
      const response = await api.post(`/projects/${projectId}/renew-subscription`);
      
      if (response.data.success) {
        // Refresh subscription data after renewal
        await fetchSubscription();
      } else {
        setError(response.data.error?.message || 'Failed to renew subscription');
      }
    } catch (err: any) {
      console.error('Error renewing subscription:', err);
      setError(err.response?.data?.error?.message || 'Failed to renew subscription');
    }
  }, [projectId, fetchSubscription]);

  const cancelSubscription = useCallback(async () => {
    if (!projectId) return;

    try {
      setError(null);
      const response = await api.post(`/projects/${projectId}/cancel-subscription`);
      
      if (response.data.success) {
        // Refresh subscription data after cancellation
        await fetchSubscription();
      } else {
        setError(response.data.error?.message || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.response?.data?.error?.message || 'Failed to cancel subscription');
    }
  }, [projectId, fetchSubscription]);

  const updatePaymentMethod = useCallback(async (paymentMethodId: string) => {
    if (!projectId) return;

    try {
      setError(null);
      const response = await api.put(`/projects/${projectId}/payment-method`, {
        paymentMethodId
      });
      
      if (response.data.success) {
        // Refresh subscription data after payment method update
        await fetchSubscription();
      } else {
        setError(response.data.error?.message || 'Failed to update payment method');
      }
    } catch (err: any) {
      console.error('Error updating payment method:', err);
      setError(err.response?.data?.error?.message || 'Failed to update payment method');
    }
  }, [projectId, fetchSubscription]);

  // Initial fetch
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !projectId) return;

    const interval = setInterval(fetchSubscription, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchSubscription, projectId]);

  return {
    subscription,
    loading,
    error,
    refresh: fetchSubscription,
    renewSubscription,
    cancelSubscription,
    updatePaymentMethod
  };
}

// Hook for getting subscription status across all projects
export function useAllSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllSubscriptions = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/subscriptions');
      
      if (response.data.success) {
        const data = response.data.data.map((sub: any) => ({
          ...sub,
          currentPeriodStart: new Date(sub.currentPeriodStart),
          currentPeriodEnd: new Date(sub.currentPeriodEnd),
          nextBillingDate: sub.nextBillingDate ? new Date(sub.nextBillingDate) : undefined,
        }));

        setSubscriptions(data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch subscriptions');
      }
    } catch (err: any) {
      console.error('Error fetching subscriptions:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllSubscriptions();
  }, [fetchAllSubscriptions]);

  return {
    subscriptions,
    loading,
    error,
    refresh: fetchAllSubscriptions
  };
}

export default useSubscription;