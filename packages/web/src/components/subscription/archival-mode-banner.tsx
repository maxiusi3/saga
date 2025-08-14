'use client';

import React, { useState } from 'react';
import { AlertTriangle, Archive, Download, RefreshCw, X, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export interface ArchivalModeData {
  projectId: string;
  projectName: string;
  subscriptionExpiresAt: Date;
  canRenew: boolean;
  daysInArchival?: number;
  featuresDisabled: string[];
  featuresAvailable: string[];
}

interface ArchivalModeBannerProps {
  archivalData: ArchivalModeData;
  onRenew?: () => void;
  onExport?: () => void;
  onDismiss?: () => void;
  variant?: 'banner' | 'card' | 'modal';
  className?: string;
}

export function ArchivalModeBanner({
  archivalData,
  onRenew,
  onExport,
  onDismiss,
  variant = 'banner',
  className = ''
}: ArchivalModeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed && variant === 'banner') return null;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const BannerContent = () => (
    <div className="bg-blue-50 border-l-4 border-blue-400">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0">
            <Archive className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-blue-800">
              "{archivalData.projectName}" is in Archival Mode
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Your subscription expired on {formatDate(archivalData.subscriptionExpiresAt)}.
              {archivalData.daysInArchival && ` It's been ${archivalData.daysInArchival} days since expiry.`}
            </p>
            
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-2">🔒 Disabled Features:</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  {archivalData.featuresDisabled.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-2">✅ Available Features:</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  {archivalData.featuresAvailable.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 ml-4">
          {archivalData.canRenew && onRenew && (
            <Button
              onClick={onRenew}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reactivate Project
            </Button>
          )}
          
          {onExport && (
            <Button
              onClick={onExport}
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-600 hover:bg-blue-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          )}
          
          {onDismiss && variant === 'banner' && (
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="text-blue-600 hover:bg-blue-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const CardContent = () => (
    <Card className="bg-blue-50 border-blue-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="p-3 bg-blue-100 rounded-full">
              <Archive className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">
              Project in Archival Mode
            </h2>
            <p className="text-blue-800 mb-4">
              "{archivalData.projectName}" entered archival mode on {formatDate(archivalData.subscriptionExpiresAt)}.
              Your stories and data are safe, but some features are temporarily disabled.
            </p>

            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Disabled Features
                  </h3>
                  <ul className="text-sm text-red-600 space-y-2">
                    {archivalData.featuresDisabled.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-400 mr-2">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Available Features
                  </h3>
                  <ul className="text-sm text-green-600 space-y-2">
                    {archivalData.featuresAvailable.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {archivalData.canRenew && onRenew && (
                <Button 
                  onClick={onRenew}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reactivate Project
                </Button>
              )}
              
              {onExport && (
                <Button 
                  onClick={onExport}
                  variant="outline"
                  className="flex-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All Data
                </Button>
              )}
            </div>

            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Good news:</strong> Reactivating your project will immediately restore all features 
                and your family can continue sharing stories right where they left off.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  const ModalContent = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Archive className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Project Archived
              </h2>
            </div>
            {onDismiss && (
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              "{archivalData.projectName}" has been moved to archival mode because your subscription 
              expired on {formatDate(archivalData.subscriptionExpiresAt)}.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-blue-900 mb-2">What does this mean?</h3>
              <p className="text-sm text-blue-800">
                Your stories and data are completely safe and accessible. However, some interactive 
                features have been temporarily disabled to maintain the integrity of your family's 
                storytelling experience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Temporarily Disabled
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {archivalData.featuresDisabled.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Still Available
                </h4>
                <ul className="text-sm text-green-700 space-y-1">
                  {archivalData.featuresAvailable.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {archivalData.canRenew && onRenew && (
              <Button 
                onClick={onRenew}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reactivate Project Now
              </Button>
            )}
            
            {onExport && (
              <Button 
                onClick={onExport}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  switch (variant) {
    case 'card':
      return <div className={className}><CardContent /></div>;
    case 'modal':
      return <ModalContent />;
    default:
      return <div className={className}><BannerContent /></div>;
  }
}

export default ArchivalModeBanner;