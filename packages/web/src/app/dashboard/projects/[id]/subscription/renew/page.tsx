'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../../../components/ui/card';
import { Button } from '../../../../../../components/ui/button';
import { Loading } from '../../../../../../components/ui/loading';
import { SubscriptionRenewalModal } from '../../../../../../components/subscription/subscription-renewal-modal';
import { PaymentMethodManager } from '../../../../../../components/subscription/payment-method-manager';
import { SubscriptionStatusCard } from '../../../../../../components/subscription/subscription-status-card';
import { useSubscription } from '../../../../../../hooks/use-subscription';
import { api } from '../../../../../../lib/api';
import { ArrowLeft, RefreshCw, CreditCard } from 'lucide-react';

interface RenewalPackage {
  id: string;
  name: string;
  price: number;
  duration: number;
  features: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
    interactiveService: boolean;
    archivalAccess: boolean;
    dataExport: boolean;
  };
  isRecommended?: boolean;
  savings?: number;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  isExpired?: boolean;
  billingAddress?: {
    name: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export default function SubscriptionRenewalPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { subscription, loading: subscriptionLoading, error: subscriptionError, refresh } = useSubscription({ projectId });
  
  const [availablePackages, setAvailablePackages] = useState<RenewalPackage[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');

  // Fetch project details, packages, and payment methods
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch project details
        const projectResponse = await api.get(`/projects/${projectId}`);
        if (projectResponse.data.success) {
          setProjectName(projectResponse.data.data.name);
        }

        // Fetch available packages
        const packagesResponse = await api.get('/packages/renewal');
        if (packagesResponse.data.success) {
          setAvailablePackages(packagesResponse.data.data);
        }

        // Fetch payment methods
        const paymentResponse = await api.get('/payment-methods');
        if (paymentResponse.data.success) {
          setPaymentMethods(paymentResponse.data.data);
        }

      } catch (err: any) {
        console.error('Error fetching renewal data:', err);
        setError(err.response?.data?.error?.message || 'Failed to load renewal information');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const handleRenew = async (packageId: string, paymentMethodId: string) => {
    try {
      const response = await api.post(`/projects/${projectId}/renew-subscription`, {
        packageId,
        paymentMethodId
      });

      if (response.data.success) {
        // Refresh subscription data
        await refresh();
        
        // Show success message and redirect
        router.push(`/dashboard/projects/${projectId}?renewed=true`);
      } else {
        throw new Error(response.data.error?.message || 'Renewal failed');
      }
    } catch (err: any) {
      console.error('Renewal error:', err);
      throw err;
    }
  };

  const handleAddPaymentMethod = () => {
    // This would typically open a Stripe Elements modal or redirect to payment setup
    router.push(`/dashboard/projects/${projectId}/subscription/payment-methods/add`);
  };

  const handleEditPaymentMethod = (paymentMethodId: string) => {
    router.push(`/dashboard/projects/${projectId}/subscription/payment-methods/${paymentMethodId}/edit`);
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await api.delete(`/payment-methods/${paymentMethodId}`);
      if (response.data.success) {
        setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
      }
    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      setError(err.response?.data?.error?.message || 'Failed to delete payment method');
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await api.patch(`/payment-methods/${paymentMethodId}/set-default`);
      if (response.data.success) {
        setPaymentMethods(prev => 
          prev.map(pm => ({ ...pm, isDefault: pm.id === paymentMethodId }))
        );
      }
    } catch (err: any) {
      console.error('Error setting default payment method:', err);
      setError(err.response?.data?.error?.message || 'Failed to set default payment method');
    }
  };

  if (subscriptionLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Loading />
      </div>
    );
  }

  if (subscriptionError || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-red-600 mb-4">{subscriptionError || error}</p>
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
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
            <h1 className="text-2xl font-bold text-gray-900">Renew Subscription</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <Button
          onClick={() => setShowRenewalModal(true)}
          disabled={paymentMethods.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Renew Now
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Current Subscription Status */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
            <SubscriptionStatusCard
              subscription={{
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                daysUntilExpiry: subscription.daysUntilExpiry,
                isArchived: subscription.isArchived,
                canRenew: subscription.canRenew
              }}
              projectName={projectName}
              onRenew={() => setShowRenewalModal(true)}
              onViewDetails={() => router.push(`/dashboard/projects/${projectId}/subscription`)}
            />
          </div>

          {/* Payment Methods */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <PaymentMethodManager
              paymentMethods={paymentMethods}
              onAdd={handleAddPaymentMethod}
              onEdit={handleEditPaymentMethod}
              onDelete={handleDeletePaymentMethod}
              onSetDefault={handleSetDefaultPaymentMethod}
              loading={loading}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Renewal Benefits */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Renewal Benefits</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <span>Immediate reactivation of all interactive features</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <span>Continue recording and sharing stories</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <span>Family interactions and follow-up questions</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <span>AI-powered chapter summaries</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <span>Full data export capabilities</span>
              </li>
            </ul>
          </div>

          {/* Support */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Have questions about renewing your subscription? We're here to help.
            </p>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <CreditCard className="h-4 w-4 mr-2" />
                Payment Support
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                Contact Support
              </Button>
            </div>
          </Card>

          {/* Security Notice */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Secure Payments</h3>
            <p className="text-sm text-blue-800">
              All payments are processed securely through encrypted connections. 
              Your payment information is never stored on our servers.
            </p>
          </Card>
        </div>
      </div>

      {/* Renewal Modal */}
      <SubscriptionRenewalModal
        isOpen={showRenewalModal}
        onClose={() => setShowRenewalModal(false)}
        projectName={projectName}
        projectId={projectId}
        currentExpiryDate={subscription.currentPeriodEnd}
        availablePackages={availablePackages}
        paymentMethods={paymentMethods}
        onRenew={handleRenew}
        onAddPaymentMethod={handleAddPaymentMethod}
        loading={loading}
      />
    </div>
  );
}