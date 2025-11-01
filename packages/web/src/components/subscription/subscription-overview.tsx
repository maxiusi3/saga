'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useTranslations } from 'next-intl';
import { 
  Calendar, 
  CreditCard, 
  Download, 
  Users, 
  MessageSquare, 
  Mic,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

export interface SubscriptionDetails {
  id: string;
  status: 'active' | 'expired' | 'expiring_soon' | 'cancelled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  daysUntilExpiry?: number;
  isArchived: boolean;
  canRenew: boolean;
  packageName: string;
  packagePrice: number;
  features: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
    interactiveService: boolean;
    archivalAccess: boolean;
    dataExport: boolean;
  };
  usage: {
    projectsCreated: number;
    facilitatorsInvited: number;
    storytellersInvited: number;
    storiesRecorded: number;
    interactionsCreated: number;
  };
  nextBillingDate?: Date;
  paymentMethod?: {
    type: 'card' | 'apple_pay' | 'google_pay';
    last4?: string;
    brand?: string;
  };
}

interface SubscriptionOverviewProps {
  subscription: SubscriptionDetails;
  projectName: string;
  onRenew?: () => void;
  onUpdatePayment?: () => void;
  onCancel?: () => void;
  onExport?: () => void;
  className?: string;
}

export function SubscriptionOverview({
  subscription,
  projectName,
  onRenew,
  onUpdatePayment,
  onCancel,
  onExport,
  className = ''
}: SubscriptionOverviewProps) {
  const t = useTranslations('subscription.actions')
  const getStatusConfig = () => {
    switch (subscription.status) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          badge: { variant: 'default' as const, text: 'Active' }
        };
      case 'expiring_soon':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          badge: { variant: 'secondary' as const, text: 'Expiring Soon' }
        };
      case 'expired':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          badge: { variant: 'destructive' as const, text: 'Expired' }
        };
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          badge: { variant: 'outline' as const, text: 'Cancelled' }
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          badge: { variant: 'outline' as const, text: 'Unknown' }
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getUsagePercentage = (used: number, total: number) => {
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Status Overview */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${config.bgColor}`}>
                <Icon className={`h-6 w-6 ${config.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{projectName}</h2>
                <p className="text-sm text-gray-600">{subscription.packageName}</p>
              </div>
            </div>
            <Badge variant={config.badge.variant}>{config.badge.text}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Calendar className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Started</p>
              <p className="font-semibold">{formatDate(subscription.currentPeriodStart)}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {subscription.status === 'expired' ? 'Expired' : 'Expires'}
              </p>
              <p className="font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <CreditCard className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Package Price</p>
              <p className="font-semibold">{formatCurrency(subscription.packagePrice)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Features & Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Package Features */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Features</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-700">Project Vouchers</span>
                </div>
                <span className="font-medium">{subscription.features.projectVouchers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">Facilitator Seats</span>
                </div>
                <span className="font-medium">{subscription.features.facilitatorSeats}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mic className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-gray-700">Storyteller Seats</span>
                </div>
                <span className="font-medium">{subscription.features.storytellerSeats}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-orange-600" />
                  <span className="text-sm text-gray-700">Interactive Service</span>
                </div>
                <span className="font-medium">
                  {subscription.features.interactiveService ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Download className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm text-gray-700">Data Export</span>
                </div>
                <span className="font-medium">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Usage Statistics */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Projects Created</span>
                  <span className="font-medium">
                    {subscription.usage.projectsCreated} / {subscription.features.projectVouchers}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ 
                      width: `${getUsagePercentage(
                        subscription.usage.projectsCreated, 
                        subscription.features.projectVouchers
                      )}%` 
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Facilitators Invited</span>
                  <span className="font-medium">
                    {subscription.usage.facilitatorsInvited} / {subscription.features.facilitatorSeats}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ 
                      width: `${getUsagePercentage(
                        subscription.usage.facilitatorsInvited, 
                        subscription.features.facilitatorSeats
                      )}%` 
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Storytellers Invited</span>
                  <span className="font-medium">
                    {subscription.usage.storytellersInvited} / {subscription.features.storytellerSeats}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ 
                      width: `${getUsagePercentage(
                        subscription.usage.storytellersInvited, 
                        subscription.features.storytellerSeats
                      )}%` 
                    }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Stories Recorded</span>
                  <span className="font-medium text-blue-600">{subscription.usage.storiesRecorded}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-700">Interactions Created</span>
                  <span className="font-medium text-green-600">{subscription.usage.interactionsCreated}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Information */}
      {subscription.paymentMethod && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {subscription.paymentMethod.brand?.toUpperCase()} ending in {subscription.paymentMethod.last4}
                  </p>
                  {subscription.nextBillingDate && (
                    <p className="text-sm text-gray-600">
                      Next billing: {formatDate(subscription.nextBillingDate)}
                    </p>
                  )}
                </div>
              </div>
              {onUpdatePayment && (
                <Button variant="outline" size="sm" onClick={onUpdatePayment}>
                  Update Payment
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            {subscription.canRenew && onRenew && (
              <Button 
                onClick={onRenew}
                className="flex-1"
                variant={subscription.status === 'expired' ? 'default' : 'outline'}
              >
                {subscription.status === 'expired' ? 'Renew Subscription' : 'Extend Subscription'}
              </Button>
            )}
            
            {onExport && (
              <Button onClick={onExport} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            )}
            
            {subscription.status === 'active' && onCancel && (
              <Button onClick={onCancel} variant="outline" className="flex-1 text-red-600 hover:text-red-700">
                {t('cancelSubscription')}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default SubscriptionOverview;