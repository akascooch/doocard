import axios from 'axios';
import Cookies from 'js-cookie';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const baseURL = apiUrl.endsWith('/api') ? apiUrl : apiUrl + '/api';
const instance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add a request interceptor
instance.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    // console.log('🔵 Axios token from cookie:', token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // console.group('🔴 Axios Request Error');
    // console.error('Request error:', error);
    // console.groupEnd();
    return Promise.reject(error);
  }
);

// Add a response interceptor
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // console.group('🔴 Axios Response Error');
    // console.error('Response error:', {
    //   status: error.response?.status,
    //   data: error.response?.data,
    //   message: error.message,
    // });
    // console.groupEnd();
    return Promise.reject(error);
  }
);

export default instance;
export const api = instance; 