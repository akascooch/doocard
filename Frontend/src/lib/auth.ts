import axios from './axios';
import Cookies from 'js-cookie';
import { logError } from './error-handler';

interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<{ user: any }> {
  try {
    console.group('🔵 Login Attempt');
    console.log('Attempting login with email:', credentials.email);
    
    const response = await axios.post('/auth/login', credentials);
    
    console.log('✅ Login successful');
    console.log('Response:', response.data);
    
    if (!response.data.user) {
      throw new Error('Login failed');
    }

    // Store JWT token in cookie for axios
    if (response.data.access_token) {
      Cookies.set('token', response.data.access_token, { expires: 7 }); // 7 days expiry
    }

    // Store user data only
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

export function logout(): void {
  try {
    console.group('🔵 Logout');
    Cookies.remove('token');
    localStorage.removeItem('user');
    console.log('✅ Logged out successfully');
  } catch (error: any) {
    logError(error, 'Logout');
  } finally {
    console.groupEnd();
  }
}

export function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error: any) {
    logError(error, 'GetCurrentUser');
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!Cookies.get('token') && !!getCurrentUser();
}