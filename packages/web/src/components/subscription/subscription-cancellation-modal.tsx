'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  X, 
  AlertTriangle, 
  Calendar, 
  Download,
  MessageSquare,
  Mic,
  Users,
  CheckCircle,
  XCircle,
  ArrowRight
} from 'lucide-react';

export interface CancellationReason {
  id: string;
  label: string;
  description: string;
  category: 'cost' | 'usage' | 'technical' | 'other';
}

export interface CancellationData {
  projectId: string;
  projectName: string;
  currentPeriodEnd: Date;
  subscriptionValue: number;
  currency: string;
  storiesCount: number;
  interactionsCount: number;
  facilitatorsCount: number;
  canRetainAccess: boolean;
  archivalDate: Date;
}

interface SubscriptionCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cancellationData: CancellationData;
  onCancel: (reason: string, feedback: string, retainAccess: boolean) => Promise<void>;
  onExportFirst: () => void;
  loading?: boolean;
  className?: string;
}

const CANCELLATION_REASONS: CancellationReason[] = [
  {
    id: 'too_expensive',
    label: 'Too expensive',
    description: 'The subscription cost is higher than expected',
    category: 'cost'
  },
  {
    id: 'not_using',
    label: 'Not using enough',
    description: 'Family is not actively using the service',
    category: 'usage'
  },
  {
    id: 'completed_project',
    label: 'Project completed',
    description: 'We have finished collecting the stories we wanted',
    category: 'usage'
  },
  {
    id: 'technical_issues',
    label: 'Technical problems',
    description: 'Experiencing bugs or technical difficulties',
    category: 'technical'
  },
  {
    id: 'missing_features',
    label: 'Missing features',
    description: 'The service lacks features we need',
    category: 'technical'
  },
  {
    id: 'family_circumstances',
    label: 'Family circumstances',
    description: 'Changes in family situation or availability',
    category: 'other'
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Different reason not listed above',
    category: 'other'
  }
];

export function SubscriptionCancellationModal({
  isOpen,
  onClose,
  cancellationData,
  onCancel,
  onExportFirst,
  loading = false,
  className = ''
}: SubscriptionCancellationModalProps) {
  const [step, setStep] = useState<'warning' | 'reason' | 'confirmation' | 'processing'>('warning');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [retainAccess, setRetainAccess] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cancellationData.currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const handleCancel = async () => {
    if (!selectedReason) return;

    setIsProcessing(true);
    setStep('processing');
    
    try {
      await onCancel(selectedReason, feedback, retainAccess);
      onClose();
    } catch (error) {
      console.error('Cancellation failed:', error);
      setStep('confirmation');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderWarningStep = () => (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Cancel Subscription</h2>
            <p className="text-sm text-gray-600">{cancellationData.projectName}</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Impact Warning */}
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-2">What happens when you cancel?</h3>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• Your subscription will end on {formatDate(cancellationData.currentPeriodEnd)}</li>
                <li>• Recording and interaction features will be disabled</li>
                <li>• Your project will enter archival mode on {formatDate(cancellationData.archivalDate)}</li>
                <li>• You'll lose access to AI-powered features and chapter summaries</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Project Value */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">Your Project So Far</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{cancellationData.storiesCount}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center">
                <Mic className="h-4 w-4 mr-1" />
                Stories
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{cancellationData.interactionsCount}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 mr-1" />
                Interactions
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{cancellationData.facilitatorsCount}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center">
                <Users className="h-4 w-4 mr-1" />
                Facilitators
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(cancellationData.subscriptionValue)}
              </div>
              <div className="text-sm text-gray-600">Investment</div>
            </div>
          </div>
        </Card>

        {/* What You'll Keep */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-2">What you'll keep in archival mode:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Full access to all recorded stories and transcripts</li>
                <li>• Ability to view all family interactions and comments</li>
                <li>• Complete data export functionality</li>
                <li>• All photos and media attachments</li>
                <li>• Existing chapter summaries</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Export Recommendation */}
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <Download className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-900 mb-2">Recommended: Export Your Data First</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Before cancelling, we recommend exporting your complete project data. 
                This ensures you have a permanent backup of all your family stories.
              </p>
              <Button
                onClick={onExportFirst}
                variant="outline"
                size="sm"
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data First
              </Button>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Keep Subscription
          </Button>
          <Button
            onClick={() => setStep('reason')}
            variant="destructive"
            className="flex-1"
          >
            Continue Cancellation
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderReasonStep = () => (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Help Us Improve</h2>
          <p className="text-sm text-gray-600">Why are you cancelling your subscription?</p>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Reason Selection */}
        <div className="space-y-3">
          {CANCELLATION_REASONS.map((reason) => (
            <Card
              key={reason.id}
              className={`cursor-pointer transition-all duration-200 ${
                selectedReason === reason.id
                  ? 'ring-2 ring-blue-500 border-blue-500'
                  : 'hover:border-gray-300'
              }`}
              onClick={() => setSelectedReason(reason.id)}
            >
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 ${
                    selectedReason === reason.id
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedReason === reason.id && (
                      <div className="w-full h-full rounded-full bg-white scale-50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{reason.label}</h4>
                    <p className="text-sm text-gray-600 mt-1">{reason.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Additional Feedback */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional feedback (optional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Help us understand how we could have better served your family's storytelling needs..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Retain Access Option */}
        {cancellationData.canRetainAccess && (
          <Card className="p-4 bg-green-50 border-green-200">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={retainAccess}
                onChange={(e) => setRetainAccess(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <div className="font-medium text-green-900">Retain archival access</div>
                <div className="text-sm text-green-800 mt-1">
                  Keep your project in archival mode so you can still view and export your stories. 
                  You can reactivate anytime by renewing your subscription.
                </div>
              </div>
            </label>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setStep('warning')}
            variant="outline"
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={() => setStep('confirmation')}
            variant="destructive"
            className="flex-1"
            disabled={!selectedReason}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Confirm Cancellation</h2>
          <p className="text-sm text-gray-600">Please review your cancellation details</p>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Cancellation Summary */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">Cancellation Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Project:</span>
              <span className="font-medium">{cancellationData.projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reason:</span>
              <span className="font-medium">
                {CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Subscription ends:</span>
              <span className="font-medium">{formatDate(cancellationData.currentPeriodEnd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Archival mode starts:</span>
              <span className="font-medium">{formatDate(cancellationData.archivalDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Retain access:</span>
              <span className="font-medium">
                {retainAccess ? 'Yes (Archival mode)' : 'No (Full deletion)'}
              </span>
            </div>
          </div>
        </Card>

        {/* Final Warning */}
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-2">This action cannot be undone</h3>
              <p className="text-sm text-red-800">
                Once cancelled, you'll lose access to interactive features immediately. 
                {!retainAccess && ' Your project data will be permanently deleted after the archival period.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Final Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setStep('reason')}
            variant="outline"
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleCancel}
            variant="destructive"
            className="flex-1"
            disabled={isProcessing}
          >
            {isProcessing ? 'Cancelling...' : 'Cancel Subscription'}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="p-6 text-center">
      <div className="space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto" />
        <h2 className="text-xl font-semibold text-gray-900">Cancelling Subscription</h2>
        <p className="text-gray-600">
          Please wait while we process your cancellation request...
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto ${className}`}>
        {step === 'warning' && renderWarningStep()}
        {step === 'reason' && renderReasonStep()}
        {step === 'confirmation' && renderConfirmationStep()}
        {step === 'processing' && renderProcessingStep()}
      </div>
    </div>
  );
}

export default SubscriptionCancellationModal;