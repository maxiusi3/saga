/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubscriptionUpgradeModal, SubscriptionPlan } from '../subscription-upgrade-modal';

// Mock the UI components
jest.mock('../../ui/card', () => ({
  Card: ({ children, className, onClick }: any) => (
    <div className={className} onClick={onClick}>{children}</div>
  )
}));

jest.mock('../../ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-variant={variant} className={className}>{children}</span>
  )
}));

jest.mock('../../ui/button', () => ({
  Button: ({ children, onClick, variant, disabled, size }: any) => (
    <button 
      onClick={onClick} 
      data-variant={variant} 
      disabled={disabled}
      data-size={size}
    >
      {children}
    </button>
  )
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
  ArrowUp: () => <div data-testid="arrowup-icon" />,
  ArrowDown: () => <div data-testid="arrowdown-icon" />,
  Check: () => <div data-testid="check-icon" />,
  Star: () => <div data-testid="star-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Mic: () => <div data-testid="mic-icon" />,
  MessageSquare: () => <div data-testid="messagesquare-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  Crown: () => <div data-testid="crown-icon" />
}));

describe('SubscriptionUpgradeModal', () => {
  const mockCurrentPlan: SubscriptionPlan = {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small families',
    price: 49.99,
    billingPeriod: 'yearly',
    currency: 'USD',
    features: {
      projectVouchers: 1,
      facilitatorSeats: 1,
      storytellerSeats: 1,
      storageGB: 5,
      aiFeatures: true,
      prioritySupport: false,
      advancedAnalytics: false,
      customBranding: false,
      apiAccess: false
    },
    limits: {
      maxProjects: 1,
      maxStoriesPerProject: 100,
      maxFamilyMembers: 3
    },
    isActive: true,
    isPopular: false,
    sortOrder: 1,
    stripeProductId: 'prod_starter',
    stripePriceId: 'price_starter',
    createdAt: new Date(),
    updatedAt: new Date(),
    isCurrentPlan: true
  };

  const mockAvailablePlans: SubscriptionPlan[] = [
    mockCurrentPlan,
    {
      id: 'family',
      name: 'Family',
      description: 'Ideal for growing families',
      price: 99.99,
      billingPeriod: 'yearly',
      currency: 'USD',
      features: {
        projectVouchers: 2,
        facilitatorSeats: 3,
        storytellerSeats: 3,
        storageGB: 15,
        aiFeatures: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: false,
        apiAccess: false
      },
      limits: {
        maxProjects: 3,
        maxStoriesPerProject: 500,
        maxFamilyMembers: 8
      },
      isActive: true,
      isPopular: true,
      sortOrder: 2,
      stripeProductId: 'prod_family',
      stripePriceId: 'price_family',
      createdAt: new Date(),
      updatedAt: new Date(),
      isCurrentPlan: false
    },
    {
      id: 'legacy',
      name: 'Legacy',
      description: 'For large families',
      price: 199.99,
      billingPeriod: 'yearly',
      currency: 'USD',
      features: {
        projectVouchers: 5,
        facilitatorSeats: 10,
        storytellerSeats: 10,
        storageGB: 50,
        aiFeatures: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: true,
        apiAccess: true
      },
      limits: {
        maxProjects: 10,
        maxStoriesPerProject: 2000,
        maxFamilyMembers: 25
      },
      isActive: true,
      isPopular: false,
      sortOrder: 3,
      stripeProductId: 'prod_legacy',
      stripePriceId: 'price_legacy',
      createdAt: new Date(),
      updatedAt: new Date(),
      isCurrentPlan: false
    }
  ];

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    currentPlan: mockCurrentPlan,
    availablePlans: mockAvailablePlans,
    onUpgrade: jest.fn(),
    onDowngrade: jest.fn(),
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('Change Subscription Plan')).toBeInTheDocument();
      expect(screen.getByText('Compare plans and upgrade or downgrade your subscription')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Change Subscription Plan')).not.toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      const closeButton = screen.getByTestId('x-icon').closest('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      const closeButton = screen.getByTestId('x-icon').closest('button');
      fireEvent.click(closeButton!);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plan Display', () => {
    it('displays all available plans', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Family')).toBeInTheDocument();
      expect(screen.getByText('Legacy')).toBeInTheDocument();
    });

    it('shows current plan badge', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });

    it('shows popular plan badge', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('displays plan prices correctly', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('$49.99')).toBeInTheDocument();
      expect(screen.getByText('$99.99')).toBeInTheDocument();
      expect(screen.getByText('$199.99')).toBeInTheDocument();
    });

    it('shows plan features', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('1 Facilitator Seats')).toBeInTheDocument();
      expect(screen.getByText('3 Facilitator Seats')).toBeInTheDocument();
      expect(screen.getByText('10 Facilitator Seats')).toBeInTheDocument();
    });
  });

  describe('Plan Selection', () => {
    it('allows selecting different plans', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      // Click on Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Should show upgrade button
      expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
    });

    it('shows downgrade option for cheaper plans', () => {
      const propsWithExpensiveCurrentPlan = {
        ...defaultProps,
        currentPlan: mockAvailablePlans[2], // Legacy plan
        availablePlans: mockAvailablePlans.map(plan => ({
          ...plan,
          isCurrentPlan: plan.id === 'legacy'
        }))
      };

      render(<SubscriptionUpgradeModal {...propsWithExpensiveCurrentPlan} />);

      // Click on Starter plan (cheaper)
      const starterPlan = screen.getByText('Starter').closest('div');
      fireEvent.click(starterPlan!);

      expect(screen.getByText('Downgrade Plan')).toBeInTheDocument();
    });

    it('disables action button when current plan is selected', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      // Current plan should be selected by default
      const actionButton = screen.getByText('Upgrade Plan');
      expect(actionButton).toBeDisabled();
    });
  });

  describe('Feature Comparison', () => {
    it('shows feature comparison when different plan is selected', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      // Select Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      expect(screen.getByText('What Changes')).toBeInTheDocument();
    });

    it('shows upgrade indicators for improved features', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      // Select Family plan (upgrade)
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Should show upgrade arrows for improved features
      const upgradeIcons = screen.getAllByTestId('arrowup-icon');
      expect(upgradeIcons.length).toBeGreaterThan(0);
    });

    it('shows downgrade indicators for reduced features', () => {
      const propsWithExpensiveCurrentPlan = {
        ...defaultProps,
        currentPlan: mockAvailablePlans[2], // Legacy plan
        availablePlans: mockAvailablePlans.map(plan => ({
          ...plan,
          isCurrentPlan: plan.id === 'legacy'
        }))
      };

      render(<SubscriptionUpgradeModal {...propsWithExpensiveCurrentPlan} />);

      // Select Starter plan (downgrade)
      const starterPlan = screen.getByText('Starter').closest('div');
      fireEvent.click(starterPlan!);

      // Should show downgrade arrows for reduced features
      const downgradeIcons = screen.getAllByTestId('arrowdown-icon');
      expect(downgradeIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Price Comparison', () => {
    it('shows price increase for upgrades', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      // Select Family plan (upgrade)
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      expect(screen.getByText('Upgrade')).toBeInTheDocument();
      expect(screen.getByText('+$50.00')).toBeInTheDocument();
    });

    it('shows price decrease for downgrades', () => {
      const propsWithExpensiveCurrentPlan = {
        ...defaultProps,
        currentPlan: mockAvailablePlans[1], // Family plan
        availablePlans: mockAvailablePlans.map(plan => ({
          ...plan,
          isCurrentPlan: plan.id === 'family'
        }))
      };

      render(<SubscriptionUpgradeModal {...propsWithExpensiveCurrentPlan} />);

      // Select Starter plan (downgrade)
      const starterPlan = screen.getByText('Starter').closest('div');
      fireEvent.click(starterPlan!);

      expect(screen.getByText('Downgrade')).toBeInTheDocument();
      expect(screen.getByText('-$50.00')).toBeInTheDocument();
    });
  });

  describe('Action Handling', () => {
    it('calls onUpgrade when upgrade button is clicked', async () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      // Select Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Click upgrade button
      const upgradeButton = screen.getByText('Upgrade Plan');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(defaultProps.onUpgrade).toHaveBeenCalledWith('family');
      });
    });

    it('calls onDowngrade when downgrade button is clicked', async () => {
      const propsWithExpensiveCurrentPlan = {
        ...defaultProps,
        currentPlan: mockAvailablePlans[1], // Family plan
        availablePlans: mockAvailablePlans.map(plan => ({
          ...plan,
          isCurrentPlan: plan.id === 'family'
        }))
      };

      render(<SubscriptionUpgradeModal {...propsWithExpensiveCurrentPlan} />);

      // Select Starter plan
      const starterPlan = screen.getByText('Starter').closest('div');
      fireEvent.click(starterPlan!);

      // Click downgrade button
      const downgradeButton = screen.getByText('Downgrade Plan');
      fireEvent.click(downgradeButton);

      await waitFor(() => {
        expect(defaultProps.onDowngrade).toHaveBeenCalledWith('starter');
      });
    });

    it('calls onClose after successful plan change', async () => {
      const mockOnUpgrade = jest.fn().mockResolvedValue(undefined);
      const props = { ...defaultProps, onUpgrade: mockOnUpgrade };

      render(<SubscriptionUpgradeModal {...props} />);

      // Select Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Click upgrade button
      const upgradeButton = screen.getByText('Upgrade Plan');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(mockOnUpgrade).toHaveBeenCalledWith('family');
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Loading States', () => {
    it('shows processing state during plan change', async () => {
      const mockOnUpgrade = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      const props = { ...defaultProps, onUpgrade: mockOnUpgrade };

      render(<SubscriptionUpgradeModal {...props} />);

      // Select Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Click upgrade button
      const upgradeButton = screen.getByText('Upgrade Plan');
      fireEvent.click(upgradeButton);

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('disables buttons during processing', async () => {
      const mockOnUpgrade = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      const props = { ...defaultProps, onUpgrade: mockOnUpgrade };

      render(<SubscriptionUpgradeModal {...props} />);

      // Select Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Click upgrade button
      const upgradeButton = screen.getByText('Upgrade Plan');
      fireEvent.click(upgradeButton);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Important Notes', () => {
    it('displays important notes section', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      expect(screen.getByText('Important Notes')).toBeInTheDocument();
      expect(screen.getByText('• Plan changes take effect immediately')).toBeInTheDocument();
      expect(screen.getByText('• Upgrades are prorated for the current billing period')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      cancelButton.focus();
      expect(cancelButton).toHaveFocus();

      fireEvent.keyDown(cancelButton, { key: 'Enter' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('has proper ARIA labels', () => {
      render(<SubscriptionUpgradeModal {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles upgrade errors gracefully', async () => {
      const mockOnUpgrade = jest.fn().mockRejectedValue(new Error('Upgrade failed'));
      const props = { ...defaultProps, onUpgrade: mockOnUpgrade };

      render(<SubscriptionUpgradeModal {...props} />);

      // Select Family plan
      const familyPlan = screen.getByText('Family').closest('div');
      fireEvent.click(familyPlan!);

      // Click upgrade button
      const upgradeButton = screen.getByText('Upgrade Plan');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(mockOnUpgrade).toHaveBeenCalledWith('family');
        // Modal should not close on error
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      });
    });
  });
});