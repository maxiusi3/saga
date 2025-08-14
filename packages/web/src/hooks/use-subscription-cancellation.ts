'use client';

import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface CancellationRequest {
  projectId: string;
  reason: string;
  feedback?: string;
  retainAccess: boolean;
  immediateCancel?: boolean;
}

export interface CancellationResult {
  success: boolean;
  cancellationId: string;
  effectiveDate: Date;
  archivalDate: Date;
  refundAmount?: number;
  confirmationEmail: string;
}

interface UseSubscriptionCancellationReturn {
  cancelSubscription: (request: CancellationRequest) => Promise<CancellationResult>;
  reactivateSubscription: (projectId: string) => Promise<void>;
  getCancellationPreview: (projectId: string) => Promise<{
    subscriptionEndDate: Date;
    archivalStartDate: Date;
    refundAmount?: number;
    storiesCount: number;
    interactionsCount: number;
    facilitatorsCount: number;
  }>;
  loading: boolean;
  error: string | null;
}

export function useSubscriptionCancellation(): UseSubscriptionCancellationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelSubscription = useCallback(async (request: CancellationRequest): Promise<CancellationResult> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/projects/${request.projectId}/cancel-subscription`, {
        reason: request.reason,
        feedback: request.feedback,
        retainAccess: request.retainAccess,
        immediateCancel: request.immediateCancel || false
      });

      if (response.data.success) {
        const data = response.data.data;
        return {
          success: true,
          cancellationId: data.cancellationId,
          effectiveDate: new Date(data.effectiveDate),
          archivalDate: new Date(data.archivalDate),
          refundAmount: data.refundAmount,
          confirmationEmail: data.confirmationEmail
        };
      } else {
        throw new Error(response.data.error?.message || 'Cancellation failed');
      }
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to cancel subscription';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const reactivateSubscription = useCallback(async (projectId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/projects/${projectId}/reactivate-subscription`);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Reactivation failed');
      }
    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to reactivate subscription';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getCancellationPreview = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/projects/${projectId}/cancellation-preview`);

      if (response.data.success) {
        const data = response.data.data;
        return {
          subscriptionEndDate: new Date(data.subscriptionEndDate),
          archivalStartDate: new Date(data.archivalStartDate),
          refundAmount: data.refundAmount,
          storiesCount: data.storiesCount,
          interactionsCount: data.interactionsCount,
          facilitatorsCount: data.facilitatorsCount
        };
      } else {
        throw new Error(response.data.error?.message || 'Failed to get cancellation preview');
      }
    } catch (err: any) {
      console.error('Error getting cancellation preview:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to get cancellation preview';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    cancelSubscription,
    reactivateSubscription,
    getCancellationPreview,
    loading,
    error
  };
}

// Hook for managing cancellation analytics and feedback
export function useCancellationAnalytics() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCancellationFeedback = useCallback(async (
    cancellationId: string,
    feedback: {
      rating: number;
      comments: string;
      wouldRecommend: boolean;
      improvementSuggestions: string[];
    }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/cancellations/${cancellationId}/feedback`, feedback);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to submit feedback');
      }

      return response.data.data;
    } catch (err: any) {
      console.error('Error submitting cancellation feedback:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to submit feedback';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getCancellationReasons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/cancellations/reasons');

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error?.message || 'Failed to get cancellation reasons');
      }
    } catch (err: any) {
      console.error('Error getting cancellation reasons:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to get cancellation reasons';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const trackCancellationEvent = useCallback(async (
    projectId: string,
    event: 'cancellation_started' | 'cancellation_completed' | 'cancellation_abandoned' | 'reactivation_completed',
    metadata?: Record<string, any>
  ) => {
    try {
      await api.post('/analytics/cancellation-events', {
        projectId,
        event,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Don't throw errors for analytics tracking
      console.warn('Failed to track cancellation event:', err);
    }
  }, []);

  return {
    submitCancellationFeedback,
    getCancellationReasons,
    trackCancellationEvent,
    loading,
    error
  };
}

export default useSubscriptionCancellation;