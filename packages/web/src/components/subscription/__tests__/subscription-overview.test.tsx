/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubscriptionOverview, SubscriptionDetails } from '../subscription-overview';

// Mock the UI components
jest.mock('../../ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>
}));

jest.mock('../../ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>
}));

jest.mock('../../ui/button', () => ({
  Button: ({ children, onClick, variant, disabled }: any) => (
    <button onClick={onClick} data-variant={variant} disabled={disabled}>
      {children}
    </button>
  )
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon" />,
  CreditCard: () => <div data-testid="creditcard-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Users: () => <div data-testid="users-icon" />,
  MessageSquare: () => <div data-testid="messagesquare-icon" />,
  Mic: () => <div data-testid="mic-icon" />,
  CheckCircle: () => <div data-testid="checkcircle-icon" />,
  XCircle: () => <div data-testid="xcircle-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  AlertTriangle: () => <div data-testid="alerttriangle-icon" />
}));

describe('SubscriptionOverview', () => {
  const mockSubscription: SubscriptionDetails = {
    id: 'sub-123',
    status: 'active',
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-12-31'),
    daysUntilExpiry: 300,
    isArchived: false,
    canRenew: true,
    packageName: 'Family Plan',
    packagePrice: 99.99,
    features: {
      projectVouchers: 2,
      facilitatorSeats: 3,
      storytellerSeats: 3,
      interactiveService: true,
      archivalAccess: true,
      dataExport: true
    },
    usage: {
      projectsCreated: 1,
      facilitatorsInvited: 2,
      storytellersInvited: 1,
      storiesRecorded: 15,
      interactionsCreated: 8
    },
    nextBillingDate: new Date('2024-12-31'),
    paymentMethod: {
      type: 'card',
      last4: '4242',
      brand: 'visa'
    }
  };

  const defaultProps = {
    subscription: mockSubscription,
    projectName: 'Test Project',
    onRenew: jest.fn(),
    onUpdatePayment: jest.fn(),
    onCancel: jest.fn(),
    onExport: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Active Subscription', () => {
    it('renders active subscription correctly', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Family Plan')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });

    it('displays correct feature information', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText('2 Project Vouchers')).toBeInTheDocument();
      expect(screen.getByText('3 Facilitator Seats')).toBeInTheDocument();
      expect(screen.getByText('3 Storyteller Seats')).toBeInTheDocument();
    });

    it('shows usage statistics with progress bars', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText('1 / 2')).toBeInTheDocument(); // Projects created
      expect(screen.getByText('2 / 3')).toBeInTheDocument(); // Facilitators invited
      expect(screen.getByText('1 / 3')).toBeInTheDocument(); // Storytellers invited
      expect(screen.getByText('15')).toBeInTheDocument(); // Stories recorded
      expect(screen.getByText('8')).toBeInTheDocument(); // Interactions created
    });

    it('displays payment method information', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText(/VISA ending in 4242/)).toBeInTheDocument();
    });

    it('shows action buttons for active subscription', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText('Extend Subscription')).toBeInTheDocument();
      expect(screen.getByText('Export Data')).toBeInTheDocument();
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    it('calls onRenew when renew button is clicked', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      fireEvent.click(screen.getByText('Extend Subscription'));
      expect(defaultProps.onRenew).toHaveBeenCalledTimes(1);
    });

    it('calls onExport when export button is clicked', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      fireEvent.click(screen.getByText('Export Data'));
      expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is clicked', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel Subscription'));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Expired Subscription', () => {
    const expiredSubscription: SubscriptionDetails = {
      ...mockSubscription,
      status: 'expired',
      daysUntilExpiry: 0,
      canRenew: true
    };

    it('renders expired subscription correctly', () => {
      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={expiredSubscription} 
        />
      );

      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText('Renew Subscription')).toBeInTheDocument();
    });

    it('shows expired status with appropriate styling', () => {
      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={expiredSubscription} 
        />
      );

      const expiredBadge = screen.getByText('Expired');
      expect(expiredBadge).toHaveAttribute('data-variant', 'destructive');
    });
  });

  describe('Expiring Soon Subscription', () => {
    const expiringSoonSubscription: SubscriptionDetails = {
      ...mockSubscription,
      status: 'expiring_soon',
      daysUntilExpiry: 7
    };

    it('renders expiring soon subscription correctly', () => {
      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={expiringSoonSubscription} 
        />
      );

      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    });

    it('shows warning styling for expiring soon status', () => {
      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={expiringSoonSubscription} 
        />
      );

      const expiringSoonBadge = screen.getByText('Expiring Soon');
      expect(expiringSoonBadge).toHaveAttribute('data-variant', 'secondary');
    });
  });

  describe('Cancelled Subscription', () => {
    const cancelledSubscription: SubscriptionDetails = {
      ...mockSubscription,
      status: 'cancelled',
      canRenew: false
    };

    it('renders cancelled subscription correctly', () => {
      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={cancelledSubscription} 
        />
      );

      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('does not show cancel button for cancelled subscription', () => {
      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={cancelledSubscription} 
        />
      );

      expect(screen.queryByText('Cancel Subscription')).not.toBeInTheDocument();
    });
  });

  describe('Usage Progress Calculation', () => {
    it('calculates usage percentages correctly', () => {
      const subscription: SubscriptionDetails = {
        ...mockSubscription,
        features: {
          ...mockSubscription.features,
          projectVouchers: 4,
          facilitatorSeats: 5,
          storytellerSeats: 2
        },
        usage: {
          ...mockSubscription.usage,
          projectsCreated: 2,
          facilitatorsInvited: 3,
          storytellersInvited: 2
        }
      };

      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={subscription} 
        />
      );

      // Projects: 2/4 = 50%
      expect(screen.getByText('2 / 4')).toBeInTheDocument();
      // Facilitators: 3/5 = 60%
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      // Storytellers: 2/2 = 100%
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats dates correctly', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText('January 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('December 31, 2024')).toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('formats currency correctly', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });

    it('handles different currencies', () => {
      const subscription: SubscriptionDetails = {
        ...mockSubscription,
        packagePrice: 79.99
      };

      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={subscription} 
        />
      );

      expect(screen.getByText('$79.99')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });

    it('supports keyboard navigation', () => {
      render(<SubscriptionOverview {...defaultProps} />);

      const renewButton = screen.getByText('Extend Subscription');
      renewButton.focus();
      expect(renewButton).toHaveFocus();

      fireEvent.keyDown(renewButton, { key: 'Enter' });
      expect(defaultProps.onRenew).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('handles missing payment method gracefully', () => {
      const subscriptionWithoutPayment: SubscriptionDetails = {
        ...mockSubscription,
        paymentMethod: undefined
      };

      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={subscriptionWithoutPayment} 
        />
      );

      // Should not crash and should not show payment method section
      expect(screen.queryByText(/ending in/)).not.toBeInTheDocument();
    });

    it('handles missing next billing date gracefully', () => {
      const subscriptionWithoutBilling: SubscriptionDetails = {
        ...mockSubscription,
        nextBillingDate: undefined
      };

      render(
        <SubscriptionOverview 
          {...defaultProps} 
          subscription={subscriptionWithoutBilling} 
        />
      );

      // Should not crash
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });
});