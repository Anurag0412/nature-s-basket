/**
 * Authentication API module for Nature's Basket.
 * Conforms 1:1 with backend routes in backend/controllers/authController.js.
 */
import api from './client';

/**
 * Authenticate user with credentials.
 * @param {Object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.password
 * @returns {Promise<{ success: boolean, token: string, user: { user_id: number, name: string, username: string, role: string } }>}
 */
export async function loginApi({ username, password }) {
  return await api.post('/api/auth/login', { username, password });
}

/**
 * Fetch authenticated user's current profile directly from database.
 * @returns {Promise<{ success: boolean, user: { user_id: number, name: string, username: string, role: string, status: string, created_at: string } }>}
 */
export async function getMeApi() {
  return await api.get('/api/auth/me');
}

export default {
  login: loginApi,
  getMe: getMeApi,
};
