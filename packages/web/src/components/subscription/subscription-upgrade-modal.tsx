'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  X, 
  ArrowUp, 
  ArrowDown,
  Check, 
  Star,
  Zap,
  Users,
  Mic,
  MessageSquare,
  Calendar,
  Shield,
  Crown
} from 'lucide-react';

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
  savings?: number; // percentage saved compared to monthly
}

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: SubscriptionPlan;
  availablePlans: SubscriptionPlan[];
  onUpgrade: (planId: string) => Promise<void>;
  onDowngrade: (planId: string) => Promise<void>;
  loading?: boolean;
  className?: string;
}

export function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  availablePlans,
  onUpgrade,
  onDowngrade,
  loading = false,
  className = ''
}: SubscriptionUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(currentPlan.id);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const getPlanComparison = (plan: SubscriptionPlan) => {
    const currentPrice = currentPlan.price;
    const newPrice = plan.price;
    const isUpgrade = newPrice > currentPrice;
    const isDowngrade = newPrice < currentPrice;
    const priceDiff = Math.abs(newPrice - currentPrice);

    return {
      isUpgrade,
      isDowngrade,
      priceDiff,
      isCurrentPlan: plan.id === currentPlan.id
    };
  };

  const handlePlanChange = async () => {
    if (selectedPlan === currentPlan.id) return;

    const selectedPlanData = availablePlans.find(p => p.id === selectedPlan);
    if (!selectedPlanData) return;

    const comparison = getPlanComparison(selectedPlanData);
    
    setIsProcessing(true);
    try {
      if (comparison.isUpgrade) {
        await onUpgrade(selectedPlan);
      } else if (comparison.isDowngrade) {
        await onDowngrade(selectedPlan);
      }
      onClose();
    } catch (error) {
      console.error('Plan change failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderFeatureComparison = (feature: keyof SubscriptionPlan['features'], label: string, icon: React.ReactNode) => {
    const currentValue = currentPlan.features[feature];
    const selectedPlanData = availablePlans.find(p => p.id === selectedPlan);
    const newValue = selectedPlanData?.features[feature];

    let status: 'same' | 'upgrade' | 'downgrade' = 'same';
    if (typeof currentValue === 'number' && typeof newValue === 'number') {
      if (newValue > currentValue) status = 'upgrade';
      else if (newValue < currentValue) status = 'downgrade';
    } else if (typeof currentValue === 'boolean' && typeof newValue === 'boolean') {
      if (newValue && !currentValue) status = 'upgrade';
      else if (!newValue && currentValue) status = 'downgrade';
    }

    return (
      <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          {icon}
          <span className="text-sm font-medium text-gray-900">{label}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {typeof currentValue === 'boolean' ? (currentValue ? 'Yes' : 'No') : currentValue}
          </span>
          {status !== 'same' && (
            <>
              <span className="text-gray-400">→</span>
              <span className={`text-sm font-medium ${
                status === 'upgrade' ? 'text-green-600' : 'text-red-600'
              }`}>
                {typeof newValue === 'boolean' ? (newValue ? 'Yes' : 'No') : newValue}
              </span>
              {status === 'upgrade' && <ArrowUp className="h-4 w-4 text-green-600" />}
              {status === 'downgrade' && <ArrowDown className="h-4 w-4 text-red-600" />}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Change Subscription Plan</h2>
            <p className="text-sm text-gray-600 mt-1">
              Compare plans and upgrade or downgrade your subscription
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600"
            disabled={isProcessing}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          {/* Plan Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.map((plan) => {
                const comparison = getPlanComparison(plan);
                
                return (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all duration-200 relative ${
                      selectedPlan === plan.id
                        ? 'ring-2 ring-blue-500 border-blue-500'
                        : 'hover:border-gray-300'
                    } ${comparison.isCurrentPlan ? 'bg-blue-50 border-blue-200' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-yellow-500 text-white">
                          <Star className="h-3 w-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    
                    {comparison.isCurrentPlan && (
                      <div className="absolute -top-3 right-4">
                        <Badge variant="default">Current Plan</Badge>
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedPlan === plan.id
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedPlan === plan.id && (
                              <div className="w-full h-full rounded-full bg-white scale-50" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 flex items-center">
                              {plan.name}
                              {plan.name.includes('Pro') && <Crown className="h-4 w-4 ml-2 text-yellow-500" />}
                            </h4>
                            <p className="text-sm text-gray-600">{plan.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-3xl font-bold text-gray-900">
                          {formatCurrency(plan.price, plan.currency)}
                        </div>
                        <div className="text-sm text-gray-600">
                          per {plan.billingPeriod === 'yearly' ? 'year' : 'month'}
                        </div>
                        {plan.savings && (
                          <div className="text-sm text-green-600 font-medium">
                            Save {plan.savings}% annually
                          </div>
                        )}
                      </div>

                      {/* Price Comparison */}
                      {!comparison.isCurrentPlan && (
                        <div className={`p-3 rounded-lg mb-4 ${
                          comparison.isUpgrade 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className={`text-sm font-medium ${
                            comparison.isUpgrade ? 'text-green-900' : 'text-red-900'
                          }`}>
                            {comparison.isUpgrade ? 'Upgrade' : 'Downgrade'}
                          </div>
                          <div className={`text-sm ${
                            comparison.isUpgrade ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {comparison.isUpgrade ? '+' : '-'}{formatCurrency(comparison.priceDiff, plan.currency)} 
                            /{plan.billingPeriod === 'yearly' ? 'year' : 'month'}
                          </div>
                        </div>
                      )}

                      {/* Key Features */}
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-700">
                          <Users className="h-4 w-4 mr-2 text-blue-600" />
                          {plan.features.facilitatorSeats} Facilitator Seats
                        </div>
                        <div className="flex items-center text-sm text-gray-700">
                          <Mic className="h-4 w-4 mr-2 text-green-600" />
                          {plan.features.storytellerSeats} Storyteller Seats
                        </div>
                        <div className="flex items-center text-sm text-gray-700">
                          <Shield className="h-4 w-4 mr-2 text-purple-600" />
                          {plan.features.storageGB}GB Storage
                        </div>
                        {plan.features.aiFeatures && (
                          <div className="flex items-center text-sm text-gray-700">
                            <Zap className="h-4 w-4 mr-2 text-yellow-600" />
                            AI Features
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Feature Comparison */}
          {selectedPlan !== currentPlan.id && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What Changes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFeatureComparison('facilitatorSeats', 'Facilitator Seats', <Users className="h-4 w-4 text-blue-600" />)}
                {renderFeatureComparison('storytellerSeats', 'Storyteller Seats', <Mic className="h-4 w-4 text-green-600" />)}
                {renderFeatureComparison('storageGB', 'Storage (GB)', <Shield className="h-4 w-4 text-purple-600" />)}
                {renderFeatureComparison('aiFeatures', 'AI Features', <Zap className="h-4 w-4 text-yellow-600" />)}
                {renderFeatureComparison('prioritySupport', 'Priority Support', <MessageSquare className="h-4 w-4 text-red-600" />)}
                {renderFeatureComparison('advancedAnalytics', 'Advanced Analytics', <Calendar className="h-4 w-4 text-indigo-600" />)}
              </div>
            </div>
          )}

          {/* Important Notes */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Important Notes</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Plan changes take effect immediately</li>
              <li>• Upgrades are prorated for the current billing period</li>
              <li>• Downgrades take effect at the next billing cycle</li>
              <li>• You can change your plan anytime</li>
              <li>• All your data and settings will be preserved</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePlanChange}
              className="flex-1"
              disabled={selectedPlan === currentPlan.id || isProcessing}
            >
              {isProcessing ? (
                'Processing...'
              ) : (
                <>
                  {getPlanComparison(availablePlans.find(p => p.id === selectedPlan)!).isUpgrade ? (
                    <>
                      <ArrowUp className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-4 w-4 mr-2" />
                      Downgrade Plan
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionUpgradeModal;