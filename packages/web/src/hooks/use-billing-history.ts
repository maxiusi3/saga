'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface SubscriptionHistoryItem {
  id: string;
  type: 'renewal' | 'cancellation' | 'payment_failed' | 'refund' | 'upgrade' | 'downgrade';
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  date: Date;
  amount?: number;
  currency: string;
  description: string;
  packageName?: string;
  duration?: number;
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

export interface BillingInformationData {
  address: {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact: {
    email: string;
    phone?: string;
  };
  tax: {
    taxId?: string;
    taxIdType?: 'vat' | 'ein' | 'ssn' | 'other';
    taxExempt: boolean;
    taxRate?: number;
  };
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

interface UseBillingHistoryOptions {
  projectId?: string;
  limit?: number;
  autoRefresh?: boolean;
}

interface UseBillingHistoryReturn {
  history: SubscriptionHistoryItem[];
  billingInfo: BillingInformationData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  downloadReceipt: (historyId: string) => Promise<void>;
  downloadInvoice: (historyId: string) => Promise<void>;
  downloadAllInvoices: () => Promise<void>;
  updateBillingInfo: (info: Partial<BillingInformationData>) => Promise<void>;
  updateInvoiceSettings: (settings: BillingInformationData['invoiceSettings']) => Promise<void>;
}

export function useBillingHistory(options: UseBillingHistoryOptions = {}): UseBillingHistoryReturn {
  const { projectId, limit = 50, autoRefresh = false } = options;
  
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [billingInfo, setBillingInfo] = useState<BillingInformationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch subscription history
      const historyUrl = projectId 
        ? `/projects/${projectId}/subscription/history`
        : '/subscription/history';
      
      const historyResponse = await api.get(historyUrl, {
        params: { limit }
      });
      
      if (historyResponse.data.success) {
        const transformedHistory = historyResponse.data.data.map((item: any) => ({
          ...item,
          date: new Date(item.date)
        }));
        setHistory(transformedHistory);
      }

      // Fetch billing information
      const billingResponse = await api.get('/billing/information');
      
      if (billingResponse.data.success) {
        const data = billingResponse.data.data;
        setBillingInfo({
          ...data,
          nextBillingDate: data.nextBillingDate ? new Date(data.nextBillingDate) : undefined
        });
      }

    } catch (err: any) {
      console.error('Error fetching billing data:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch billing information');
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  const downloadReceipt = useCallback(async (historyId: string) => {
    try {
      const response = await api.get(`/billing/receipts/${historyId}/download`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${historyId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error('Error downloading receipt:', err);
      setError(err.response?.data?.error?.message || 'Failed to download receipt');
    }
  }, []);

  const downloadInvoice = useCallback(async (historyId: string) => {
    try {
      const response = await api.get(`/billing/invoices/${historyId}/download`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${historyId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      setError(err.response?.data?.error?.message || 'Failed to download invoice');
    }
  }, []);

  const downloadAllInvoices = useCallback(async () => {
    try {
      const response = await api.get('/billing/invoices/download-all', {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'all-invoices.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error('Error downloading all invoices:', err);
      setError(err.response?.data?.error?.message || 'Failed to download invoices');
    }
  }, []);

  const updateBillingInfo = useCallback(async (info: Partial<BillingInformationData>) => {
    try {
      setError(null);
      const response = await api.put('/billing/information', info);
      
      if (response.data.success) {
        setBillingInfo(prev => prev ? { ...prev, ...info } : null);
      } else {
        setError(response.data.error?.message || 'Failed to update billing information');
      }
    } catch (err: any) {
      console.error('Error updating billing info:', err);
      setError(err.response?.data?.error?.message || 'Failed to update billing information');
    }
  }, []);

  const updateInvoiceSettings = useCallback(async (settings: BillingInformationData['invoiceSettings']) => {
    try {
      setError(null);
      const response = await api.put('/billing/invoice-settings', settings);
      
      if (response.data.success) {
        setBillingInfo(prev => prev ? { ...prev, invoiceSettings: settings } : null);
      } else {
        setError(response.data.error?.message || 'Failed to update invoice settings');
      }
    } catch (err: any) {
      console.error('Error updating invoice settings:', err);
      setError(err.response?.data?.error?.message || 'Failed to update invoice settings');
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  return {
    history,
    billingInfo,
    loading,
    error,
    refresh: fetchData,
    downloadReceipt,
    downloadInvoice,
    downloadAllInvoices,
    updateBillingInfo,
    updateInvoiceSettings
  };
}

// Hook for getting billing summary across all projects
export function useBillingSummary() {
  const [summary, setSummary] = useState<{
    totalSpent: number;
    activeSubscriptions: number;
    upcomingRenewals: number;
    failedPayments: number;
    currency: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/billing/summary');
      
      if (response.data.success) {
        setSummary(response.data.data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch billing summary');
      }
    } catch (err: any) {
      console.error('Error fetching billing summary:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch billing summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary
  };
}

export default useBillingHistory;