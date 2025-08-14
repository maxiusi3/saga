'use client';

import React from 'react';
import { Badge } from '../ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

export interface SubscriptionIndicatorData {
  status: 'active' | 'expired' | 'expiring_soon' | 'cancelled';
  daysUntilExpiry?: number;
  isArchived: boolean;
}

interface SubscriptionStatusIndicatorProps {
  subscription: SubscriptionIndicatorData;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function SubscriptionStatusIndicator({
  subscription,
  size = 'md',
  showText = true,
  className = ''
}: SubscriptionStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (subscription.status) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          badge: { variant: 'default' as const, text: 'Active' },
          text: 'Active'
        };
      case 'expiring_soon':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          badge: { variant: 'secondary' as const, text: 'Expiring Soon' },
          text: subscription.daysUntilExpiry 
            ? `${subscription.daysUntilExpiry}d left`
            : 'Expiring Soon'
        };
      case 'expired':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          badge: { variant: 'destructive' as const, text: 'Expired' },
          text: 'Expired'
        };
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          badge: { variant: 'outline' as const, text: 'Cancelled' },
          text: 'Cancelled'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          badge: { variant: 'outline' as const, text: 'Unknown' },
          text: 'Unknown'
        };
    }
  };

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return {
          iconSize: 'h-3 w-3',
          textSize: 'text-xs',
          padding: 'p-1'
        };
      case 'lg':
        return {
          iconSize: 'h-6 w-6',
          textSize: 'text-base',
          padding: 'p-3'
        };
      default: // md
        return {
          iconSize: 'h-4 w-4',
          textSize: 'text-sm',
          padding: 'p-2'
        };
    }
  };

  const config = getStatusConfig();
  const sizeConfig = getSizeConfig();
  const Icon = config.icon;

  if (!showText) {
    // Icon-only version
    return (
      <div className={`inline-flex items-center justify-center rounded-full ${config.bgColor} ${sizeConfig.padding} ${className}`}>
        <Icon className={`${sizeConfig.iconSize} ${config.color}`} />
      </div>
    );
  }

  // Full version with text
  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <div className={`flex items-center justify-center rounded-full ${config.bgColor} ${sizeConfig.padding}`}>
        <Icon className={`${sizeConfig.iconSize} ${config.color}`} />
      </div>
      {showText && (
        <span className={`font-medium ${config.color} ${sizeConfig.textSize}`}>
          {config.text}
        </span>
      )}
      
      {/* Archival indicator */}
      {subscription.isArchived && (
        <Badge variant="outline" className="text-xs">
          Archived
        </Badge>
      )}
    </div>
  );
}

// Compact version for use in lists or tight spaces
export function CompactSubscriptionIndicator({
  subscription,
  className = ''
}: {
  subscription: SubscriptionIndicatorData;
  className?: string;
}) {
  const config = (() => {
    switch (subscription.status) {
      case 'active':
        return { color: 'bg-green-500', text: 'Active' };
      case 'expiring_soon':
        return { color: 'bg-yellow-500', text: subscription.daysUntilExpiry ? `${subscription.daysUntilExpiry}d` : 'Soon' };
      case 'expired':
        return { color: 'bg-red-500', text: 'Expired' };
      case 'cancelled':
        return { color: 'bg-gray-500', text: 'Cancelled' };
      default:
        return { color: 'bg-gray-400', text: '?' };
    }
  })();

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-600">{config.text}</span>
      {subscription.isArchived && (
        <span className="text-xs text-blue-600 font-medium">📁</span>
      )}
    </div>
  );
}

export default SubscriptionStatusIndicator;