/**
 * Centralized API Client for Nature's Basket
 *
 * - Executes relative requests against `/api` (proxied by Vite to the backend in dev).
 * - Transparently handles JSON serialization and deserialization.
 * - Injects `Authorization: Bearer <token>` header when an auth token is active.
 * - Extracts backend error messages with high fidelity.
 * - Manages 401 Unauthorized responses to clear stale sessions without infinite redirect loops.
 */

const STORAGE_TOKEN_KEY = 'nb_auth_token';

// In-memory token reference synced with localStorage
let activeToken = localStorage.getItem(STORAGE_TOKEN_KEY);
let unauthorizedCallback = null;
let isHandlingUnauthorized = false;

export const setAuthToken = (token) => {
  activeToken = token;
  if (token) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  }
};

export const getAuthToken = () => {
  if (!activeToken) {
    activeToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  }
  return activeToken;
};

/**
 * Register a listener for unexpected 401 responses on protected endpoints.
 * AuthContext listens to this to safely transition to unauthenticated state.
 */
export const registerUnauthorizedHandler = (callback) => {
  unauthorizedCallback = callback;
};

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Core HTTP dispatch function.
 *
 * @param {string} endpoint - e.g. '/api/products' or '/api/auth/login'
 * @param {RequestInit} options - fetch options
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  // Only set Content-Type if there's a payload and it wasn't explicitly provided
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Inject Bearer token if available
  const token = getAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new ApiError(
      networkError.message || 'Network error: Unable to connect to server',
      0,
      null
    );
  }

  // Parse JSON response body safely
  let responseData = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      const text = await response.text();
      responseData = text ? { raw: text } : null;
    } catch {
      responseData = null;
    }
  }

  // Handle successful response
  if (response.ok) {
    return responseData;
  }

  // Handle 401 Unauthorized
  if (response.status === 401) {
    // A 401 on login means bad credentials, NOT an expired stored token
    const isLoginEndpoint = url.includes('/api/auth/login');

    if (!isLoginEndpoint && unauthorizedCallback && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true;
      try {
        setAuthToken(null);
        unauthorizedCallback();
      } finally {
        // Debounce unauthorized handling flag
        setTimeout(() => {
          isHandlingUnauthorized = false;
        }, 1000);
      }
    }
  }

  // Extract human-friendly error message from backend
  const errorMessage =
    (responseData && (responseData.message || responseData.error)) ||
    `HTTP Error ${response.status}: ${response.statusText || 'Request failed'}`;

  throw new ApiError(errorMessage, response.status, responseData);
}

export const api = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: (endpoint, body, options = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: (endpoint, body, options = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
