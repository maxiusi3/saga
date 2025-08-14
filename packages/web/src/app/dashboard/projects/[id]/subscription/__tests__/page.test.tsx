import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useParams } from 'next/navigation';
import { jest } from '@jest/globals';
import SubscriptionManagementPage from '../page';

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn()
}));

// Mock custom hooks
jest.mock('../../../../../../hooks/use-subscription', () => ({
  useSubscription: jest.fn()
}));

jest.mock('../../../../../../hooks/use-billing-history', () => ({
  useBillingHistory: jest.fn()
}));

// Mock UI components
jest.mock('../../../../../../components/ui/card', () => ({
  Card: ({ children, className = '' }: any) => (
    <div className={`card ${className}`}>{children}</div>
  )
}));

jest.mock('../../../../../../components/ui/button', () => ({
  Button: ({ children, onClick, variant = 'default', disabled = false }: any) => (
    <button onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}));

jest.mock('../../../../../../components/ui/loading', () => ({
  Loading: () => <div data-testid="loading">Loading...</div>
}));

// Mock subscription components
jest.mock('../../../../../../components/subscription/subscription-overview', () => ({
  SubscriptionOverview: ({ subscription, projectName, onRenew, onExport }: any) => (
    <div data-testid="subscription-overview">
      <h3>{projectName}</h3>
      <p>Status: {subscription.status}</p>
      <button onClick={onRenew}>Renew</button>
      <button onClick={onExport}>Export</button>
    </div>
  )
}));

jest.mock('../../../../../../components/subscription/subscription-history', () => ({
  SubscriptionHistory: ({ history, loading }: any) => (
    <div data-testid="subscription-history">
      {loading ? 'Loading history...' : `${history.length} history items`}
    </div>
  )
}));

jest.mock('../../../../../../components/subscription/billing-information', () => ({
  BillingInformation: ({ billingInfo, onEdit }: any) => (
    <div data-testid="billing-information">
      <p>Billing: {billingInfo.email}</p>
      <button onClick={onEdit}>Edit Billing</button>
    </div>
  )
}));

jest.mock('../../../../../../components/subscription/subscription-status-banner', () => ({
  SubscriptionStatusBanner: ({ subscription, onRenew }: any) => (
    <div data-testid="status-banner">
      <p>Banner: {subscription.status}</p>
      <button onClick={onRenew}>Banner Renew</button>
    </div>
  )
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn()
};

const mockUseSubscription = {
  subscription: null,
  loading: false,
  error: null,
  renewSubscription: jest.fn(),
  refresh: jest.fn()
};

const mockUseBillingHistory = {
  history: [],
  billingInfo: null,
  loading: false,
  error: null,
  refresh: jest.fn(),
  downloadReceipt: jest.fn(),
  downloadInvoice: jest.fn(),
  downloadAllInvoices: jest.fn(),
  updateBillingInfo: jest.fn(),
  updateInvoiceSettings: jest.fn()
};

describe('SubscriptionManagementPage', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ id: 'project-123' });
    
    const { useSubscription } = require('../../../../../../hooks/use-subscription');
    const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
    
    useSubscription.mockReturnValue(mockUseSubscription);
    useBillingHistory.mockReturnValue(mockUseBillingHistory);
    
    jest.clearAllMocks();
  });

  describe('Loading States', () => {
    it('shows loading spinner when subscription is loading', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        loading: true
      });

      render(<SubscriptionManagementPage />);
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('shows loading spinner when billing is loading', () => {
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        loading: true
      });

      render(<SubscriptionManagementPage />);
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows error message when subscription fails to load', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        error: 'Failed to load subscription'
      });

      render(<SubscriptionManagementPage />);
      expect(screen.getByText('Failed to load subscription')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('handles retry action on error', async () => {
      const mockRefreshSubscription = jest.fn();
      const mockRefreshBilling = jest.fn();
      
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        error: 'Failed to load subscription',
        refresh: mockRefreshSubscription
      });
      
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        refresh: mockRefreshBilling
      });

      render(<SubscriptionManagementPage />);
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockRefreshSubscription).toHaveBeenCalled();
        expect(mockRefreshBilling).toHaveBeenCalled();
      });
    });

    it('handles go back action on error', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        error: 'Failed to load subscription'
      });

      render(<SubscriptionManagementPage />);
      
      const goBackButton = screen.getByText('Go Back');
      fireEvent.click(goBackButton);

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('No Subscription State', () => {
    it('shows not found message when subscription is null', () => {
      render(<SubscriptionManagementPage />);
      
      expect(screen.getByText('Subscription not found')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });
  });

  describe('Active Subscription', () => {
    const mockActiveSubscription = {
      id: 'sub_123',
      status: 'active',
      projectName: 'Family Stories',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2025-01-01'),
      daysUntilExpiry: 300,
      isArchived: false,
      canRenew: true,
      packageName: 'The Saga Package',
      packagePrice: 149,
      features: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2,
        interactiveService: true,
        archivalAccess: true,
        dataExport: true
      },
      usage: {
        projectsCreated: 1,
        facilitatorsInvited: 1,
        storytellersInvited: 1,
        storiesRecorded: 15,
        interactionsCreated: 8
      }
    };

    beforeEach(() => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: mockActiveSubscription
      });
    });

    it('renders subscription management page with active subscription', () => {
      render(<SubscriptionManagementPage />);

      expect(screen.getByText('Subscription Management')).toBeInTheDocument();
      expect(screen.getByText('Family Stories')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Renew')).toBeInTheDocument();
    });

    it('shows navigation tabs', () => {
      render(<SubscriptionManagementPage />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('defaults to overview tab', () => {
      render(<SubscriptionManagementPage />);

      expect(screen.getByTestId('subscription-overview')).toBeInTheDocument();
      expect(screen.queryByTestId('subscription-history')).not.toBeInTheDocument();
      expect(screen.queryByTestId('billing-information')).not.toBeInTheDocument();
    });

    it('switches to history tab when clicked', () => {
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        history: [{ id: '1', date: new Date(), amount: 149 }]
      });

      render(<SubscriptionManagementPage />);

      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);

      expect(screen.getByTestId('subscription-history')).toBeInTheDocument();
      expect(screen.queryByTestId('subscription-overview')).not.toBeInTheDocument();
    });

    it('switches to billing tab when clicked', () => {
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        billingInfo: { email: 'user@example.com', name: 'John Doe' }
      });

      render(<SubscriptionManagementPage />);

      const billingTab = screen.getByText('Billing');
      fireEvent.click(billingTab);

      expect(screen.getByTestId('billing-information')).toBeInTheDocument();
      expect(screen.queryByTestId('subscription-overview')).not.toBeInTheDocument();
    });

    it('navigates to help page when help tab is clicked', () => {
      render(<SubscriptionManagementPage />);

      const helpTab = screen.getByText('Help');
      fireEvent.click(helpTab);

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/projects/project-123/subscription/help');
    });

    it('handles renewal action', async () => {
      const mockRenewSubscription = jest.fn().mockResolvedValue(undefined);
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: mockActiveSubscription,
        renewSubscription: mockRenewSubscription
      });

      render(<SubscriptionManagementPage />);

      const renewButton = screen.getByText('Renew');
      fireEvent.click(renewButton);

      await waitFor(() => {
        expect(mockRenewSubscription).toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/projects/project-123/subscription/renew');
      });
    });

    it('handles export action from overview', () => {
      render(<SubscriptionManagementPage />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/projects/project-123/export');
    });

    it('handles refresh action', async () => {
      const mockRefreshSubscription = jest.fn();
      const mockRefreshBilling = jest.fn();
      
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: mockActiveSubscription,
        refresh: mockRefreshSubscription
      });
      
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        refresh: mockRefreshBilling
      });

      render(<SubscriptionManagementPage />);

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefreshSubscription).toHaveBeenCalled();
        expect(mockRefreshBilling).toHaveBeenCalled();
      });
    });

    it('handles back navigation', () => {
      render(<SubscriptionManagementPage />);

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('Expiring Subscription', () => {
    const mockExpiringSubscription = {
      id: 'sub_123',
      status: 'expiring_soon',
      projectName: 'Family Stories',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-12-31'),
      daysUntilExpiry: 7,
      isArchived: false,
      canRenew: true,
      packageName: 'The Saga Package',
      packagePrice: 149,
      features: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2,
        interactiveService: true,
        archivalAccess: true,
        dataExport: true
      },
      usage: {
        projectsCreated: 1,
        facilitatorsInvited: 1,
        storytellersInvited: 1,
        storiesRecorded: 15,
        interactionsCreated: 8
      }
    };

    it('shows status banner for expiring subscription', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: mockExpiringSubscription
      });

      render(<SubscriptionManagementPage />);

      expect(screen.getByTestId('status-banner')).toBeInTheDocument();
      expect(screen.getByText('Banner: expiring_soon')).toBeInTheDocument();
    });

    it('shows quick action button for expiring subscription', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: { ...mockExpiringSubscription, daysUntilExpiry: 2 }
      });

      render(<SubscriptionManagementPage />);

      expect(screen.getByText('Renew Now')).toBeInTheDocument();
    });
  });

  describe('Expired Subscription', () => {
    const mockExpiredSubscription = {
      id: 'sub_123',
      status: 'expired',
      projectName: 'Family Stories',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-12-31'),
      daysUntilExpiry: 0,
      isArchived: true,
      canRenew: true,
      packageName: 'The Saga Package',
      packagePrice: 149,
      features: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2,
        interactiveService: false,
        archivalAccess: true,
        dataExport: true
      },
      usage: {
        projectsCreated: 1,
        facilitatorsInvited: 1,
        storytellersInvited: 1,
        storiesRecorded: 15,
        interactionsCreated: 8
      }
    };

    it('shows status banner for expired subscription', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: mockExpiredSubscription
      });

      render(<SubscriptionManagementPage />);

      expect(screen.getByTestId('status-banner')).toBeInTheDocument();
    });

    it('shows reactivate button for expired subscription', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: mockExpiredSubscription
      });

      render(<SubscriptionManagementPage />);

      expect(screen.getByText('Reactivate Now')).toBeInTheDocument();
    });
  });

  describe('Billing Integration', () => {
    const mockBillingInfo = {
      email: 'user@example.com',
      name: 'John Doe',
      address: {
        line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postal_code: '12345',
        country: 'US'
      }
    };

    const mockHistory = [
      { id: '1', date: new Date('2024-01-01'), amount: 149, status: 'paid' },
      { id: '2', date: new Date('2023-01-01'), amount: 149, status: 'paid' }
    ];

    it('displays billing information when available', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: {
          id: 'sub_123',
          status: 'active',
          projectName: 'Family Stories',
          canRenew: true
        }
      });
      
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        billingInfo: mockBillingInfo,
        history: mockHistory
      });

      render(<SubscriptionManagementPage />);

      // Switch to billing tab
      const billingTab = screen.getByText('Billing');
      fireEvent.click(billingTab);

      expect(screen.getByTestId('billing-information')).toBeInTheDocument();
      expect(screen.getByText('Billing: user@example.com')).toBeInTheDocument();
    });

    it('displays subscription history', () => {
      const { useSubscription } = require('../../../../../../hooks/use-subscription');
      const { useBillingHistory } = require('../../../../../../hooks/use-billing-history');
      
      useSubscription.mockReturnValue({
        ...mockUseSubscription,
        subscription: {
          id: 'sub_123',
          status: 'active',
          projectName: 'Family Stories',
          canRenew: true
        }
      });
      
      useBillingHistory.mockReturnValue({
        ...mockUseBillingHistory,
        history: mockHistory
      });

      render(<SubscriptionManagementPage />);

      // Switch to history tab
      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);

      expect(screen.getByTestId('subscription-history')).toBeInTheDocument();
      expect(screen.getByText('2 history items')).toBeInTheDocument();
    });
  });
});