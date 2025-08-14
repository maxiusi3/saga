'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

export interface SubscriptionBannerData {
  status: 'expiring_soon' | 'expired' | 'archived';
  daysUntilExpiry?: number;
  projectName: string;
  projectId: string;
  canRenew: boolean;
}

interface SubscriptionStatusBannerProps {
  subscription: SubscriptionBannerData;
  onRenew?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function SubscriptionStatusBanner({
  subscription,
  onRenew,
  onDismiss,
  className = ''
}: SubscriptionStatusBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const getBannerConfig = () => {
    switch (subscription.status) {
      case 'expiring_soon':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          icon: Clock,
          title: 'Subscription Expiring Soon',
          message: subscription.daysUntilExpiry 
            ? `Your subscription for "${subscription.projectName}" expires in ${subscription.daysUntilExpiry} days.`
            : `Your subscription for "${subscription.projectName}" is expiring soon.`,
          actionText: 'Renew Now',
          urgency: 'medium'
        };
      case 'expired':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          icon: AlertTriangle,
          title: 'Subscription Expired',
          message: `Your subscription for "${subscription.projectName}" has expired. The project is now in archival mode.`,
          actionText: 'Renew Subscription',
          urgency: 'high'
        };
      case 'archived':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          icon: AlertTriangle,
          title: 'Project in Archival Mode',
          message: `"${subscription.projectName}" is in read-only mode. You can view and export stories, but interactive features are disabled.`,
          actionText: 'Reactivate Project',
          urgency: 'low'
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          icon: AlertTriangle,
          title: 'Subscription Notice',
          message: `There's an update about your subscription for "${subscription.projectName}".`,
          actionText: 'View Details',
          urgency: 'low'
        };
    }
  };

  const config = getBannerConfig();
  const Icon = config.icon;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleRenew = () => {
    onRenew?.();
  };

  return (
    <div className={`${config.bgColor} ${config.borderColor} border-l-4 ${className}`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium ${config.textColor}`}>
              {config.title}
            </h3>
            <p className={`text-sm ${config.textColor} mt-1`}>
              {config.message}
            </p>
            
            {/* Additional context for different states */}
            {subscription.status === 'expiring_soon' && subscription.daysUntilExpiry && subscription.daysUntilExpiry <= 7 && (
              <p className={`text-xs ${config.textColor} mt-2 font-medium`}>
                ⚠️ Less than a week remaining! Renew now to avoid service interruption.
              </p>
            )}
            
            {subscription.status === 'expired' && (
              <p className={`text-xs ${config.textColor} mt-2`}>
                Don't worry - your stories are safe. Renew to restore recording and interaction features.
              </p>
            )}
            
            {subscription.status === 'archived' && (
              <p className={`text-xs ${config.textColor} mt-2`}>
                All your stories and data remain accessible. Reactivate to enable recording and interactions.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 ml-4">
          {subscription.canRenew && onRenew && (
            <Button
              onClick={handleRenew}
              size="sm"
              variant={config.urgency === 'high' ? 'default' : 'outline'}
              className={`whitespace-nowrap ${
                config.urgency === 'high' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : config.urgency === 'medium'
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : ''
              }`}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {config.actionText}
            </Button>
          )}
          
          {onDismiss && (
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className={`${config.textColor} hover:bg-white/50`}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator for expiring subscriptions */}
      {subscription.status === 'expiring_soon' && subscription.daysUntilExpiry && (
        <div className="px-4 pb-4">
          <div className="w-full bg-yellow-200 rounded-full h-2">
            <div 
              className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.max(10, (subscription.daysUntilExpiry / 30) * 100)}%` 
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-yellow-700 mt-1">
            <span>Time remaining</span>
            <span>{subscription.daysUntilExpiry} days</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionStatusBanner;