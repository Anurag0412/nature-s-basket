import { useState, useEffect, useCallback } from 'react';
import { setAuthToken, getAuthToken, registerUnauthorizedHandler } from '../api/client';
import { loginApi, getMeApi } from '../api/authApi';
import { getDefaultRouteForRole } from '../utils/roleUtils';
import { AuthContext } from './AuthContextCore';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getAuthToken());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Centralized logout
  const logout = useCallback(() => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  // Hook into client.js 401 unauthorized notifications
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  // Session restoration and verification on startup / refresh
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = getAuthToken();

      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        // Authenticate with backend: verify token signature, account active status, and load latest role
        const profile = await getMeApi();
        if (isMounted && profile?.success && profile?.user) {
          setUser(profile.user);
          setTokenState(storedToken);
        } else {
          // Response invalid or inactive
          if (isMounted) {
            logout();
          }
        }
      } catch (err) {
        // Token invalid, expired, or user deleted/inactivated
        console.warn('Session verification failed, logging out:', err.message);
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  // Login handler
  const login = async ({ username, password }) => {
    setIsLoading(true);
    try {
      const result = await loginApi({ username, password });

      if (result?.success && result?.token) {
        setAuthToken(result.token);
        setTokenState(result.token);
        setUser(result.user);
        return { success: true, user: result.user };
      }

      throw new Error(result?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isOwner = user?.role === 'owner';
  const isStaff = user?.role === 'staff';
  const isCashier = user?.role === 'cashier';

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    isOwner,
    isStaff,
    isCashier,
    login,
    logout,
    getDefaultRoute: () => getDefaultRouteForRole(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
