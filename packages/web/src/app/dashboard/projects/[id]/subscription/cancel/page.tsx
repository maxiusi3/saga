'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card } from '../../../../../../components/ui/card';
import { Button } from '../../../../../../components/ui/button';
import { Loading } from '../../../../../../components/ui/loading';
import { SubscriptionCancellationModal } from '../../../../../../components/subscription/subscription-cancellation-modal';
import { CancellationSuccess } from '../../../../../../components/subscription/cancellation-success';
import { useSubscription } from '../../../../../../hooks/use-subscription';
import { useSubscriptionCancellation, useCancellationAnalytics } from '../../../../../../hooks/use-subscription-cancellation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function SubscriptionCancellationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationPreview, setCancellationPreview] = useState<any>(null);
  const [cancellationResult, setCancellationResult] = useState<any>(null);
  const [projectName, setProjectName] = useState<string>('');

  const { subscription, loading: subscriptionLoading, error: subscriptionError } = useSubscription({ projectId });
  
  const { 
    cancelSubscription, 
    reactivateSubscription, 
    getCancellationPreview,
    loading: cancellationLoading,
    error: cancellationError
  } = useSubscriptionCancellation();

  const { trackCancellationEvent } = useCancellationAnalytics();

  // Check if we're showing success page
  const showSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    if (subscription) {
      setProjectName(subscription.projectName || 'Project');
    }
  }, [subscription]);

  useEffect(() => {
    // Track that user started cancellation process
    if (projectId && !showSuccess) {
      trackCancellationEvent(projectId, 'cancellation_started');
    }
  }, [projectId, showSuccess, trackCancellationEvent]);

  const handleStartCancellation = async () => {
    try {
      const preview = await getCancellationPreview(projectId);
      setCancellationPreview(preview);
      setShowCancellationModal(true);
    } catch (error) {
      console.error('Failed to get cancellation preview:', error);
    }
  };

  const handleCancelSubscription = async (reason: string, feedback: string, retainAccess: boolean) => {
    try {
      const result = await cancelSubscription({
        projectId,
        reason,
        feedback,
        retainAccess
      });

      // Track successful cancellation
      await trackCancellationEvent(projectId, 'cancellation_completed', {
        reason,
        retainAccess,
        refundAmount: result.refundAmount
      });

      setCancellationResult({
        projectId,
        projectName,
        cancellationDate: new Date(),
        subscriptionEndDate: result.effectiveDate,
        archivalStartDate: result.archivalDate,
        retainAccess,
        reason,
        refundAmount: result.refundAmount,
        currency: subscription?.currency || 'USD',
        storiesCount: cancellationPreview?.storiesCount || 0,
        interactionsCount: cancellationPreview?.interactionsCount || 0
      });

      // Redirect to success page
      router.push(`/dashboard/projects/${projectId}/subscription/cancel?success=true`);
    } catch (error) {
      console.error('Cancellation failed:', error);
      throw error;
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateSubscription(projectId);
      
      // Track reactivation
      await trackCancellationEvent(projectId, 'reactivation_completed');
      
      // Redirect to subscription page with success message
      router.push(`/dashboard/projects/${projectId}/subscription?reactivated=true`);
    } catch (error) {
      console.error('Reactivation failed:', error);
    }
  };

  const handleExportData = () => {
    router.push(`/dashboard/projects/${projectId}/export`);
  };

  const handleProvideFeedback = () => {
    router.push(`/dashboard/projects/${projectId}/subscription/feedback`);
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  const handleExportFirst = () => {
    setShowCancellationModal(false);
    router.push(`/dashboard/projects/${projectId}/export?return=cancel`);
  };

  if (subscriptionLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Loading />
      </div>
    );
  }

  if (subscriptionError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-red-600 mb-4">{subscriptionError}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-gray-600 mb-4">Subscription not found</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  // Show success page if cancellation was completed
  if (showSuccess && cancellationResult) {
    return (
      <div className="container mx-auto px-4 py-8">
        <CancellationSuccess
          cancellationData={cancellationResult}
          onExportData={handleExportData}
          onReactivate={handleReactivate}
          onBackToDashboard={handleBackToDashboard}
          onProvideFeedback={handleProvideFeedback}
        />
      </div>
    );
  }

  // Show cancellation initiation page
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
            <h1 className="text-2xl font-bold text-gray-900">Cancel Subscription</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
      </div>

      {/* Cannot Cancel Warning (if subscription is already cancelled or expired) */}
      {(subscription.status === 'cancelled' || subscription.status === 'expired') && (
        <Card className="p-6 bg-yellow-50 border-yellow-200 mb-8">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">
                {subscription.status === 'cancelled' ? 'Subscription Already Cancelled' : 'Subscription Expired'}
              </h3>
              <p className="text-sm text-yellow-800 mt-1">
                {subscription.status === 'cancelled' 
                  ? 'Your subscription has already been cancelled. You can reactivate it anytime.'
                  : 'Your subscription has expired. You can renew it to restore full functionality.'}
              </p>
              <div className="mt-3">
                <Button
                  onClick={() => router.push(`/dashboard/projects/${projectId}/subscription/renew`)}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  {subscription.status === 'cancelled' ? 'Reactivate' : 'Renew'} Subscription
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Cancellation Information */}
      {subscription.status === 'active' && (
        <div className="space-y-8">
          {/* Current Subscription Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">{subscription.packageName}</div>
                <div className="text-sm text-gray-600">Package</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }).format(subscription.currentPeriodEnd)}
                </div>
                <div className="text-sm text-gray-600">Expires</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: subscription.currency || 'USD'
                  }).format(subscription.packagePrice)}
                </div>
                <div className="text-sm text-gray-600">Value</div>
              </div>
            </div>
          </Card>

          {/* Alternatives to Cancellation */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">Before You Cancel</h2>
            <p className="text-blue-800 mb-4">
              We understand that circumstances change. Here are some alternatives to consider:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Pause Your Subscription</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Take a break for up to 3 months while keeping your data safe.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Learn More
                </Button>
              </div>
              
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Contact Support</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Let us help resolve any issues you're experiencing.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Get Help
                </Button>
              </div>
            </div>
          </Card>

          {/* Cancellation Action */}
          <Card className="p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ready to Cancel?</h2>
            <p className="text-gray-600 mb-6">
              We'll walk you through the process and make sure you understand what happens next.
            </p>
            
            <Button
              onClick={handleStartCancellation}
              variant="destructive"
              disabled={cancellationLoading}
              className="px-8"
            >
              {cancellationLoading ? 'Loading...' : 'Start Cancellation Process'}
            </Button>
          </Card>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancellationModal && cancellationPreview && (
        <SubscriptionCancellationModal
          isOpen={showCancellationModal}
          onClose={() => {
            setShowCancellationModal(false);
            // Track abandonment
            trackCancellationEvent(projectId, 'cancellation_abandoned');
          }}
          cancellationData={{
            projectId,
            projectName,
            currentPeriodEnd: subscription.currentPeriodEnd,
            subscriptionValue: subscription.packagePrice,
            currency: subscription.currency || 'USD',
            storiesCount: cancellationPreview.storiesCount,
            interactionsCount: cancellationPreview.interactionsCount,
            facilitatorsCount: cancellationPreview.facilitatorsCount,
            canRetainAccess: true,
            archivalDate: cancellationPreview.archivalStartDate
          }}
          onCancel={handleCancelSubscription}
          onExportFirst={handleExportFirst}
          loading={cancellationLoading}
        />
      )}

      {/* Error Display */}
      {cancellationError && (
        <Card className="p-4 bg-red-50 border-red-200 mt-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">Cancellation Error</h3>
              <p className="text-sm text-red-800 mt-1">{cancellationError}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}