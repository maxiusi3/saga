import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';

class ApiClientClass {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private isOffline: boolean = false;

  constructor() {
    const baseURL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001/api';
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupNetworkListener();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to refresh token
            const { useAuthStore } = await import('../stores/auth-store');
            await useAuthStore.getState().refreshToken();
            
            // Retry original request
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            const { useAuthStore } = await import('../stores/auth-store');
            useAuthStore.getState().logout();
            return Promise.reject(refreshError);
          }
        }

        // Handle network errors
        if (!error.response && this.isOffline) {
          error.message = 'No internet connection. Please check your network and try again.';
        }

        return Promise.reject(error);
      }
    );
  }

  private setupNetworkListener() {
    NetInfo.addEventListener((state) => {
      this.isOffline = !state.isConnected;
    });
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  async get(url: string, config?: AxiosRequestConfig) {
    return this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post(url, data, config);
  }

  async put(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put(url, data, config);
  }

  async patch(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.patch(url, data, config);
  }

  async delete(url: string, config?: AxiosRequestConfig) {
    return this.client.delete(url, config);
  }

  // Upload with progress tracking
  async uploadWithProgress(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void,
    config?: AxiosRequestConfig
  ) {
    return this.client.post(url, formData, {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        onProgress?.(progress);
      },
    });
  }
}

export const ApiClient = new ApiClientClass();