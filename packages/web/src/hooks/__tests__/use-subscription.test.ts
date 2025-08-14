import { renderHook, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useSubscription } from '../use-subscription';

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
  
  const mockSubscriptionData = {
    id: 'sub_123',
    status: 'active',
    projectName: 'Family Stories',
    currentPeriodStart: '2024-01-01T00:00:00.000Z',
    currentPeriodEnd: '2025-01-01T00:00:00.000Z',
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
    nextBillingDate: '2025-01-01T00:00:00.000Z',
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
      mockApi.get.mockResolvedValueOnce({ data: mockSubscriptionData });

      const { result } = renderHook(() => 
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription).toEqual({
        ...mockSubscriptionData,
        currentPeriodStart: new Date('2024-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2025-01-01T00:00:00.000Z'),
        nextBillingDate: new Date('2025-01-01T00:00:00.000Z')
      });
      expect(result.current.error).toBe(null);
      expect(mockApi.get).toHaveBeenCalledWith('/api/projects/project-123/subscription');
    });

    it('handles subscription without optional fields', async () => {
      const minimalSubscription = {
        id: 'sub_123',
        status: 'active',
        projectName: 'Family Stories',
        currentPeriodStart: '2024-01-01T00:00:00.000Z',
        currentPeriodEnd: '2025-01-01T00:00:00.000Z',
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

      mockApi.get.mockResolvedValueOnce({ data: minimalSubscription });

      const { result } = renderHook(() => 
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription).toEqual({
        ...minimalSubscription,
        currentPeriodStart: new Date('2024-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2025-01-01T00:00:00.000Z'),
        isArchived: false,
        daysUntilExpiry: undefined,
        nextBillingDate: undefined,
        paymentMethod: undefined
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
      expect(result.current.error).toBe(errorMessage);
    });

    it('handles network errors', async () => {
      mockApi.get.mockRejectedValueOnce({ 
        response: { 
          status: 500, 
          data: { message: 'Internal server error' } 
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
          data: { message: 'Subscription not found' } 
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
      mockApi.get.mockResolvedValueOnce({ data: mockSubscriptionData });
      mockApi.post.mockResolvedValueOnce({ data: { success: true } });

      const { result } = renderHook(() => 
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.renewSubscription();
      });

      expect(mockApi.post).toHaveBeenCalledWith('/api/projects/project-123/subscription/renew');
    });

    it('handles renewal errors', async () => {
      mockApi.get.mockResolvedValueOnce({ data: mockSubscriptionData });
      mockApi.post.mockRejectedValueOnce(new Error('Payment failed'));

      const { result } = renderHook(() => 
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.renewSubscription()).rejects.toThrow('Payment failed');
    });
  });

  describe('Refresh Functionality', () => {
    it('refreshes subscription data', async () => {
      mockApi.get
        .mockResolvedValueOnce({ data: mockSubscriptionData })
        .mockResolvedValueOnce({ 
          data: { ...mockSubscriptionData, status: 'expired' } 
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
        .mockResolvedValueOnce({ data: mockSubscriptionData })
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

      expect(result.current.error).toBe('Network error');
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
      mockApi.get.mockResolvedValue({ data: mockSubscriptionData });

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
      mockApi.get.mockResolvedValue({ data: mockSubscriptionData });

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
      mockApi.get.mockResolvedValue({ data: mockSubscriptionData });

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

      mockApi.get.mockResolvedValueOnce({ data: subscriptionWithFutureExpiry });

      const { result } = renderHook(() => 
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription?.daysUntilExpiry).toBe(30);
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

      mockApi.get.mockResolvedValueOnce({ data: expiredSubscription });

      const { result } = renderHook(() => 
        useSubscription({ projectId: 'project-123' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscription?.status).toBe('expired');
      expect(result.current.subscription?.isArchived).toBe(true);
      expect(result.current.subscription?.daysUntilExpiry).toBe(0);
    });
  });

  describe('Hook Options', () => {
    it('respects custom refresh interval', async () => {
      jest.useFakeTimers();
      mockApi.get.mockResolvedValue({ data: mockSubscriptionData });

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
      expect(result.current.error).toBe('Project ID is required');
    });
  });
});