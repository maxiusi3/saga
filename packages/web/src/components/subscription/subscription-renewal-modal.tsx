'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  X, 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Shield,
  Clock,
  Zap
} from 'lucide-react';

export interface RenewalPackage {
  id: string;
  name: string;
  price: number;
  duration: number; // in months
  features: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
    interactiveService: boolean;
    archivalAccess: boolean;
    dataExport: boolean;
  };
  isRecommended?: boolean;
  savings?: number; // percentage saved compared to monthly
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface SubscriptionRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectId: string;
  currentExpiryDate: Date;
  availablePackages: RenewalPackage[];
  paymentMethods: PaymentMethod[];
  onRenew: (packageId: string, paymentMethodId: string) => Promise<void>;
  onAddPaymentMethod: () => void;
  loading?: boolean;
  className?: string;
}

export function SubscriptionRenewalModal({
  isOpen,
  onClose,
  projectName,
  projectId,
  currentExpiryDate,
  availablePackages,
  paymentMethods,
  onRenew,
  onAddPaymentMethod,
  loading = false,
  className = ''
}: SubscriptionRenewalModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string>(
    availablePackages.find(p => p.isRecommended)?.id || availablePackages[0]?.id || ''
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(
    paymentMethods.find(pm => pm.isDefault)?.id || paymentMethods[0]?.id || ''
  );
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const selectedPkg = availablePackages.find(p => p.id === selectedPackage);
  const selectedPM = paymentMethods.find(pm => pm.id === selectedPaymentMethod);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const calculateNewExpiryDate = () => {
    if (!selectedPkg) return currentExpiryDate;
    
    const newDate = new Date(Math.max(currentExpiryDate.getTime(), Date.now()));
    newDate.setMonth(newDate.getMonth() + selectedPkg.duration);
    return newDate;
  };

  const handleRenew = async () => {
    if (!selectedPackage || !selectedPaymentMethod) return;

    setIsProcessing(true);
    try {
      await onRenew(selectedPackage, selectedPaymentMethod);
      onClose();
    } catch (error) {
      console.error('Renewal failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Renew Subscription</h2>
            <p className="text-sm text-gray-600 mt-1">
              Extend your subscription for "{projectName}"
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600"
            disabled={isProcessing}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          {/* Current Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Current Subscription</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Your subscription expires on {formatDate(currentExpiryDate)}.
                  {currentExpiryDate < new Date() && (
                    <span className="text-red-600 font-medium"> (Expired)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Package Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Package</h3>
              <div className="space-y-3">
                {availablePackages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedPackage === pkg.id
                        ? 'ring-2 ring-blue-500 border-blue-500'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPackage(pkg.id)}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedPackage === pkg.id
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedPackage === pkg.id && (
                              <div className="w-full h-full rounded-full bg-white scale-50" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{pkg.name}</h4>
                            <p className="text-sm text-gray-600">{pkg.duration} months</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">
                            {formatCurrency(pkg.price)}
                          </div>
                          {pkg.savings && (
                            <Badge variant="secondary" className="text-xs">
                              Save {pkg.savings}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      {pkg.isRecommended && (
                        <div className="flex items-center space-x-2 mb-3">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <Badge variant="default" className="bg-yellow-500">
                            Recommended
                          </Badge>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>• {pkg.features.projectVouchers} Project Vouchers</div>
                        <div>• {pkg.features.facilitatorSeats} Facilitator Seats</div>
                        <div>• {pkg.features.storytellerSeats} Storyteller Seats</div>
                        <div>• Interactive Service</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
              
              {paymentMethods.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {paymentMethods.map((pm) => (
                    <Card
                      key={pm.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        selectedPaymentMethod === pm.id
                          ? 'ring-2 ring-blue-500 border-blue-500'
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPaymentMethod(pm.id)}
                    >
                      <div className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedPaymentMethod === pm.id
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedPaymentMethod === pm.id && (
                              <div className="w-full h-full rounded-full bg-white scale-50" />
                            )}
                          </div>
                          <CreditCard className="h-5 w-5 text-gray-600" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {pm.brand?.toUpperCase()} •••• {pm.last4}
                              </span>
                              {pm.isDefault && (
                                <Badge variant="outline" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            {pm.expiryMonth && pm.expiryYear && (
                              <p className="text-sm text-gray-600">
                                Expires {pm.expiryMonth.toString().padStart(2, '0')}/{pm.expiryYear}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No payment methods available</p>
                </div>
              )}

              <Button
                onClick={onAddPaymentMethod}
                variant="outline"
                className="w-full"
                disabled={isProcessing}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          </div>

          {/* Renewal Summary */}
          {selectedPkg && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Renewal Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Package:</span>
                  <span className="font-medium">{selectedPkg.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{selectedPkg.duration} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current expiry:</span>
                  <span className="font-medium">{formatDate(currentExpiryDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">New expiry:</span>
                  <span className="font-medium text-green-600">
                    {formatDate(calculateNewExpiryDate())}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedPkg.price)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-4 flex items-start space-x-2 text-sm text-gray-600">
            <Shield className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p>
              Your payment information is secure and encrypted. We use industry-standard 
              security measures to protect your data.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenew}
              className="flex-1"
              disabled={!selectedPackage || !selectedPaymentMethod || isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Renew Subscription
                </>
              )}
            </Button>
          </div>

          {/* Terms */}
          <p className="text-xs text-gray-500 text-center mt-4">
            By renewing your subscription, you agree to our{' '}
            <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
            Your subscription will automatically renew unless cancelled.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionRenewalModal;