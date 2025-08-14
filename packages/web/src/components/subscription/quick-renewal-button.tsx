'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { RefreshCw, CreditCard, AlertTriangle } from 'lucide-react';
import { SubscriptionRenewalModal } from './subscription-renewal-modal';

export interface QuickRenewalData {
  projectId: string;
  projectName: string;
  currentExpiryDate: Date;
  status: 'active' | 'expired' | 'expiring_soon' | 'cancelled';
  daysUntilExpiry?: number;
  canRenew: boolean;
}

interface QuickRenewalButtonProps {
  subscription: QuickRenewalData;
  availablePackages: any[];
  paymentMethods: any[];
  onRenew: (packageId: string, paymentMethodId: string) => Promise<void>;
  onAddPaymentMethod: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
  className?: string;
}

export function QuickRenewalButton({
  subscription,
  availablePackages,
  paymentMethods,
  onRenew,
  onAddPaymentMethod,
  size = 'md',
  variant = 'default',
  showText = true,
  className = ''
}: QuickRenewalButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const getButtonConfig = () => {
    switch (subscription.status) {
      case 'expired':
        return {
          text: 'Reactivate',
          icon: RefreshCw,
          variant: 'default' as const,
          urgency: 'high',
          className: 'bg-red-600 hover:bg-red-700 text-white'
        };
      case 'expiring_soon':
        return {
          text: subscription.daysUntilExpiry && subscription.daysUntilExpiry <= 3 ? 'Renew Now' : 'Renew',
          icon: AlertTriangle,
          variant: 'default' as const,
          urgency: 'medium',
          className: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        };
      case 'active':
        return {
          text: 'Extend',
          icon: RefreshCw,
          variant: variant,
          urgency: 'low',
          className: ''
        };
      default:
        return {
          text: 'Renew',
          icon: RefreshCw,
          variant: variant,
          urgency: 'low',
          className: ''
        };
    }
  };

  const config = getButtonConfig();
  const Icon = config.icon;

  if (!subscription.canRenew) {
    return null;
  }

  const buttonText = showText ? config.text : '';
  const hasPaymentMethods = paymentMethods.length > 0;

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        size={size}
        variant={config.variant}
        className={`${config.className} ${className}`}
        disabled={!hasPaymentMethods && config.urgency === 'high'}
      >
        <Icon className={`h-4 w-4 ${showText ? 'mr-2' : ''}`} />
        {buttonText}
        {!hasPaymentMethods && config.urgency === 'high' && (
          <CreditCard className="h-4 w-4 ml-2 text-gray-400" />
        )}
      </Button>

      <SubscriptionRenewalModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        projectName={subscription.projectName}
        projectId={subscription.projectId}
        currentExpiryDate={subscription.currentExpiryDate}
        availablePackages={availablePackages}
        paymentMethods={paymentMethods}
        onRenew={onRenew}
        onAddPaymentMethod={onAddPaymentMethod}
      />
    </>
  );
}

// Compact version for use in lists or tight spaces
export function CompactRenewalButton({
  subscription,
  onClick,
  className = ''
}: {
  subscription: QuickRenewalData;
  onClick: () => void;
  className?: string;
}) {
  if (!subscription.canRenew) return null;

  const getButtonStyle = () => {
    switch (subscription.status) {
      case 'expired':
        return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
      case 'expiring_soon':
        return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
    }
  };

  const getText = () => {
    switch (subscription.status) {
      case 'expired':
        return 'Reactivate';
      case 'expiring_soon':
        return subscription.daysUntilExpiry && subscription.daysUntilExpiry <= 3 ? 'Urgent' : 'Renew';
      default:
        return 'Extend';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border transition-colors ${getButtonStyle()} ${className}`}
    >
      <RefreshCw className="h-3 w-3 mr-1" />
      {getText()}
    </button>
  );
}

export default QuickRenewalButton;