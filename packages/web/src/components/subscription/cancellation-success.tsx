'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CheckCircle, 
  Calendar, 
  Download, 
  RefreshCw,
  Mail,
  MessageSquare,
  ArrowRight,
  Heart
} from 'lucide-react';

export interface CancellationSuccessData {
  projectId: string;
  projectName: string;
  cancellationDate: Date;
  subscriptionEndDate: Date;
  archivalStartDate: Date;
  retainAccess: boolean;
  reason: string;
  refundAmount?: number;
  currency: string;
  storiesCount: number;
  interactionsCount: number;
}

interface CancellationSuccessProps {
  cancellationData: CancellationSuccessData;
  onExportData: () => void;
  onReactivate: () => void;
  onBackToDashboard: () => void;
  onProvideFeedback: () => void;
  className?: string;
}

export function CancellationSuccess({
  cancellationData,
  onExportData,
  onReactivate,
  onBackToDashboard,
  onProvideFeedback,
  className = ''
}: CancellationSuccessProps) {
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
      currency: cancellationData.currency.toUpperCase()
    }).format(amount);
  };

  return (
    <div className={`max-w-4xl mx-auto space-y-8 ${className}`}>
      {/* Success Header */}
      <Card className="p-8 text-center bg-green-50 border-green-200">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-900 mb-2">
              Subscription Cancelled Successfully
            </h1>
            <p className="text-green-800">
              Your subscription for "{cancellationData.projectName}" has been cancelled as requested.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cancellation Details */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-gray-600" />
            Cancellation Details
          </h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cancelled on:</span>
              <span className="font-medium">{formatDate(cancellationData.cancellationDate)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Subscription ends:</span>
              <span className="font-medium">{formatDate(cancellationData.subscriptionEndDate)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Archival mode starts:</span>
              <span className="font-medium">{formatDate(cancellationData.archivalStartDate)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Access retained:</span>
              <Badge variant={cancellationData.retainAccess ? 'default' : 'destructive'}>
                {cancellationData.retainAccess ? 'Yes (Archival)' : 'No (Deleted)'}
              </Badge>
            </div>
            
            {cancellationData.refundAmount && (
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-600">Refund amount:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(cancellationData.refundAmount)}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Project Summary */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Heart className="h-5 w-5 mr-2 text-red-500" />
            Your Story Legacy
          </h2>
          
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Thank you for sharing your family's stories with us. Here's what you've created:
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{cancellationData.storiesCount}</div>
                  <div className="text-sm text-blue-800">Stories Recorded</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{cancellationData.interactionsCount}</div>
                  <div className="text-sm text-green-800">Family Interactions</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* What Happens Next */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">What Happens Next?</h2>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">1</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Until {formatDate(cancellationData.subscriptionEndDate)}</h3>
              <p className="text-sm text-gray-600">
                Your subscription remains active with full access to all features. 
                You can continue recording stories and interacting with family members.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-yellow-600">2</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Starting {formatDate(cancellationData.archivalStartDate)}</h3>
              <p className="text-sm text-gray-600">
                {cancellationData.retainAccess 
                  ? 'Your project enters archival mode. You can view and export all stories, but recording and interactions will be disabled.'
                  : 'Your project data will be permanently deleted. Make sure to export your data before this date.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-green-600">3</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Anytime</h3>
              <p className="text-sm text-gray-600">
                You can reactivate your subscription at any time to restore full functionality 
                and continue your family's storytelling journey.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Recommended Actions */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Recommended Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={onExportData}
            variant="outline"
            className="flex items-center justify-center text-blue-700 border-blue-300 hover:bg-blue-100"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Your Stories
          </Button>
          
          <Button
            onClick={onProvideFeedback}
            variant="outline"
            className="flex items-center justify-center text-blue-700 border-blue-300 hover:bg-blue-100"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Share Feedback
          </Button>
        </div>
        
        <p className="text-sm text-blue-800 mt-4 text-center">
          💡 We recommend exporting your data now to ensure you have a permanent backup 
          of all your family stories and memories.
        </p>
      </Card>

      {/* Change Your Mind */}
      <Card className="p-6 bg-gray-50">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Changed Your Mind?</h2>
          <p className="text-gray-600">
            You can reactivate your subscription anytime before {formatDate(cancellationData.archivalStartDate)} 
            to restore full access to all features.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={onReactivate}
              className="bg-green-600 hover:bg-green-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reactivate Subscription
            </Button>
            
            <Button
              onClick={onBackToDashboard}
              variant="outline"
            >
              Back to Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Email Notice */}
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-start space-x-3">
          <Mail className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-900">Confirmation Email Sent</h3>
            <p className="text-sm text-yellow-800 mt-1">
              We've sent a confirmation email with all the details of your cancellation. 
              If you don't see it in your inbox, please check your spam folder.
            </p>
          </div>
        </div>
      </Card>

      {/* Support */}
      <div className="text-center text-gray-600">
        <p className="text-sm">
          Need help or have questions? {' '}
          <a href="/support" className="text-blue-600 hover:underline">
            Contact our support team
          </a>
          {' '} - we're here to help.
        </p>
      </div>
    </div>
  );
}

export default CancellationSuccess;