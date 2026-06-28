import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getFinancialAccessToken } from './financial-reports-access';

const isServer = typeof window === 'undefined';

// Minimal global auth-degraded signal (memory-only, no persistence)
type AuthDegradedListener = () => void;
let authDegraded = false;
let authDegradedListeners: AuthDegradedListener[] = [];

export const subscribeAuthDegraded = (listener: AuthDegradedListener): (() => void) => {
  authDegradedListeners.push(listener);
  return () => {
    authDegradedListeners = authDegradedListeners.filter((l) => l !== listener);
  };
};

export const isAuthDegraded = () => authDegraded;

const setAuthDegraded = () => {
  if (authDegraded) return;
  authDegraded = true;
  authDegradedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
};

/** Resolved API root — e.g. http://localhost:3001/api or /api (Next proxy). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api`
  : '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: Send cookies with requests
});

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!isServer) {
      // FormData must not use application/json — browser sets multipart boundary
      if (config.data instanceof FormData) {
        if (config.headers) {
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
        }
      }

      // Add correlation ID
      if (!config.headers['X-Request-Id']) {
        config.headers['X-Request-Id'] = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add auth token from localStorage (fallback if cookie not available)
      const token = localStorage.getItem('token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const url = config.url || '';
      if (
        url.includes('/dashboard/financial-stats') ||
        url.includes('/admin/financial/yearly-report')
      ) {
        const financialToken = getFinancialAccessToken();
        if (financialToken) {
          config.headers['x-financial-access-token'] = financialToken;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - auto-refresh on 401 + friendly Persian errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const data: any = error.response?.data;

    // Enhanced error with Persian messages
    const enhancedError = {
      ...error,
      friendlyMessage: data?.message_fa || data?.message || 'خطای نامشخص',
      friendlyMessageEn: data?.message_en || data?.message || 'Unknown error',
      statusCode: status,
      internalCode: data?.internalCode,
      correlationId: data?.correlationId,
      suggestions: data?.suggestions || [],
    };

    console.error('❌ API Error:', {
      status,
      url: originalRequest?.url,
      message: enhancedError.friendlyMessage,
      internalCode: enhancedError.internalCode,
    });

    // Handle 401 - attempt refresh, but never auto-logout or redirect.
    if (status === 401 && !originalRequest._retry && !isServer) {
      const requestUrl = originalRequest.url || '';

      // Backup routes: never trigger refresh (long I/O + blob/download conflicts).
      if (requestUrl.includes('/settings/backup')) {
        return Promise.reject(enhancedError);
      }

      // Don't retry if this is the refresh endpoint itself; just return the error.
      if (requestUrl.includes('/auth/refresh')) {
        console.log('🚪 Refresh token expired or invalid - not logging out user automatically');
        // Mark auth as degraded so UI can inform the user.
        setAuthDegraded();
        return Promise.reject(enhancedError);
      }

      // Queue requests while refreshing
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api.request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('🔄 Access token expired - attempting refresh...');
        
        // Call refresh endpoint (uses refresh_token cookie automatically)
        const response = await api.post('/auth/refresh');
        
        const newAccessToken = response.data.access_token;
        
        if (newAccessToken) {
          console.log('✅ Token refreshed successfully');
          
          // Update token in localStorage
          localStorage.setItem('token', newAccessToken);
          
          // Update user data if provided
          if (response.data.user) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
          
          // Update authorization header for retry
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          
          // Process queued requests
          processQueue(null, newAccessToken);
          
          // Retry original request
          return api.request(originalRequest);
        } else {
          throw new Error('No access token in refresh response');
        }
        
      } catch (refreshError: any) {
        const refreshStatus = refreshError?.response?.status;
        console.error('❌ Token refresh failed:', refreshError, 'status:', refreshStatus);

        // Mark auth as degraded so UI can inform the user, but do not clear auth or redirect.
        setAuthDegraded();
        // Do not clear auth or redirect; just fail the queued requests.
        processQueue(new Error('AUTH_FAILED'));
        return Promise.reject(enhancedError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(enhancedError);
  }
);

export { api }; // Named export for backwards compatibility
export default api;
