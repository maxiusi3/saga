'use client';

import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { PlanChangePreview } from '../components/subscription/plan-change-preview';

interface UsePlanChangesOptions {
  projectId?: string;
}

interface UsePlanChangesReturn {
  preview: PlanChangePreview | null;
  loading: boolean;
  error: string | null;
  getPreview: (planId: string) => Promise<PlanChangePreview>;
  confirmUpgrade: (planId: string) => Promise<{ checkoutUrl?: string }>;
  confirmDowngrade: (planId: string, reason?: string) => Promise<void>;
  cancelScheduledDowngrade: () => Promise<void>;
  clearPreview: () => void;
}

export function usePlanChanges(
  options: UsePlanChangesOptions = {}
): UsePlanChangesReturn {
  const { projectId } = options;

  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreview = useCallback(async (planId: string): Promise<PlanChangePreview> => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/preview-change`
        : '/subscription-plans/preview-change';

      const response = await api.post(endpoint, { planId });

      if (response.data.success) {
        const previewData = {
          ...response.data.data,
          effectiveDate: new Date(response.data.data.effectiveDate),
          nextBillingDate: new Date(response.data.data.nextBillingDate)
        };
        
        setPreview(previewData);
        return previewData;
      } else {
        throw new Error(response.data.error?.message || 'Failed to get plan change preview');
      }
    } catch (err: any) {
      console.error('Error getting plan change preview:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to get plan change preview';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const confirmUpgrade = useCallback(async (planId: string): Promise<{ checkoutUrl?: string }> => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/upgrade`
        : '/subscription-plans/upgrade';

      const response = await api.post(endpoint, { 
        planId,
        effectiveImmediately: true 
      });

      if (response.data.success) {
        setPreview(null); // Clear preview after successful upgrade
        return response.data.data;
      } else {
        throw new Error(response.data.error?.message || 'Failed to upgrade plan');
      }
    } catch (err: any) {
      console.error('Error upgrading plan:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to upgrade plan';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const confirmDowngrade = useCallback(async (planId: string, reason?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/downgrade`
        : '/subscription-plans/downgrade';

      const response = await api.post(endpoint, { 
        planId,
        reason 
      });

      if (response.data.success) {
        setPreview(null); // Clear preview after successful downgrade scheduling
      } else {
        throw new Error(response.data.error?.message || 'Failed to schedule downgrade');
      }
    } catch (err: any) {
      console.error('Error scheduling downgrade:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to schedule downgrade';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const cancelScheduledDowngrade = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/cancel-downgrade`
        : '/subscription-plans/cancel-downgrade';

      const response = await api.post(endpoint);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to cancel scheduled downgrade');
      }
    } catch (err: any) {
      console.error('Error canceling scheduled downgrade:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to cancel scheduled downgrade';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return {
    preview,
    loading,
    error,
    getPreview,
    confirmUpgrade,
    confirmDowngrade,
    cancelScheduledDowngrade,
    clearPreview
  };
}

export default usePlanChanges;