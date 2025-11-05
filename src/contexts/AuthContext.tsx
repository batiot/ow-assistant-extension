import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthState, UserInfo, AuthError } from '@/auth';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserInfo | null;
  isLoading: boolean;
  error: AuthError | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Fetch initial auth state
  useEffect(() => {
    const fetchAuthState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' });
        setAuthState(response);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch auth state:', err);
        setError(err as AuthError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuthState();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'AUTH_STATE_CHANGED') {
        setAuthState(message.payload);
        setError(null);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' });
      if (response.error) {
        throw new Error(response.error);
      }
      setAuthState(response.state);
    } catch (err) {
      console.error('Login failed:', err);
      setError(err as AuthError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' });
      setAuthState({
        isAuthenticated: false,
        token: null,
        user: null,
      });
    } catch (err) {
      console.error('Logout failed:', err);
      setError(err as AuthError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retry = useCallback(async () => {
    setError(null);
    await login();
  }, [login]);

  const value: AuthContextValue = {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    isLoading,
    error,
    login,
    logout,
    retry,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
