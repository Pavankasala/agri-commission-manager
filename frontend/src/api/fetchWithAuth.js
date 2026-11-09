import { API_BASE_URL } from './config';

/**
 * Helper function for making API requests with JWT Bearer token.
 * Automatically adds Authorization header from localStorage and handles 401 unauthenticated errors.
 */
export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  
  // Format full endpoint URL
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  } else if (response.status === 403) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body?.pending_approval || body?.rejected || (body?.message && body.message.toLowerCase().includes('approval'))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    } catch (e) {}
  }

  return response;
}

export default fetchWithAuth;
