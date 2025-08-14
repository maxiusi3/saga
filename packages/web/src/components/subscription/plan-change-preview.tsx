'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  ArrowRight, 
  ArrowUp, 
  ArrowDown,
  Calendar,
  DollarSign,
  Check,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

export interface PlanChangePreview {
  currentPlan: {
    id: string;
    name: string;
    price: number;
    currency: string;
  };
  newPlan: {
    id: string;
    name: string;
    price: number;
    currency: string;
  };
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

interface PlanChangePreviewProps {
  preview: PlanChangePreview;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

export function PlanChangePreview({
  preview,
  onConfirm,
  onCancel,
  loading = false,
  className = ''
}: PlanChangePreviewProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const isUpgrade = preview.priceChange.isIncrease;
  const hasFeatureChanges = preview.featureChanges.some(change => change.changeType !== 'same');

  const getFeatureIcon = (changeType: string) => {
    switch (changeType) {
      case 'upgrade':
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'downgrade':
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      default:
        return <Check className="h-4 w-4 text-gray-400" />;
    }
  };

  const getFeatureLabel = (feature: string) => {
    const labels: Record<string, string> = {
      projectVouchers: 'Project Vouchers',
      facilitatorSeats: 'Facilitator Seats',
      storytellerSeats: 'Storyteller Seats',
      storageGB: 'Storage (GB)',
      aiFeatures: 'AI Features',
      prioritySupport: 'Priority Support',
      advancedAnalytics: 'Advanced Analytics',
      customBranding: 'Custom Branding',
      apiAccess: 'API Access'
    };
    return labels[feature] || feature;
  };

  const formatFeatureValue = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? 'Included' : 'Not included';
    }
    return value.toString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {isUpgrade ? 'Confirm Plan Upgrade' : 'Confirm Plan Downgrade'}
        </h2>
        <p className="text-gray-600">
          Review the changes to your subscription before confirming
        </p>
      </div>

      {/* Plan Change Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Change</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="font-medium text-gray-900">{preview.currentPlan.name}</div>
              <div className="text-sm text-gray-600">
                {formatCurrency(preview.currentPlan.price, preview.currentPlan.currency)}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
            <div className="text-center">
              <div className="font-medium text-gray-900">{preview.newPlan.name}</div>
              <div className="text-sm text-gray-600">
                {formatCurrency(preview.newPlan.price, preview.newPlan.currency)}
              </div>
            </div>
          </div>
          <Badge variant={isUpgrade ? 'default' : 'secondary'}>
            {isUpgrade ? 'Upgrade' : 'Downgrade'}
          </Badge>
        </div>
      </Card>

      {/* Pricing Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-green-600" />
          Pricing Details
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Price Change</span>
            <span className={`font-medium ${
              isUpgrade ? 'text-red-600' : 'text-green-600'
            }`}>
              {isUpgrade ? '+' : '-'}{formatCurrency(preview.priceChange.amount, preview.newPlan.currency)}
            </span>
          </div>
          
          {preview.priceChange.proratedAmount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Prorated Amount (Today)</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(preview.priceChange.proratedAmount, preview.newPlan.currency)}
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center border-t pt-4">
            <span className="font-medium text-gray-900">Next Billing Amount</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(preview.priceChange.nextBillingAmount, preview.newPlan.currency)}
            </span>
          </div>
        </div>
      </Card>

      {/* Feature Changes */}
      {hasFeatureChanges && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Changes</h3>
          <div className="space-y-3">
            {preview.featureChanges
              .filter(change => change.changeType !== 'same')
              .map((change, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getFeatureIcon(change.changeType)}
                    <span className="font-medium text-gray-900">
                      {getFeatureLabel(change.feature)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-600">
                      {formatFeatureValue(change.currentValue)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <span className={`font-medium ${
                      change.changeType === 'upgrade' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatFeatureValue(change.newValue)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
          Timeline
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Effective Date</span>
            <span className="font-medium text-gray-900">
              {formatDate(preview.effectiveDate)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Next Billing Date</span>
            <span className="font-medium text-gray-900">
              {formatDate(preview.nextBillingDate)}
            </span>
          </div>
        </div>
      </Card>

      {/* Important Information */}
      <Card className={`p-6 ${isUpgrade ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start space-x-3">
          {isUpgrade ? (
            <Info className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          )}
          <div>
            <h4 className={`font-medium ${isUpgrade ? 'text-green-900' : 'text-yellow-900'} mb-2`}>
              {isUpgrade ? 'Upgrade Information' : 'Downgrade Information'}
            </h4>
            <ul className={`text-sm space-y-1 ${isUpgrade ? 'text-green-800' : 'text-yellow-800'}`}>
              {isUpgrade ? (
                <>
                  <li>• Your plan will be upgraded immediately</li>
                  <li>• You'll be charged the prorated amount today</li>
                  <li>• New features will be available right away</li>
                  <li>• Your next billing cycle will reflect the new plan price</li>
                </>
              ) : (
                <>
                  <li>• Your plan will be downgraded at the end of your current billing period</li>
                  <li>• You'll continue to have access to current features until then</li>
                  <li>• No immediate charges will be applied</li>
                  <li>• You can cancel this downgrade anytime before it takes effect</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className={`flex-1 ${
            isUpgrade 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-yellow-600 hover:bg-yellow-700'
          }`}
          disabled={loading}
        >
          {loading ? (
            'Processing...'
          ) : (
            <>
              {isUpgrade ? (
                <>
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Confirm Upgrade
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4 mr-2" />
                  Confirm Downgrade
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default PlanChangePreview;