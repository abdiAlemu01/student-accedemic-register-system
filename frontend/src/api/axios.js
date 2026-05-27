import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach stored token on every request (fallback if context hasn't set header yet)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sarms_token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Global response interceptor – redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sarms_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
