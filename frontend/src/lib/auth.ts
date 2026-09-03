import { useState, useEffect } from 'react';
import api from './axios';
import Cookies from 'js-cookie';

function logError(error: any, context: string) {
  console.group(`❌ ${context} Error`);
  console.error('Error:', error);
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
  }
  console.groupEnd();
}


interface LoginCredentials {
  identifier: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<{ user: any }> {
  try {
    console.group('🔵 Login Attempt');
    console.log('Attempting login with:', credentials.identifier);
    
    const response = await api.post('/auth/login', credentials);
    
    console.log('✅ Login successful');
    console.log('Response:', response.data);
    
    if (!response.data.user) {
      throw new Error('Login failed');
    }

    // Store JWT token in localStorage
    // (refresh_token is automatically stored as HttpOnly cookie by backend)
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      console.log('🔵 Access token stored in localStorage');
    } else {
      console.log('⚠️ No access_token in response');
    }

    // Store user data
    localStorage.setItem('user', JSON.stringify(response.data.user));
    
    console.log('✅ User data stored successfully');
    console.groupEnd();
    
    return { user: response.data.user };
  } catch (error: any) {
    logError(error, 'Login');
    throw error;
  } finally {
    console.groupEnd();
  }
}

export async function logout(): Promise<void> {
  try {
    console.log('🚪 Logging out...');
    
    // Call backend logout to revoke refresh token
    await api.post('/auth/logout');
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear cookies (as fallback, backend already clears them)
    Cookies.remove('token');
    Cookies.remove('refresh_token');
    
    console.log('✅ Logout successful');
  } catch (error: any) {
    // Even if backend call fails, clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Cookies.remove('token');
    Cookies.remove('refresh_token');
    
    logError(error, 'Logout');
  }
}

export function getCurrentUser() {
  try {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error: any) {
    logError(error, 'GetCurrentUser');
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('token');
  return !!token && !!getCurrentUser();
}

// React hook for authentication
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const loginUser = async (credentials: LoginCredentials) => {
    try {
      const result = await login(credentials);
      setUser(result.user);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const logoutUser = async () => {
    await logout();
    setUser(null);
  };

  return {
    user,
    loading,
    login: loginUser,
    logout: logoutUser,
    isAuthenticated: !!user && isAuthenticated(),
  };
}
