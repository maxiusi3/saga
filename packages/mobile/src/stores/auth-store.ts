import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';

import { ApiClient } from '../services/api-client';
import type { User } from '@saga/shared/types/user';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (invitationCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Actions
      login: async (invitationCode: string) => {
        try {
          set({ isLoading: true, error: null });
          
          // Use the invitation service to accept the invitation
          const { InvitationService } = await import('../services/invitation-service');
          const { useOnboardingStore } = await import('./onboarding-store');
          
          const onboardingState = useOnboardingStore.getState();
          const result = await InvitationService.acceptInvitation(invitationCode, onboardingState.userInfo);
          
          if (result.success && result.user && result.token) {
            set({
              user: result.user,
              token: result.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            // Set token for future API calls
            ApiClient.setAuthToken(result.token);
          } else {
            throw new Error(result.error || 'Login failed');
          }
        } catch (error: any) {
          set({
            error: error.response?.data?.message || error.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await ApiClient.post('/auth/logout');
        } catch (error) {
          // Continue with logout even if API call fails
          console.warn('Logout API call failed:', error);
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });

        ApiClient.clearAuthToken();
      },

      refreshToken: async () => {
        try {
          const { token } = get();
          if (!token) return;

          const response = await ApiClient.post('/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const { token: newToken, user } = response.data;
          
          set({
            token: newToken,
            user,
            isAuthenticated: true,
          });

          ApiClient.setAuthToken(newToken);
        } catch (error) {
          // If refresh fails, logout user
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
      
      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          ApiClient.setAuthToken(state.token);
        }
        state?.setLoading(false);
      },
    }
  )
);