'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit, 
  Check,
  AlertTriangle,
  Shield,
  Smartphone
} from 'lucide-react';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  isExpired?: boolean;
  billingAddress?: {
    name: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface PaymentMethodManagerProps {
  paymentMethods: PaymentMethod[];
  onAdd: () => void;
  onEdit: (paymentMethodId: string) => void;
  onDelete: (paymentMethodId: string) => void;
  onSetDefault: (paymentMethodId: string) => void;
  loading?: boolean;
  className?: string;
}

export function PaymentMethodManager({
  paymentMethods,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
  loading = false,
  className = ''
}: PaymentMethodManagerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const getPaymentMethodIcon = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'apple_pay':
        return <Smartphone className="h-5 w-5 text-gray-600" />;
      case 'google_pay':
        return <Smartphone className="h-5 w-5 text-gray-600" />;
      default:
        return <CreditCard className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPaymentMethodDisplay = (pm: PaymentMethod) => {
    switch (pm.type) {
      case 'apple_pay':
        return 'Apple Pay';
      case 'google_pay':
        return 'Google Pay';
      default:
        return `${pm.brand?.toUpperCase()} •••• ${pm.last4}`;
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    setDeletingId(paymentMethodId);
    try {
      await onDelete(paymentMethodId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    setSettingDefaultId(paymentMethodId);
    try {
      await onSetDefault(paymentMethodId);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const isExpiringSoon = (pm: PaymentMethod) => {
    if (!pm.expiryMonth || !pm.expiryYear) return false;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const expiryDate = new Date(pm.expiryYear, pm.expiryMonth - 1);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    return expiryDate <= threeMonthsFromNow;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
          <p className="text-sm text-gray-600">
            Manage your payment methods for subscription renewals
          </p>
        </div>
        <Button onClick={onAdd} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Method
        </Button>
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <Card className="p-8 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Payment Methods</h4>
          <p className="text-gray-600 mb-4">
            Add a payment method to enable automatic subscription renewals
          </p>
          <Button onClick={onAdd} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Payment Method
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <Card key={pm.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {getPaymentMethodIcon(pm.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {getPaymentMethodDisplay(pm)}
                      </span>
                      
                      {pm.isDefault && (
                        <Badge variant="default" className="text-xs">
                          Default
                        </Badge>
                      )}
                      
                      {pm.isExpired && (
                        <Badge variant="destructive" className="text-xs">
                          Expired
                        </Badge>
                      )}
                      
                      {!pm.isExpired && isExpiringSoon(pm) && (
                        <Badge variant="secondary" className="text-xs">
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {pm.expiryMonth && pm.expiryYear && (
                        <span>
                          Expires {pm.expiryMonth.toString().padStart(2, '0')}/{pm.expiryYear}
                        </span>
                      )}
                      
                      {pm.billingAddress && (
                        <span>
                          {pm.billingAddress.city}, {pm.billingAddress.state}
                        </span>
                      )}
                    </div>
                    
                    {/* Expiry Warning */}
                    {!pm.isExpired && isExpiringSoon(pm) && (
                      <div className="flex items-center space-x-2 mt-2 text-sm text-yellow-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span>This card expires soon. Consider updating it.</span>
                      </div>
                    )}
                    
                    {pm.isExpired && (
                      <div className="flex items-center space-x-2 mt-2 text-sm text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span>This payment method has expired and needs to be updated.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {!pm.isDefault && (
                    <Button
                      onClick={() => handleSetDefault(pm.id)}
                      variant="outline"
                      size="sm"
                      disabled={loading || settingDefaultId === pm.id}
                    >
                      {settingDefaultId === pm.id ? (
                        'Setting...'
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Set Default
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => onEdit(pm.id)}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    onClick={() => handleDelete(pm.id)}
                    variant="outline"
                    size="sm"
                    disabled={loading || deletingId === pm.id || (pm.isDefault && paymentMethods.length === 1)}
                    className="text-red-600 hover:text-red-700"
                  >
                    {deletingId === pm.id ? (
                      'Deleting...'
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Secure Payment Processing</h4>
            <p className="text-sm text-blue-800">
              Your payment information is encrypted and securely stored. We never store your 
              full card details on our servers. All transactions are processed through 
              industry-standard secure payment processors.
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">💡 Tips</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Set a default payment method for automatic subscription renewals</li>
          <li>• Update expiring cards before they expire to avoid service interruption</li>
          <li>• You can have multiple payment methods but only one can be the default</li>
          <li>• Deleting your only payment method will disable automatic renewals</li>
        </ul>
      </div>
    </div>
  );
}

export default PaymentMethodManager;