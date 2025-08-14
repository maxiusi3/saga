import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { SubscriptionOverview } from '../subscription-overview';
import { SubscriptionStatusBanner } from '../subscription-status-banner';
import { SubscriptionRenewalModal } from '../subscription-renewal-modal';
import type { SubscriptionDetails } from '../subscription-overview';
import type { SubscriptionBannerData } from '../subscription-status-banner';
import type { RenewalPackage, PaymentMethod } from '../subscription-renewal-modal';

// Mock UI components
jest.mock('../../ui/card', () => ({
  Card: ({ children, className = '', ...props }: any) => (
    <div className={`card ${className}`} {...props}>{children}</div>
  )
}));

jest.mock('../../ui/button', () => ({
  Button: ({ children, onClick, variant = 'default', size = 'default', disabled = false, className = '', ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}));

jest.mock('../../ui/badge', () => ({
  Badge: ({ children, variant = 'default', className = '' }: any) => (
    <span className={`badge badge-${variant} ${className}`}>{children}</span>
  )
}));

describe('Subscription Management Integration Tests', () => {
  const mockActiveSubscription: SubscriptionDetails = {
    id: 'sub_123',
    status: 'active',
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
    },
    nextBillingDate: new Date('2025-01-01'),
    paymentMethod: {
      type: 'card',
      last4: '4242',
      brand: 'visa'
    }
  };

  const mockExpiringSubscription: SubscriptionDetails = {
    ...mockActiveSubscription,
    status: 'expiring_soon',
    daysUntilExpiry: 7
  };

  const mockExpiredSubscription: SubscriptionDetails = {
    ...mockActiveSubscription,
    status: 'expired',
    daysUntilExpiry: 0,
    isArchived: true
  };

  const mockBannerData: SubscriptionBannerData = {
    status: 'expiring_soon',
    daysUntilExpiry: 7,
    projectName: 'Family Stories',
    projectId: 'proj_123',
    canRenew: true
  };

  const mockRenewalPackages: RenewalPackage[] = [
    {
      id: 'pkg_1year',
      name: 'Annual Package',
      price: 149,
      duration: 12,
      features: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2,
        interactiveService: true,
        archivalAccess: true,
        dataExport: true
      },
      isRecommended: true,
      savings: 20
    }
  ];

  const mockPaymentMethods: PaymentMethod[] = [
    {
      id: 'pm_123',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true
    }
  ];

  describe('SubscriptionOverview Component', () => {
    it('renders active subscription correctly', () => {
      render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
        />
      );

      expect(screen.getByText('Family Stories')).toBeInTheDocument();
      expect(screen.getByText('The Saga Package')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('$149.00')).toBeInTheDocument();
    });

    it('displays usage statistics with progress bars', () => {
      render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
        />
      );

      expect(screen.getByText('1 / 1')).toBeInTheDocument(); // Projects created
      expect(screen.getByText('1 / 2')).toBeInTheDocument(); // Facilitators invited
      expect(screen.getByText('15')).toBeInTheDocument(); // Stories recorded
    });

    it('shows renewal button for active subscription', () => {
      const mockOnRenew = jest.fn();
      render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
          onRenew={mockOnRenew}
        />
      );

      const renewButton = screen.getByText('Extend Subscription');
      expect(renewButton).toBeInTheDocument();
      
      fireEvent.click(renewButton);
      expect(mockOnRenew).toHaveBeenCalledTimes(1);
    });

    it('shows different status for expired subscription', () => {
      render(
        <SubscriptionOverview
          subscription={mockExpiredSubscription}
          projectName="Family Stories"
        />
      );

      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('displays payment method information', () => {
      render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
        />
      );

      expect(screen.getByText('VISA ending in 4242')).toBeInTheDocument();
    });

    it('handles export action', () => {
      const mockOnExport = jest.fn();
      render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByText('Export Data');
      fireEvent.click(exportButton);
      expect(mockOnExport).toHaveBeenCalledTimes(1);
    });
  });

  describe('SubscriptionStatusBanner Component', () => {
    it('renders expiring soon banner correctly', () => {
      render(
        <SubscriptionStatusBanner
          subscription={mockBannerData}
        />
      );

      expect(screen.getByText('Subscription Expiring Soon')).toBeInTheDocument();
      expect(screen.getByText(/expires in 7 days/)).toBeInTheDocument();
      expect(screen.getByText('Renew Now')).toBeInTheDocument();
    });

    it('shows progress indicator for expiring subscription', () => {
      render(
        <SubscriptionStatusBanner
          subscription={mockBannerData}
        />
      );

      expect(screen.getByText('Time remaining')).toBeInTheDocument();
      expect(screen.getByText('7 days')).toBeInTheDocument();
    });

    it('handles renewal action', () => {
      const mockOnRenew = jest.fn();
      render(
        <SubscriptionStatusBanner
          subscription={mockBannerData}
          onRenew={mockOnRenew}
        />
      );

      const renewButton = screen.getByText('Renew Now');
      fireEvent.click(renewButton);
      expect(mockOnRenew).toHaveBeenCalledTimes(1);
    });

    it('can be dismissed', () => {
      const mockOnDismiss = jest.fn();
      render(
        <SubscriptionStatusBanner
          subscription={mockBannerData}
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders expired banner with different styling', () => {
      const expiredBanner: SubscriptionBannerData = {
        ...mockBannerData,
        status: 'expired',
        daysUntilExpiry: 0
      };

      render(
        <SubscriptionStatusBanner
          subscription={expiredBanner}
        />
      );

      expect(screen.getByText('Subscription Expired')).toBeInTheDocument();
      expect(screen.getByText('Renew Subscription')).toBeInTheDocument();
    });
  });

  describe('SubscriptionRenewalModal Component', () => {
    it('renders renewal modal when open', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      expect(screen.getByText('Renew Subscription')).toBeInTheDocument();
      expect(screen.getByText('Extend your subscription for "Family Stories"')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={false}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      expect(screen.queryByText('Renew Subscription')).not.toBeInTheDocument();
    });

    it('displays available packages', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      expect(screen.getByText('Annual Package')).toBeInTheDocument();
      expect(screen.getByText('$149.00')).toBeInTheDocument();
      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('displays payment methods', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      expect(screen.getByText('VISA •••• 4242')).toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('handles package selection', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      const packageCard = screen.getByText('Annual Package').closest('.card');
      expect(packageCard).toBeInTheDocument();
      
      if (packageCard) {
        fireEvent.click(packageCard);
        // Package should be selected (visual feedback would be tested in e2e)
      }
    });

    it('handles renewal submission', async () => {
      const mockOnRenew = jest.fn().mockResolvedValue(undefined);
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={mockOnRenew}
          onAddPaymentMethod={jest.fn()}
        />
      );

      const renewButton = screen.getByText('Renew Subscription');
      fireEvent.click(renewButton);

      await waitFor(() => {
        expect(mockOnRenew).toHaveBeenCalledWith('pkg_1year', 'pm_123');
      });
    });

    it('shows renewal summary', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      expect(screen.getByText('Renewal Summary')).toBeInTheDocument();
      expect(screen.getByText('Annual Package')).toBeInTheDocument();
      expect(screen.getByText('12 months')).toBeInTheDocument();
    });

    it('handles add payment method', () => {
      const mockOnAddPaymentMethod = jest.fn();
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={mockOnAddPaymentMethod}
        />
      );

      const addPaymentButton = screen.getByText('Add Payment Method');
      fireEvent.click(addPaymentButton);
      expect(mockOnAddPaymentMethod).toHaveBeenCalledTimes(1);
    });

    it('disables renewal button when processing', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
          loading={true}
        />
      );

      const renewButton = screen.getByText('Renew Subscription');
      expect(renewButton).toBeDisabled();
    });
  });

  describe('Integration Scenarios', () => {
    it('handles complete renewal flow', async () => {
      const mockOnRenew = jest.fn().mockResolvedValue(undefined);
      const mockOnClose = jest.fn();

      render(
        <div>
          <SubscriptionStatusBanner
            subscription={mockBannerData}
            onRenew={() => {
              // This would typically open the modal
            }}
          />
          <SubscriptionRenewalModal
            isOpen={true}
            onClose={mockOnClose}
            projectName="Family Stories"
            projectId="proj_123"
            currentExpiryDate={new Date('2024-12-31')}
            availablePackages={mockRenewalPackages}
            paymentMethods={mockPaymentMethods}
            onRenew={mockOnRenew}
            onAddPaymentMethod={jest.fn()}
          />
        </div>
      );

      // Complete the renewal
      const renewButton = screen.getByText('Renew Subscription');
      fireEvent.click(renewButton);

      await waitFor(() => {
        expect(mockOnRenew).toHaveBeenCalled();
      });
    });

    it('shows appropriate actions based on subscription status', () => {
      const { rerender } = render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
          onRenew={jest.fn()}
        />
      );

      expect(screen.getByText('Extend Subscription')).toBeInTheDocument();

      // Change to expired subscription
      rerender(
        <SubscriptionOverview
          subscription={mockExpiredSubscription}
          projectName="Family Stories"
          onRenew={jest.fn()}
        />
      );

      expect(screen.getByText('Renew Subscription')).toBeInTheDocument();
    });

    it('handles error states gracefully', () => {
      const subscriptionWithError = {
        ...mockActiveSubscription,
        paymentMethod: undefined
      };

      render(
        <SubscriptionOverview
          subscription={subscriptionWithError}
          projectName="Family Stories"
        />
      );

      // Should still render without payment method
      expect(screen.getByText('Family Stories')).toBeInTheDocument();
      expect(screen.queryByText('VISA ending in')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for interactive elements', () => {
      render(
        <SubscriptionStatusBanner
          subscription={mockBannerData}
          onRenew={jest.fn()}
          onDismiss={jest.fn()}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('maintains focus management in modal', () => {
      render(
        <SubscriptionRenewalModal
          isOpen={true}
          onClose={jest.fn()}
          projectName="Family Stories"
          projectId="proj_123"
          currentExpiryDate={new Date('2024-12-31')}
          availablePackages={mockRenewalPackages}
          paymentMethods={mockPaymentMethods}
          onRenew={jest.fn()}
          onAddPaymentMethod={jest.fn()}
        />
      );

      // Modal should be focusable
      const modal = screen.getByText('Renew Subscription').closest('div');
      expect(modal).toBeInTheDocument();
    });

    it('provides clear status indicators', () => {
      render(
        <SubscriptionOverview
          subscription={mockActiveSubscription}
          projectName="Family Stories"
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      // Check for visual indicators (icons, colors would be tested in e2e)
    });
  });
});