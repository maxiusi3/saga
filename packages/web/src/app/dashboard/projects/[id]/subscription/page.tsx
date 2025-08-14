'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Loading } from '../../../../../components/ui/loading';
import { SubscriptionOverview } from '../../../../../components/subscription/subscription-overview';
import { SubscriptionHistory } from '../../../../../components/subscription/subscription-history';
import { BillingInformation } from '../../../../../components/subscription/billing-information';
import { SubscriptionStatusBanner } from '../../../../../components/subscription/subscription-status-banner';
import { useSubscription } from '../../../../../hooks/use-subscription';
import { useBillingHistory } from '../../../../../hooks/use-billing-history';
import { ArrowLeft, RefreshCw, Settings, History, CreditCard, HelpCircle } from 'lucide-react';

export default function SubscriptionManagementPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'billing'>('overview');

  const { 
    subscription, 
    loading: subscriptionLoading, 
    error: subscriptionError, 
    renewSubscription,
    refresh: refreshSubscription 
  } = useSubscription({ projectId, autoRefresh: true });

  const {
    history,
    billingInfo,
    loading: billingLoading,
    error: billingError,
    refresh: refreshBilling,
    downloadReceipt,
    downloadInvoice,
    downloadAllInvoices,
    updateBillingInfo,
    updateInvoiceSettings
  } = useBillingHistory({ projectId });

  const loading = subscriptionLoading || billingLoading;
  const error = subscriptionError || billingError;

  const handleRenew = async () => {
    try {
      await renewSubscription();
      router.push(`/dashboard/projects/${projectId}/subscription/renew`);
    } catch (err) {
      console.error('Renewal failed:', err);
    }
  };

  const handleExport = () => {
    router.push(`/dashboard/projects/${projectId}/export`);
  };

  const handleEditBilling = () => {
    router.push(`/dashboard/projects/${projectId}/subscription/billing/edit`);
  };

  const handleRefresh = async () => {
    await Promise.all([refreshSubscription(), refreshBilling()]);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex justify-center space-x-3">
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
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

  const projectName = subscription.projectName || 'Project';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
            <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {subscription.canRenew && (
            <Button onClick={handleRenew} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Renew
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {(subscription.status === 'expiring_soon' || subscription.status === 'expired' || subscription.isArchived) && (
        <div className="mb-6">
          <SubscriptionStatusBanner
            subscription={{
              status: subscription.status,
              daysUntilExpiry: subscription.daysUntilExpiry,
              projectName,
              projectId,
              canRenew: subscription.canRenew
            }}
            onRenew={handleRenew}
            onDismiss={() => {}} // Could implement local storage to remember dismissal
          />
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="h-4 w-4 inline mr-2" />
            History
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'billing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CreditCard className="h-4 w-4 inline mr-2" />
            Billing
          </button>
          <button
            onClick={() => router.push(`/dashboard/projects/${projectId}/subscription/help`)}
            className="py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm"
          >
            <HelpCircle className="h-4 w-4 inline mr-2" />
            Help
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <SubscriptionOverview
            subscription={{
              id: subscription.id,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              daysUntilExpiry: subscription.daysUntilExpiry,
              isArchived: subscription.isArchived,
              canRenew: subscription.canRenew,
              packageName: subscription.packageName,
              packagePrice: subscription.packagePrice,
              features: subscription.features,
              usage: subscription.usage,
              nextBillingDate: subscription.nextBillingDate,
              paymentMethod: subscription.paymentMethod
            }}
            projectName={projectName}
            onRenew={handleRenew}
            onUpdatePayment={() => router.push(`/dashboard/projects/${projectId}/subscription/payment-methods`)}
            onCancel={() => router.push(`/dashboard/projects/${projectId}/subscription/cancel`)}
            onExport={handleExport}
          />
        )}

        {activeTab === 'history' && (
          <SubscriptionHistory
            history={history}
            onDownloadReceipt={downloadReceipt}
            onDownloadInvoice={downloadInvoice}
            loading={billingLoading}
          />
        )}

        {activeTab === 'billing' && billingInfo && (
          <BillingInformation
            billingInfo={billingInfo}
            onEdit={handleEditBilling}
            onDownloadInvoices={downloadAllInvoices}
            onUpdateSettings={updateInvoiceSettings}
            loading={billingLoading}
          />
        )}
      </div>

      {/* Quick Actions Sidebar */}
      <div className="fixed bottom-6 right-6 space-y-3">
        {subscription.status === 'expired' && (
          <Button
            onClick={handleRenew}
            className="bg-red-600 hover:bg-red-700 shadow-lg"
            size="lg"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Reactivate Now
          </Button>
        )}
        
        {subscription.status === 'expiring_soon' && subscription.daysUntilExpiry && subscription.daysUntilExpiry <= 3 && (
          <Button
            onClick={handleRenew}
            className="bg-yellow-600 hover:bg-yellow-700 shadow-lg"
            size="lg"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Renew Now
          </Button>
        )}
      </div>
    </div>
  );
}