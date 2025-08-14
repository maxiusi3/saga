'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../../../components/ui/card';
import { Button } from '../../../../../../components/ui/button';
import { Loading } from '../../../../../../components/ui/loading';
import { SubscriptionUpgradeModal } from '../../../../../../components/subscription/subscription-upgrade-modal';
import { PlanRecommendations } from '../../../../../../components/subscription/plan-recommendations';
import { PlanChangePreview } from '../../../../../../components/subscription/plan-change-preview';
import { useSubscriptionPlans, usePlanRecommendations } from '../../../../../../hooks/use-subscription-plans';
import { useSubscription } from '../../../../../../hooks/use-subscription';
import { usePlanChanges } from '../../../../../../hooks/use-plan-changes';
import { ArrowLeft, Zap, AlertTriangle, Star, Check, X } from 'lucide-react';

export default function SubscriptionPlansPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');

  const { subscription, loading: subscriptionLoading } = useSubscription({ projectId });
  
  const {
    plans,
    currentPlan,
    loading: plansLoading,
    error: plansError,
    upgradePlan,
    downgradePlan,
    refresh
  } = useSubscriptionPlans({ projectId });

  const {
    recommendations,
    loading: recommendationsLoading
  } = usePlanRecommendations(projectId);

  const {
    preview,
    loading: previewLoading,
    error: previewError,
    getPreview,
    confirmUpgrade,
    confirmDowngrade,
    clearPreview
  } = usePlanChanges({ projectId });

  const loading = subscriptionLoading || plansLoading;
  const projectName = subscription?.projectName || 'Project';

  // Filter plans by billing period
  const filteredPlans = plans.filter(plan => plan.billingPeriod === billingPeriod);

  const handlePlanSelect = async (planId: string) => {
    try {
      setSelectedPlanId(planId);
      await getPreview(planId);
      setShowUpgradeModal(false);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to get plan preview:', error);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlanId) return;
    
    try {
      const result = await confirmUpgrade(selectedPlanId);
      
      if (result.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = result.checkoutUrl;
      } else {
        // Plan upgraded successfully
        setShowPreview(false);
        setSelectedPlanId(null);
        await refresh(); // Refresh plans to get updated current plan
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedPlanId) return;
    
    try {
      await confirmDowngrade(selectedPlanId, 'User requested downgrade');
      setShowPreview(false);
      setSelectedPlanId(null);
      await refresh(); // Refresh plans to get updated current plan
    } catch (error) {
      console.error('Downgrade failed:', error);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setSelectedPlanId(null);
    clearPreview();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        <Loading />
      </div>
    );
  }

  if (plansError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Plans</h3>
          <p className="text-red-600 mb-4">{plansError}</p>
          <div className="flex justify-center space-x-3">
            <Button onClick={refresh} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Choose Your Plan</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => router.push(`/dashboard/projects/${projectId}/subscription`)}
            variant="outline"
          >
            Current Subscription
          </Button>
        </div>
      </div>

      {/* Plan Recommendations */}
      {recommendations && !recommendationsLoading && (
        <div className="mb-8">
          <PlanRecommendations
            recommendation={recommendations}
            onViewPlans={() => {}} // Already on plans page
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        </div>
      )}

      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Save up to 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        {filteredPlans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.isCurrentPlan 
                ? 'ring-2 ring-blue-500 border-blue-500' 
                : plan.isPopular 
                ? 'ring-2 ring-yellow-400 border-yellow-400' 
                : ''
            }`}
          >
            {plan.isPopular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  Most Popular
                </div>
              </div>
            )}
            
            {plan.isCurrentPlan && (
              <div className="absolute -top-4 right-4">
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Current Plan
                </div>
              </div>
            )}

            <div className="p-8">
              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                
                <div className="mb-4">
                  <div className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </div>
                  <div className="text-gray-600">
                    per {plan.billingPeriod === 'yearly' ? 'year' : 'month'}
                  </div>
                  {plan.savings && (
                    <div className="text-green-600 font-medium text-sm mt-1">
                      Save {plan.savings}% with annual billing
                    </div>
                  )}
                </div>

                {!plan.isCurrentPlan && (
                  <Button
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`w-full ${
                      plan.isPopular 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900' 
                        : ''
                    }`}
                    disabled={previewLoading}
                  >
                    {previewLoading && selectedPlanId === plan.id ? (
                      'Loading...'
                    ) : (
                      currentPlan && plan.price > currentPlan.price ? 'Upgrade' : 'Select Plan'
                    )}
                  </Button>
                )}
                
                {plan.isCurrentPlan && (
                  <Button variant="outline" className="w-full" disabled>
                    <Check className="h-4 w-4 mr-2" />
                    Current Plan
                  </Button>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">{plan.features.projectVouchers} Project Vouchers</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">{plan.features.facilitatorSeats} Facilitator Seats</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">{plan.features.storytellerSeats} Storyteller Seats</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">{plan.features.storageGB}GB Storage</span>
                </div>
                <div className="flex items-center">
                  {plan.features.aiFeatures ? (
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400 mr-3" />
                  )}
                  <span className={`${plan.features.aiFeatures ? 'text-gray-700' : 'text-gray-400'}`}>
                    AI Features
                  </span>
                </div>
                <div className="flex items-center">
                  {plan.features.prioritySupport ? (
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400 mr-3" />
                  )}
                  <span className={`${plan.features.prioritySupport ? 'text-gray-700' : 'text-gray-400'}`}>
                    Priority Support
                  </span>
                </div>
                <div className="flex items-center">
                  {plan.features.advancedAnalytics ? (
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400 mr-3" />
                  )}
                  <span className={`${plan.features.advancedAnalytics ? 'text-gray-700' : 'text-gray-400'}`}>
                    Advanced Analytics
                  </span>
                </div>
              </div>

              {/* Limits */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Limits</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>Up to {plan.limits.maxProjects} projects</div>
                  <div>Up to {plan.limits.maxStoriesPerProject} stories per project</div>
                  <div>Up to {plan.limits.maxFamilyMembers} family members</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Feature Comparison Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Feature</th>
                {filteredPlans.map((plan) => (
                  <th key={plan.id} className="text-center py-3 px-4 font-medium text-gray-900">
                    {plan.name}
                    {plan.isCurrentPlan && (
                      <div className="text-xs text-blue-600 font-normal mt-1">Current</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Project Vouchers</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-4 text-gray-900">
                    {plan.features.projectVouchers}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Facilitator Seats</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-4 text-gray-900">
                    {plan.features.facilitatorSeats}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Storyteller Seats</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-4 text-gray-900">
                    {plan.features.storytellerSeats}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Storage</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-4 text-gray-900">
                    {plan.features.storageGB}GB
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">AI Features</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-4">
                    {plan.features.aiFeatures ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-gray-400 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Priority Support</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-4">
                    {plan.features.prioritySupport ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-gray-400 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upgrade Modal */}
      {showUpgradeModal && currentPlan && (
        <SubscriptionUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={currentPlan}
          availablePlans={filteredPlans}
          onUpgrade={handlePlanSelect}
          onDowngrade={handlePlanSelect}
          loading={plansLoading}
        />
      )}

      {/* Plan Change Preview Modal */}
      {showPreview && preview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <PlanChangePreview
              preview={preview}
              onConfirm={preview.priceChange.isIncrease ? handleConfirmUpgrade : handleConfirmDowngrade}
              onCancel={handleCancelPreview}
              loading={previewLoading}
            />
          </div>
        </div>
      )}

      {/* Preview Error */}
      {previewError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="text-sm">{previewError}</span>
            <button
              onClick={() => clearPreview()}
              className="ml-2 text-red-700 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}