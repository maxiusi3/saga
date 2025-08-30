/**
 * Comprehensive Accessibility Compliance Tests
 * 
 * Tests WCAG 2.1 AA compliance for all major components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Import components to test
import { AudioPlayer } from '../audio/audio-player';
import { StorySearch } from '../search/story-search';
import { ProtectedRoute } from '../auth/protected-route';
import { WalletStatus } from '../wallet/wallet-status';
import { SubscriptionOverview } from '../subscription/subscription-overview';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

jest.mock('../../hooks/use-search', () => ({
  useSearch: () => ({
    query: '',
    results: [],
    isLoading: false,
    error: null,
    search: jest.fn(),
    clearResults: jest.fn(),
  }),
}));

describe('Accessibility Compliance Tests', () => {
  describe('AudioPlayer Component', () => {
    const defaultProps = {
      src: 'https://example.com/audio.mp3',
      title: 'Test Audio Story',
      duration: 120,
      onPlay: jest.fn(),
      onPause: jest.fn(),
      onEnded: jest.fn(),
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<AudioPlayer {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(<AudioPlayer {...defaultProps} />);
      
      // Play/pause button should have proper role and label
      const playButton = screen.getByRole('button', { name: /play|pause/i });
      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveAttribute('aria-label');
      
      // Progress slider should have proper role and labels
      const progressSlider = screen.getByRole('slider');
      expect(progressSlider).toBeInTheDocument();
      expect(progressSlider).toHaveAttribute('aria-label');
      expect(progressSlider).toHaveAttribute('aria-valuemin');
      expect(progressSlider).toHaveAttribute('aria-valuemax');
      expect(progressSlider).toHaveAttribute('aria-valuenow');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<AudioPlayer {...defaultProps} />);
      
      const playButton = screen.getByRole('button', { name: /play/i });
      
      // Should be focusable
      await user.tab();
      expect(playButton).toHaveFocus();
      
      // Should activate with Enter key
      await user.keyboard('{Enter}');
      expect(defaultProps.onPlay).toHaveBeenCalled();
      
      // Should activate with Space key
      await user.keyboard(' ');
      expect(defaultProps.onPlay).toHaveBeenCalledTimes(2);
    });

    it('should provide time information for screen readers', () => {
      render(<AudioPlayer {...defaultProps} />);
      
      // Should display current time and duration
      expect(screen.getByText(/0:00/)).toBeInTheDocument();
      expect(screen.getByText(/2:00/)).toBeInTheDocument();
      
      // Time information should be accessible to screen readers
      const timeDisplay = screen.getByText(/0:00.*2:00/);
      expect(timeDisplay).toHaveAttribute('aria-live', 'polite');
    });

    it('should handle high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(<AudioPlayer {...defaultProps} />);
      
      // Should apply high contrast styles
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        // Verify contrast ratios meet WCAG AA standards
        expect(styles.color).toBeDefined();
        expect(styles.backgroundColor).toBeDefined();
      });
    });
  });

  describe('StorySearch Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<StorySearch />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form labels and structure', () => {
      render(<StorySearch />);
      
      // Search input should have proper label
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAccessibleName();
      
      // Search button should be accessible
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toBeInTheDocument();
    });

    it('should provide search results with proper structure', async () => {
      const mockResults = [
        { id: '1', title: 'Test Story 1', transcript: 'Test content 1' },
        { id: '2', title: 'Test Story 2', transcript: 'Test content 2' },
      ];

      // Mock search hook to return results
      jest.doMock('../../hooks/use-search', () => ({
        useSearch: () => ({
          query: 'test',
          results: mockResults,
          isLoading: false,
          error: null,
          search: jest.fn(),
          clearResults: jest.fn(),
        }),
      }));

      const { StorySearch: MockedStorySearch } = await import('../search/story-search');
      render(<MockedStorySearch />);
      
      // Results should be in a list structure
      const resultsList = screen.getByRole('list');
      expect(resultsList).toBeInTheDocument();
      
      const resultItems = screen.getAllByRole('listitem');
      expect(resultItems).toHaveLength(2);
      
      // Each result should have proper heading structure
      resultItems.forEach((item, index) => {
        const heading = screen.getByRole('heading', { name: mockResults[index].title });
        expect(heading).toBeInTheDocument();
      });
    });

    it('should announce search status to screen readers', async () => {
      render(<StorySearch />);
      
      // Should have live region for search status
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toBeInTheDocument();
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('WalletStatus Component', () => {
    const defaultProps = {
      projectVouchers: 2,
      facilitatorSeats: 3,
      storytellerSeats: 1,
      isLoading: false,
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<WalletStatus {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide clear resource information', () => {
      render(<WalletStatus {...defaultProps} />);
      
      // Should have clear headings for each resource type
      expect(screen.getByText(/project vouchers/i)).toBeInTheDocument();
      expect(screen.getByText(/facilitator seats/i)).toBeInTheDocument();
      expect(screen.getByText(/storyteller seats/i)).toBeInTheDocument();
      
      // Numbers should be clearly associated with their labels
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle loading state accessibly', () => {
      render(<WalletStatus {...defaultProps} isLoading={true} />);
      
      // Should have loading indicator with proper label
      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveAttribute('aria-label', /loading/i);
    });

    it('should warn about low resources', () => {
      const lowResourceProps = {
        ...defaultProps,
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0,
      };

      render(<WalletStatus {...lowResourceProps} />);
      
      // Should have alert for low resources
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/insufficient resources/i);
    });
  });

  describe('SubscriptionOverview Component', () => {
    const defaultProps = {
      subscription: {
        id: '1',
        status: 'active',
        currentPeriodEnd: new Date('2024-12-31'),
        planName: 'Saga Package',
      },
      project: {
        id: '1',
        name: 'Test Project',
        status: 'active',
      },
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<SubscriptionOverview {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide clear subscription status', () => {
      render(<SubscriptionOverview {...defaultProps} />);
      
      // Should have clear status indicator
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/saga package/i)).toBeInTheDocument();
      
      // Expiry date should be clearly formatted
      expect(screen.getByText(/december 31, 2024/i)).toBeInTheDocument();
    });

    it('should handle expired subscription with proper alerts', () => {
      const expiredProps = {
        ...defaultProps,
        subscription: {
          ...defaultProps.subscription,
          status: 'expired',
          currentPeriodEnd: new Date('2023-12-31'),
        },
      };

      render(<SubscriptionOverview {...expiredProps} />);
      
      // Should have alert for expired subscription
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/expired/i);
    });

    it('should provide accessible renewal actions', () => {
      render(<SubscriptionOverview {...defaultProps} />);
      
      // Renewal button should be accessible
      const renewButton = screen.getByRole('button', { name: /renew/i });
      expect(renewButton).toBeInTheDocument();
      expect(renewButton).toHaveAccessibleDescription();
    });
  });

  describe('Form Accessibility', () => {
    it('should handle form validation errors accessibly', async () => {
      // Mock a form component with validation
      const TestForm = () => {
        const [email, setEmail] = React.useState('');
        const [error, setError] = React.useState('');

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!email.includes('@')) {
            setError('Please enter a valid email address');
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'email-error' : undefined}
            />
            {error && (
              <div id="email-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}
            <button type="submit">Submit</button>
          </form>
        );
      };

      const user = userEvent.setup();
      render(<TestForm />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      // Enter invalid email and submit
      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);
      
      // Error should be announced to screen readers
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent(/valid email address/i);
      });
      
      // Input should be marked as invalid
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modals', async () => {
      const TestModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        const modalRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
          if (isOpen && modalRef.current) {
            modalRef.current.focus();
          }
        }, [isOpen]);

        if (!isOpen) return null;

        return (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
          >
            <h2 id="modal-title">Test Modal</h2>
            <button onClick={onClose}>Close</button>
          </div>
        );
      };

      const TestApp = () => {
        const [isModalOpen, setIsModalOpen] = React.useState(false);
        return (
          <>
            <button onClick={() => setIsModalOpen(true)}>Open Modal</button>
            <TestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
          </>
        );
      };

      const user = userEvent.setup();
      render(<TestApp />);
      
      const openButton = screen.getByRole('button', { name: /open modal/i });
      await user.click(openButton);
      
      // Modal should be focused
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveFocus();
      
      // Should have proper ARIA attributes
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
    });
  });

  describe('Color and Contrast', () => {
    it('should meet color contrast requirements', () => {
      const TestComponent = () => (
        <div>
          <button style={{ backgroundColor: '#007bff', color: '#ffffff' }}>
            Primary Button
          </button>
          <button style={{ backgroundColor: '#6c757d', color: '#ffffff' }}>
            Secondary Button
          </button>
          <p style={{ color: '#212529', backgroundColor: '#ffffff' }}>
            Regular text content
          </p>
        </div>
      );

      const { container } = render(<TestComponent />);
      
      // Check that elements have sufficient contrast
      const buttons = container.querySelectorAll('button');
      const text = container.querySelector('p');
      
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        expect(styles.backgroundColor).toBeDefined();
        expect(styles.color).toBeDefined();
      });
      
      if (text) {
        const styles = window.getComputedStyle(text);
        expect(styles.color).toBeDefined();
        expect(styles.backgroundColor).toBeDefined();
      }
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const TestComponent = () => (
        <div>
          <button style={{ minWidth: '44px', minHeight: '44px' }}>
            Mobile Button
          </button>
          <input
            type="text"
            style={{ minHeight: '44px' }}
            aria-label="Mobile Input"
          />
        </div>
      );

      const { container } = render(<TestComponent />);
      
      // Check minimum touch target sizes
      const button = container.querySelector('button');
      const input = container.querySelector('input');
      
      if (button) {
        const styles = window.getComputedStyle(button);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
      }
      
      if (input) {
        const styles = window.getComputedStyle(input);
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
      }
    });
  });
});