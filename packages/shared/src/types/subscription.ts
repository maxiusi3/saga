export interface Subscription {
  id: string;
  facilitator_id: string;
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: Date;
  created_at: Date;
  updated_at: Date;
  plan_id?: string;
  stripe_subscription_id?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
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
  isActive: boolean;
  isPopular?: boolean;
  sortOrder: number;
  stripeProductId?: string;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
}

export interface SubscriptionStatus {
  subscription: Subscription;
  is_active: boolean;
  days_remaining: number;
  auto_renew: boolean;
  resource_usage: {
    project_vouchers: number;
    facilitator_seats: number;
    storyteller_seats: number;
  };
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

export interface PlanUpgradeRequest {
  planId: string;
  effectiveImmediately?: boolean;
}

export interface PlanDowngradeRequest {
  planId: string;
  effectiveDate?: Date;
  reason?: string;
}