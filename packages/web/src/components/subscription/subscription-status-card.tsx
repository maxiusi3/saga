'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Calendar, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export interface SubscriptionStatus {
  status: 'active' | 'expired' | 'expiring_soon' | 'cancelled';
  currentPeriodEnd: Date;
  daysUntilExpiry?: number;
  isArchived: boolean;
  canRenew: boolean;
  renewalUrl?: string;
}

interface SubscriptionStatusCardProps {
  subscription: SubscriptionStatus;
  projectName: string;
  onRenew?: () => void;
  onViewDetails?: () => void;
  className?: string;
}

export function SubscriptionStatusCard({
  subscription,
  projectName,
  onRenew,
  onViewDetails,
  className = ''
}: SubscriptionStatusCardProps) {
  const getStatusConfig = () => {
    switch (subscription.status) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badge: { variant: 'default' as const, text: 'Active' },
          title: 'Subscription Active',
          description: 'Your project is fully active with all features available.'
        };
      case 'expiring_soon':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badge: { variant: 'secondary' as const, text: 'Expiring Soon' },
          title: 'Subscription Expiring Soon',
          description: 'Your subscription will expire soon. Renew to keep all features active.'
        };
      case 'expired':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badge: { variant: 'destructive' as const, text: 'Expired' },
          title: 'Subscription Expired',
          description: 'Your project is now in archival mode. Renew to reactivate all features.'
        };
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badge: { variant: 'outline' as const, text: 'Cancelled' },
          title: 'Subscription Cancelled',
          description: 'Your subscription has been cancelled and will not auto-renew.'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badge: { variant: 'outline' as const, text: 'Unknown' },
          title: 'Subscription Status',
          description: 'Unable to determine subscription status.'
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

  const getProgressValue = () => {
    if (!subscription.daysUntilExpiry) return 0;
    const totalDays = 365; // Assuming 1-year subscriptions
    const remainingDays = Math.max(0, subscription.daysUntilExpiry);
    return (remainingDays / totalDays) * 100;
  };

  const getProgressColor = () => {
    const progress = getProgressValue();
    if (progress > 50) return 'bg-green-500';
    if (progress > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
              <p className="text-sm text-gray-600">{projectName}</p>
            </div>
          </div>
          <Badge variant={config.badge.variant}>{config.badge.text}</Badge>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-700 mb-4">{config.description}</p>

        {/* Subscription Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Expires on
            </span>
            <span className="font-medium text-gray-900">
              {formatDate(subscription.currentPeriodEnd)}
            </span>
          </div>

          {subscription.daysUntilExpiry !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Days remaining
              </span>
              <span className={`font-medium ${
                subscription.daysUntilExpiry > 30 ? 'text-green-600' :
                subscription.daysUntilExpiry > 7 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.max(0, subscription.daysUntilExpiry)} days
              </span>
            </div>
          )}

          {/* Progress Bar for Active/Expiring Subscriptions */}
          {(subscription.status === 'active' || subscription.status === 'expiring_soon') && 
           subscription.daysUntilExpiry !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Time remaining</span>
                <span>{Math.round(getProgressValue())}%</span>
              </div>
              <Progress 
                value={getProgressValue()} 
                className="h-2"
                indicatorClassName={getProgressColor()}
              />
            </div>
          )}
        </div>

        {/* Archival Mode Notice */}
        {subscription.isArchived && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">Archival Mode Active</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Your project is in read-only mode. You can view and export your stories, 
                  but recording and interactions are disabled.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
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
          
          {onViewDetails && (
            <Button 
              onClick={onViewDetails}
              variant="outline"
              className="flex-1"
            >
              View Details
            </Button>
          )}
        </div>

        {/* Quick Actions for Different States */}
        {subscription.status === 'expiring_soon' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 <strong>Tip:</strong> Renew now to avoid any interruption in service. 
              Your stories will remain safe, but interactive features will be disabled after expiry.
            </p>
          </div>
        )}

        {subscription.status === 'expired' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              🔒 <strong>Limited Access:</strong> You can still view and export your stories, 
              but recording and commenting are disabled. Renew to restore full functionality.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default SubscriptionStatusCard;