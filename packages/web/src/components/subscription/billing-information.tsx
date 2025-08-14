'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CreditCard, 
  MapPin, 
  Mail, 
  Phone, 
  Building, 
  Edit, 
  Download,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

export interface BillingAddress {
  name: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BillingContact {
  email: string;
  phone?: string;
}

export interface TaxInformation {
  taxId?: string;
  taxIdType?: 'vat' | 'ein' | 'ssn' | 'other';
  taxExempt: boolean;
  taxRate?: number;
}

export interface BillingInformationData {
  address: BillingAddress;
  contact: BillingContact;
  tax: TaxInformation;
  currency: string;
  timezone: string;
  invoiceSettings: {
    autoSend: boolean;
    emailDelivery: boolean;
    paperDelivery: boolean;
    language: string;
  };
  nextBillingDate?: Date;
  billingCycle: 'monthly' | 'yearly';
  currentBalance: number;
  outstandingInvoices: number;
}

interface BillingInformationProps {
  billingInfo: BillingInformationData;
  onEdit: () => void;
  onDownloadInvoices: () => void;
  onUpdateSettings: (settings: any) => void;
  loading?: boolean;
  className?: string;
}

export function BillingInformation({
  billingInfo,
  onEdit,
  onDownloadInvoices,
  onUpdateSettings,
  loading = false,
  className = ''
}: BillingInformationProps) {
  const [editingSettings, setEditingSettings] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState(billingInfo.invoiceSettings);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: billingInfo.currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const handleSaveSettings = async () => {
    try {
      await onUpdateSettings(invoiceSettings);
      setEditingSettings(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Billing Information</h3>
          <p className="text-sm text-gray-600">
            Manage your billing details and invoice preferences
          </p>
        </div>
        <Button onClick={onEdit} variant="outline" disabled={loading}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Details
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billing Address */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-gray-600" />
              Billing Address
            </h4>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="font-medium text-gray-900">{billingInfo.address.name}</div>
            {billingInfo.address.company && (
              <div className="text-gray-700">{billingInfo.address.company}</div>
            )}
            <div className="text-gray-700">{billingInfo.address.line1}</div>
            {billingInfo.address.line2 && (
              <div className="text-gray-700">{billingInfo.address.line2}</div>
            )}
            <div className="text-gray-700">
              {billingInfo.address.city}, {billingInfo.address.state} {billingInfo.address.postalCode}
            </div>
            <div className="text-gray-700">{billingInfo.address.country}</div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-gray-600" />
              Contact Information
            </h4>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">{billingInfo.contact.email}</span>
            </div>
            {billingInfo.contact.phone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{billingInfo.contact.phone}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Tax Information */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-600" />
              Tax Information
            </h4>
          </div>
          
          <div className="space-y-3">
            {billingInfo.tax.taxId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tax ID:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.tax.taxId} ({billingInfo.tax.taxIdType?.toUpperCase()})
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tax Exempt:</span>
              <div className="flex items-center space-x-2">
                {billingInfo.tax.taxExempt ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-sm text-gray-900">No</span>
                )}
              </div>
            </div>
            
            {billingInfo.tax.taxRate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tax Rate:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.tax.taxRate}%
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Billing Summary */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-gray-600" />
              Billing Summary
            </h4>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Currency:</span>
              <span className="text-sm font-medium text-gray-900">
                {billingInfo.currency.toUpperCase()}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Billing Cycle:</span>
              <Badge variant="outline" className="text-xs">
                {billingInfo.billingCycle}
              </Badge>
            </div>
            
            {billingInfo.nextBillingDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Next Billing:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(billingInfo.nextBillingDate)}
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Balance:</span>
              <span className={`text-sm font-medium ${
                billingInfo.currentBalance > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(billingInfo.currentBalance)}
              </span>
            </div>
            
            {billingInfo.outstandingInvoices > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Outstanding Invoices:</span>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">
                    {billingInfo.outstandingInvoices}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Invoice Settings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-gray-600" />
            Invoice Settings
          </h4>
          <div className="flex items-center space-x-2">
            <Button onClick={onDownloadInvoices} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download All
            </Button>
            <Button 
              onClick={() => setEditingSettings(!editingSettings)} 
              variant="outline" 
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              {editingSettings ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </div>

        {editingSettings ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={invoiceSettings.autoSend}
                    onChange={(e) => setInvoiceSettings(prev => ({
                      ...prev,
                      autoSend: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Auto-send invoices</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={invoiceSettings.emailDelivery}
                    onChange={(e) => setInvoiceSettings(prev => ({
                      ...prev,
                      emailDelivery: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Email delivery</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={invoiceSettings.paperDelivery}
                    onChange={(e) => setInvoiceSettings(prev => ({
                      ...prev,
                      paperDelivery: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Paper delivery</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Language
                </label>
                <select
                  value={invoiceSettings.language}
                  onChange={(e) => setInvoiceSettings(prev => ({
                    ...prev,
                    language: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button 
                onClick={() => setEditingSettings(false)} 
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={loading}>
                Save Settings
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Auto-send invoices:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.invoiceSettings.autoSend ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email delivery:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.invoiceSettings.emailDelivery ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Paper delivery:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.invoiceSettings.paperDelivery ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Language:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.invoiceSettings.language.toUpperCase()}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Timezone:</span>
                <span className="text-sm font-medium text-gray-900">
                  {billingInfo.timezone}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Outstanding Balance Warning */}
      {billingInfo.currentBalance > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Outstanding Balance</h4>
              <p className="text-sm text-red-800 mt-1">
                You have an outstanding balance of {formatCurrency(billingInfo.currentBalance)}. 
                Please update your payment method or contact support if you need assistance.
              </p>
              <div className="mt-3">
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  Pay Now
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default BillingInformation;