'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  currency: string;
  features: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
    storageGB: number;
    aiFeatures: boolean;
    prioritySupport: boolean;
    advancedAnalytics: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };
  limits: {
    maxProjects: number;
    maxStoriesPerProject: number;
    maxFamilyMembers: number;
  };
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  savings?: number;
}

export interface PlanChangePreview {
  currentPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
  priceChange: {
    amount: number;
    isIncrease: boolean;
    proratedAmount?: number;
    nextBillingAmount: number;
  };
  featureChanges: {
    feature: string;
    currentValue: any;
    newValue: any;
    changeType: 'upgrade' | 'downgrade' | 'same';
  }[];
  effectiveDate: Date;
  nextBillingDate: Date;
}

interface UseSubscriptionPlansOptions {
  projectId?: string;
}

interface UseSubscriptionPlansReturn {
  plans: SubscriptionPlan[];
  currentPlan: SubscriptionPlan | null;
  loading: boolean;
  error: string | null;
  upgradePlan: (planId: string) => Promise<void>;
  downgradePlan: (planId: string) => Promise<void>;
  getChangePreview: (planId: string) => Promise<PlanChangePreview>;
  refresh: () => Promise<void>;
}

export function useSubscriptionPlans(
  options: UseSubscriptionPlansOptions = {}
): UseSubscriptionPlansReturn {
  const { projectId } = options;

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/subscription-plans`
        : '/subscription-plans';

      const response = await api.get(endpoint);

      if (response.data.success) {
        const plansData = response.data.data.plans;
        const currentPlanData = response.data.data.currentPlan;

        // Mark current plan and set isCurrentPlan flag
        const plansWithCurrentFlag = plansData.map((plan: SubscriptionPlan) => ({
          ...plan,
          isCurrentPlan: currentPlanData && plan.id === currentPlanData.id
        }));

        setPlans(plansWithCurrentFlag);
        setCurrentPlan(currentPlanData);
      } else {
        setError(response.data.error?.message || 'Failed to fetch subscription plans');
      }
    } catch (err: any) {
      console.error('Error fetching subscription plans:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch subscription plans');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const upgradePlan = useCallback(async (planId: string) => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/upgrade-subscription`
        : '/upgrade-subscription';

      const response = await api.post(endpoint, { planId });

      if (response.data.success) {
        // Refresh plans to get updated current plan
        await fetchPlans();
      } else {
        throw new Error(response.data.error?.message || 'Failed to upgrade plan');
      }
    } catch (err: any) {
      console.error('Error upgrading plan:', err);
      setError(err.response?.data?.error?.message || 'Failed to upgrade plan');
      throw err;
    }
  }, [projectId, fetchPlans]);

  const downgradePlan = useCallback(async (planId: string) => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/downgrade-subscription`
        : '/downgrade-subscription';

      const response = await api.post(endpoint, { planId });

      if (response.data.success) {
        // Refresh plans to get updated current plan
        await fetchPlans();
      } else {
        throw new Error(response.data.error?.message || 'Failed to downgrade plan');
      }
    } catch (err: any) {
      console.error('Error downgrading plan:', err);
      setError(err.response?.data?.error?.message || 'Failed to downgrade plan');
      throw err;
    }
  }, [projectId, fetchPlans]);

  const getChangePreview = useCallback(async (planId: string): Promise<PlanChangePreview> => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/plan-change-preview`
        : '/plan-change-preview';

      const response = await api.post(endpoint, { planId });

      if (response.data.success) {
        const data = response.data.data;
        return {
          ...data,
          effectiveDate: new Date(data.effectiveDate),
          nextBillingDate: new Date(data.nextBillingDate)
        };
      } else {
        throw new Error(response.data.error?.message || 'Failed to get plan change preview');
      }
    } catch (err: any) {
      console.error('Error getting plan change preview:', err);
      setError(err.response?.data?.error?.message || 'Failed to get plan change preview');
      throw err;
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    currentPlan,
    loading,
    error,
    upgradePlan,
    downgradePlan,
    getChangePreview,
    refresh: fetchPlans
  };
}

// Hook for managing plan recommendations
export function usePlanRecommendations(projectId?: string) {
  const [recommendations, setRecommendations] = useState<{
    recommendedPlan: SubscriptionPlan;
    reason: string;
    potentialSavings?: number;
    usageAnalysis: {
      currentUsage: Record<string, number>;
      projectedUsage: Record<string, number>;
      efficiency: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/plan-recommendations`
        : '/plan-recommendations';

      const response = await api.get(endpoint);

      if (response.data.success) {
        setRecommendations(response.data.data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch plan recommendations');
      }
    } catch (err: any) {
      console.error('Error fetching plan recommendations:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch plan recommendations');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refresh: fetchRecommendations
  };
}

// Hook for plan comparison utilities
export function usePlanComparison() {
  const comparePlans = useCallback((plan1: SubscriptionPlan, plan2: SubscriptionPlan) => {
    const featureComparisons = Object.keys(plan1.features).map(feature => {
      const key = feature as keyof SubscriptionPlan['features'];
      const value1 = plan1.features[key];
      const value2 = plan2.features[key];
      
      let changeType: 'upgrade' | 'downgrade' | 'same' = 'same';
      
      if (typeof value1 === 'number' && typeof value2 === 'number') {
        if (value2 > value1) changeType = 'upgrade';
        else if (value2 < value1) changeType = 'downgrade';
      } else if (typeof value1 === 'boolean' && typeof value2 === 'boolean') {
        if (value2 && !value1) changeType = 'upgrade';
        else if (!value2 && value1) changeType = 'downgrade';
      }

      return {
        feature: key,
        currentValue: value1,
        newValue: value2,
        changeType
      };
    });

    const priceComparison = {
      currentPrice: plan1.price,
      newPrice: plan2.price,
      difference: plan2.price - plan1.price,
      isIncrease: plan2.price > plan1.price,
      percentageChange: ((plan2.price - plan1.price) / plan1.price) * 100
    };

    return {
      featureComparisons,
      priceComparison,
      isUpgrade: priceComparison.isIncrease,
      isDowngrade: !priceComparison.isIncrease && priceComparison.difference !== 0
    };
  }, []);

  const calculatePlanValue = useCallback((plan: SubscriptionPlan, usage: Record<string, number>) => {
    // Calculate value based on usage patterns
    const baseValue = plan.price;
    const featureUtilization = Object.entries(usage).reduce((acc, [feature, usagePercent]) => {
      return acc + (usagePercent / 100);
    }, 0) / Object.keys(usage).length;

    return {
      costPerFeature: baseValue / Object.keys(plan.features).length,
      utilizationScore: featureUtilization,
      valueScore: featureUtilization * 100, // Higher is better value
      recommendedUsage: featureUtilization > 0.7 ? 'optimal' : featureUtilization > 0.4 ? 'good' : 'underutilized'
    };
  }, []);

  return {
    comparePlans,
    calculatePlanValue
  };
}

export default useSubscriptionPlans;