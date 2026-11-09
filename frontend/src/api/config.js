import axios from 'axios';

// Centralized API Base URL configuration
// Reads VITE_API_BASE_URL or defaults to your live deployed Render backend
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://agri-commission-manager.onrender.com').replace(/\/+$/, '');

// Automatically attach Authorization JWT token to all API requests
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
}, (error) => Promise.reject(error));


export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/login`,
  SIGNUP: `${API_BASE_URL}/api/signup`,
  GOOGLE_AUTH: `${API_BASE_URL}/api/google-auth`,
  HOME_BILLS: `${API_BASE_URL}/api/home-bills`,
  ADD_BILL: `${API_BASE_URL}/api/add-bill`,
  DELETE_BILL: (id) => `${API_BASE_URL}/api/delete-bill/${id}`,
  EXPENDITURES: `${API_BASE_URL}/api/expenditures`,
  CASH_COLLECTION: `${API_BASE_URL}/api/cash-collection`,
  ADVANCE: `${API_BASE_URL}/api/advance`,
  BALANCE_SHEET: `${API_BASE_URL}/api/balance-sheet`,
  NOT_PAID_BILLS: `${API_BASE_URL}/api/not-paid-bills`,
  PAID_BILLS: `${API_BASE_URL}/api/paid-bills`,
  KISAN_BALANCE: `${API_BASE_URL}/api/kisan-balance`,
  SHOPS: `${API_BASE_URL}/api/shops`,
  LOCAL_SALE: `${API_BASE_URL}/api/local-sale`,
  SOLD_DATA: `${API_BASE_URL}/api/sold-data`,
  BEAT_PAPER: `${API_BASE_URL}/api/beat-paper`,
  AUTH_ME: `${API_BASE_URL}/api/me`,
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_APPROVE_USER: (id) => `${API_BASE_URL}/api/admin/users/${id}/approve`,
  ADMIN_REJECT_USER: (id) => `${API_BASE_URL}/api/admin/users/${id}/reject`,
  ADMIN_REVOKE_USER: (id) => `${API_BASE_URL}/api/admin/users/${id}/revoke`,
  ADMIN_TOGGLE_ROLE: (id) => `${API_BASE_URL}/api/admin/users/${id}/toggle-role`,
  ADMIN_DELETE_USER: (id) => `${API_BASE_URL}/api/admin/users/${id}`,
  ADMIN_PENDING_COUNT: `${API_BASE_URL}/api/admin/pending-count`
};
