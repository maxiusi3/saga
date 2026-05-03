import { renderHook, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock the API client
jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

describe('useSubscription Hook', () => {
  const mockApi = require('../../lib/api').api;
  const { useSubscription } = require('../use-subscription');
  const apiSuccess = (data: unknown) => ({ data: { success: true, data } });

  const mockSubscriptionData = {
    id: 'sub_123',
    status: 'active',
    projectName: 'Family Stories',
    currentPeriodStart: '2026-01-01T00:00:00.000Z',
    currentPeriodEnd: '2099-01-01T00:00:00.000Z',
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
    nextBillingDate: '2099-01-01T00:00:00.000Z',
    paymentMethod: {
      type: 'card',
      last4: '4242',
      brand: 'visa'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with loading state', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.subscription).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe('Successful Data Loading', () => {
    it('loads subscription data successfully', async () => {
      mockApi.get.mockResolvedValueOnce(apiSuccess(mockSubscriptionData));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription).toEqual({
        ...mockSubscriptionData,
        currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
        nextBillingDate: new Date('2099-01-01T00:00:00.000Z'),
        daysUntilExpiry: expect.any(Number)
      });
      expect(result.current.error).toBe(null);
      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-123/subscription');
    });

    it('handles subscription without optional fields', async () => {
      const minimalSubscription = {
        id: 'sub_123',
        status: 'active',
        projectName: 'Family Stories',
        currentPeriodStart: '2026-01-01T00:00:00.000Z',
        currentPeriodEnd: '2099-01-01T00:00:00.000Z',
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

      mockApi.get.mockResolvedValueOnce(apiSuccess(minimalSubscription));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription).toEqual({
        ...minimalSubscription,
        currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
        daysUntilExpiry: expect.any(Number),
        nextBillingDate: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors', async () => {
      const errorMessage = 'Failed to load subscription';
      mockApi.get.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription).toBe(null);
      expect(result.current.error).toBe('Failed to fetch subscription');
    });

    it('handles network errors', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { error: { message: 'Internal server error' } }
        }
      });

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Internal server error');
    });

    it('handles 404 errors gracefully', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: { message: 'Subscription not found' } }
        }
      });

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Subscription not found');
    });
  });

  describe('Renewal Functionality', () => {
    it('renews subscription successfully', async () => {
      mockApi.get.mockResolvedValueOnce(apiSuccess(mockSubscriptionData));
      mockApi.post.mockResolvedValueOnce({ data: { success: true } });
      mockApi.get.mockResolvedValueOnce(apiSuccess(mockSubscriptionData));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.renewSubscription();
      });

      expect(mockApi.post).toHaveBeenCalledWith('/projects/project-123/renew-subscription');
    });

    it('handles renewal errors', async () => {
      mockApi.get.mockResolvedValueOnce(apiSuccess(mockSubscriptionData));
      mockApi.post.mockRejectedValueOnce({
        response: { data: { error: { message: 'Payment failed' } } }
      });

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.renewSubscription();
      });

      expect(result.current.error).toBe('Payment failed');
    });
  });

  describe('Refresh Functionality', () => {
    it('refreshes subscription data', async () => {
      mockApi.get
        .mockResolvedValueOnce(apiSuccess(mockSubscriptionData))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              ...mockSubscriptionData,
              status: 'expired',
              currentPeriodEnd: '2020-01-01T00:00:00.000Z'
            }
          }
        });

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription?.status).toBe('active');

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.subscription?.status).toBe('expired');
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it('handles refresh errors', async () => {
      mockApi.get
        .mockResolvedValueOnce(apiSuccess(mockSubscriptionData))
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe('Failed to fetch subscription');
    });
  });

  describe('Auto Refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('auto refreshes when enabled', async () => {
      mockApi.get.mockResolvedValue(apiSuccess(mockSubscriptionData));

      renderHook(() =>
        useSubscription({
          projectId: 'project-123',
          autoRefresh: true,
          refreshInterval: 5000
        })
      );

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(1);
      });

      // Fast forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });
    });

    it('does not auto refresh when disabled', async () => {
      mockApi.get.mockResolvedValue(apiSuccess(mockSubscriptionData));

      renderHook(() =>
        useSubscription({
          projectId: 'project-123',
          autoRefresh: false
        })
      );

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(1);
      });

      // Fast forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should still only be called once
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });

    it('cleans up auto refresh on unmount', async () => {
      mockApi.get.mockResolvedValue(apiSuccess(mockSubscriptionData));

      const { unmount } = renderHook(() =>
        useSubscription({
          projectId: 'project-123',
          autoRefresh: true,
          refreshInterval: 5000
        })
      );

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Fast forward 5 seconds after unmount
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should not call API again after unmount
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Subscription Status Calculations', () => {
    it('calculates days until expiry correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const subscriptionWithFutureExpiry = {
        ...mockSubscriptionData,
        currentPeriodEnd: futureDate.toISOString(),
        daysUntilExpiry: 30
      };

      mockApi.get.mockResolvedValueOnce(apiSuccess(subscriptionWithFutureExpiry));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription?.daysUntilExpiry).toBeGreaterThanOrEqual(29);
      expect(result.current.subscription?.daysUntilExpiry).toBeLessThanOrEqual(31);
    });

    it('handles expired subscriptions', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const expiredSubscription = {
        ...mockSubscriptionData,
        status: 'expired',
        currentPeriodEnd: pastDate.toISOString(),
        daysUntilExpiry: 0,
        isArchived: true
      };

      mockApi.get.mockResolvedValueOnce(apiSuccess(expiredSubscription));

      const { result } = renderHook(() =>
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription?.status).toBe('expired');
      expect(result.current.subscription?.isArchived).toBe(true);
      expect(result.current.subscription?.daysUntilExpiry).toBeLessThanOrEqual(0);
    });
  });

  describe('Hook Options', () => {
    it('respects custom refresh interval', async () => {
      jest.useFakeTimers();
      mockApi.get.mockResolvedValue(apiSuccess(mockSubscriptionData));

      renderHook(() =>
        useSubscription({
          projectId: 'project-123',
          autoRefresh: true,
          refreshInterval: 10000 // 10 seconds
        })
      );

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(1);
      });

      // Fast forward 5 seconds (should not refresh yet)
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockApi.get).toHaveBeenCalledTimes(1);

      // Fast forward another 5 seconds (should refresh now)
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });

      jest.useRealTimers();
    });

    it('handles missing projectId gracefully', () => {
      const { result } = renderHook(() =>
        useSubscription({ projectId: '' })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.subscription).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });
});
