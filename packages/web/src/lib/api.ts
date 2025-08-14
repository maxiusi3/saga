import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { toast } from 'react-hot-toast'

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/auth/signin'
        return Promise.reject(refreshError)
      }
    }

    // Handle different error types
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 400:
          if (data.error?.code === 'VALIDATION_ERROR') {
            toast.error('Please check your input and try again')
          } else {
            toast.error(data.error?.message || 'Bad request')
          }
          break
        case 403:
          toast.error('You don\'t have permission to perform this action')
          break
        case 404:
          toast.error('The requested resource was not found')
          break
        case 409:
          toast.error(data.error?.message || 'Conflict occurred')
          break
        case 429:
          toast.error('Too many requests. Please try again later.')
          break
        case 500:
          toast.error('Server error. Please try again later.')
          break
        default:
          toast.error(data.error?.message || 'An unexpected error occurred')
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.')
    } else {
      toast.error('An unexpected error occurred')
    }

    return Promise.reject(error)
  }
)

// API methods
export const apiClient = {
  // Generic methods
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.get(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.post(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.put(url, data, config),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.patch(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.delete(url, config),

  // Auth methods
  auth: {
    signin: (email: string, password: string) =>
      api.post('/auth/signin', { email, password }),
    
    signup: (data: { name: string; email: string; password: string }) =>
      api.post('/auth/signup', data),
    
    signout: () =>
      api.post('/auth/signout'),
    
    refresh: (refreshToken: string) =>
      api.post('/auth/refresh', { refreshToken }),
    
    profile: () =>
      api.get('/auth/profile'),
    
    updateProfile: (data: { name?: string; email?: string }) =>
      api.put('/auth/profile', data),
    
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/auth/change-password', data),

    // OAuth methods
    googleOAuth: (accessToken: string) =>
      api.post('/auth/oauth/google', { accessToken }),
    
    appleOAuth: (idToken: string, user?: any) =>
      api.post('/auth/oauth/apple', { idToken, user }),
  },

  // Project methods
  projects: {
    list: () =>
      api.get('/projects'),
    
    get: (id: string) =>
      api.get(`/projects/${id}`),
    
    create: (data: { title: string; description?: string }) =>
      api.post('/projects', data),
    
    update: (id: string, data: { title?: string; description?: string }) =>
      api.put(`/projects/${id}`, data),
    
    delete: (id: string) =>
      api.delete(`/projects/${id}`),
    
    stats: (id: string) =>
      api.get(`/projects/${id}/stats`),
    
    generateInvitation: (id: string, data: { email: string; role: 'facilitator' | 'storyteller'; message?: string }) =>
      api.post(`/api/invitations`, { projectId: id, ...data }),
    
    getInvitations: (id: string) =>
      api.get(`/projects/${id}/invitations`),
    
    invalidateInvitations: (id: string) =>
      api.delete(`/projects/${id}/invitations`),
  },

  // Story methods
  stories: {
    list: (projectId: string, params?: { page?: number; limit?: number; status?: string }) =>
      api.get(`/projects/${projectId}/stories`, { params }),
    
    get: (id: string) =>
      api.get(`/stories/${id}`),
    
    create: (projectId: string, formData: FormData) =>
      api.post(`/projects/${projectId}/stories`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    
    update: (id: string, data: { title?: string; transcript?: string }) =>
      api.put(`/stories/${id}`, data),
    
    delete: (id: string) =>
      api.delete(`/stories/${id}`),
    
    search: (projectId: string, query: string) =>
      api.get(`/projects/${projectId}/stories/search`, { params: { q: query } }),
    
    recent: (projectId: string) =>
      api.get(`/projects/${projectId}/stories/recent`),
    
    addInteraction: (id: string, data: { type: 'comment' | 'question'; content: string }) =>
      api.post(`/stories/${id}/interactions`, data),
  },

  // Subscription methods
  subscriptions: {
    status: () =>
      api.get('/subscriptions/status'),
    
    createCheckout: () =>
      api.post('/subscriptions/checkout'),
    
    handlePaymentSuccess: (sessionId: string) =>
      api.post('/subscriptions/payment-success', { sessionId }),
    
    cancel: () =>
      api.post('/subscriptions/cancel'),
  },

  // Notification methods
  notifications: {
    list: (params?: { page?: number; limit?: number; status?: string; type?: string }) =>
      api.get('/notifications', { params }),
    
    markAsRead: (id: string) =>
      api.patch(`/notifications/${id}/read`),
    
    markAllAsRead: () =>
      api.patch('/notifications/read-all'),
    
    getPreferences: () =>
      api.get('/notifications/preferences'),
    
    updatePreferences: (data: any) =>
      api.put('/notifications/preferences', data),
    
    registerDeviceToken: (data: { token: string; platform: string; deviceId?: string }) =>
      api.post('/notifications/device-tokens', data),
    
    getDeviceTokens: () =>
      api.get('/notifications/device-tokens'),
    
    deactivateDeviceToken: (token: string) =>
      api.delete('/notifications/device-tokens', { data: { token } }),
  },

  // Export methods
  exports: {
    list: () =>
      api.get('/exports'),
    
    create: (projectId: string, format: string = 'zip') =>
      api.post('/exports', { projectId, format }),
    
    get: (id: string) =>
      api.get(`/exports/${id}`),
    
    download: (id: string) =>
      api.get(`/exports/${id}/download`, { responseType: 'blob' }),
  },
}

export default api