'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Calendar, 
  Download, 
  CreditCard, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  AlertTriangle,
  FileText,
  Filter,
  Search
} from 'lucide-react';

export interface SubscriptionHistoryItem {
  id: string;
  type: 'renewal' | 'cancellation' | 'payment_failed' | 'refund' | 'upgrade' | 'downgrade';
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  date: Date;
  amount?: number;
  currency: string;
  description: string;
  packageName?: string;
  duration?: number; // in months
  paymentMethod?: {
    type: 'card' | 'apple_pay' | 'google_pay';
    last4?: string;
    brand?: string;
  };
  receiptUrl?: string;
  invoiceNumber?: string;
  metadata?: {
    oldPackage?: string;
    newPackage?: string;
    reason?: string;
    refundAmount?: number;
  };
}

interface SubscriptionHistoryProps {
  history: SubscriptionHistoryItem[];
  onDownloadReceipt?: (historyId: string) => void;
  onDownloadInvoice?: (historyId: string) => void;
  loading?: boolean;
  className?: string;
}

export function SubscriptionHistory({
  history,
  onDownloadReceipt,
  onDownloadInvoice,
  loading = false,
  className = ''
}: SubscriptionHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'renewal' | 'payment' | 'cancellation'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getTypeConfig = (type: SubscriptionHistoryItem['type']) => {
    switch (type) {
      case 'renewal':
        return {
          icon: RefreshCw,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'Renewal'
        };
      case 'cancellation':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          label: 'Cancellation'
        };
      case 'payment_failed':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          label: 'Payment Failed'
        };
      case 'refund':
        return {
          icon: RefreshCw,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: 'Refund'
        };
      case 'upgrade':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'Upgrade'
        };
      case 'downgrade':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          label: 'Downgrade'
        };
      default:
        return {
          icon: Calendar,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          label: 'Event'
        };
    }
  };

  const getStatusBadge = (status: SubscriptionHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const filteredHistory = history.filter(item => {
    const matchesFilter = filter === 'all' || 
      (filter === 'renewal' && item.type === 'renewal') ||
      (filter === 'payment' && ['payment_failed', 'refund'].includes(item.type)) ||
      (filter === 'cancellation' && item.type === 'cancellation');

    const matchesSearch = searchTerm === '' || 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.packageName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Subscription History</h3>
          <p className="text-sm text-gray-600">
            View your complete subscription and billing history
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <Filter className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Events</option>
              <option value="renewal">Renewals</option>
              <option value="payment">Payments</option>
              <option value="cancellation">Cancellations</option>
            </select>
          </div>
        </div>
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No History Found</h4>
          <p className="text-gray-600">
            {searchTerm || filter !== 'all' 
              ? 'No events match your current filters.'
              : 'Your subscription history will appear here.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => {
            const config = getTypeConfig(item.type);
            const Icon = config.icon;

            return (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className={`p-2 rounded-full ${config.bgColor}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900">{config.label}</h4>
                        {getStatusBadge(item.status)}
                        {item.invoiceNumber && (
                          <span className="text-xs text-gray-500">
                            #{item.invoiceNumber}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(item.date)}
                        </span>
                        
                        {item.amount && (
                          <span className="font-medium">
                            {formatCurrency(item.amount, item.currency)}
                          </span>
                        )}
                        
                        {item.packageName && (
                          <span>{item.packageName}</span>
                        )}
                        
                        {item.duration && (
                          <span>{item.duration} months</span>
                        )}
                        
                        {item.paymentMethod && (
                          <span className="flex items-center">
                            <CreditCard className="h-4 w-4 mr-1" />
                            {item.paymentMethod.brand?.toUpperCase()} •••• {item.paymentMethod.last4}
                          </span>
                        )}
                      </div>

                      {/* Additional metadata */}
                      {item.metadata && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          {item.metadata.oldPackage && item.metadata.newPackage && (
                            <p className="text-sm text-gray-700">
                              Changed from {item.metadata.oldPackage} to {item.metadata.newPackage}
                            </p>
                          )}
                          {item.metadata.reason && (
                            <p className="text-sm text-gray-700">
                              Reason: {item.metadata.reason}
                            </p>
                          )}
                          {item.metadata.refundAmount && (
                            <p className="text-sm text-gray-700">
                              Refund amount: {formatCurrency(item.metadata.refundAmount, item.currency)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {item.receiptUrl && onDownloadReceipt && (
                      <Button
                        onClick={() => onDownloadReceipt(item.id)}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Receipt
                      </Button>
                    )}
                    
                    {item.invoiceNumber && onDownloadInvoice && (
                      <Button
                        onClick={() => onDownloadInvoice(item.id)}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Invoice
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {history.length > 0 && (
        <Card className="p-6 bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-4">Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {history.filter(h => h.type === 'renewal' && h.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Successful Renewals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(
                  history
                    .filter(h => h.status === 'completed' && h.amount)
                    .reduce((sum, h) => sum + (h.amount || 0), 0),
                  history[0]?.currency || 'USD'
                )}
              </div>
              <div className="text-sm text-gray-600">Total Spent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {history.filter(h => h.status === 'failed').length}
              </div>
              <div className="text-sm text-gray-600">Failed Payments</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default SubscriptionHistory;