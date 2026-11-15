const state = { user: { id: (window as any).paymentConfig.payer }, getAccessToken: async () => (window as any).paymentConfig.payer }
export const useAuthStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state })
