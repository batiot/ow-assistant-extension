import type { AuthToken, AuthState, AuthConfig, UserInfo } from './types';
import { AuthError, AuthErrorType } from './types';
import { TokenStorage } from './storage';
import { retryOperation, toAuthError } from './retry';

/**
 * Main authentication service
 */
export class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    token: null,
    user: null,
  };
  private config: AuthConfig;
  private listeners: Set<(state: AuthState) => void> = new Set();

  private constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: AuthConfig): AuthService {
    if (!AuthService.instance) {
      if (!config) {
        throw new Error('AuthService requires config for initialization');
      }
      AuthService.instance = new AuthService(config);
    }
    return AuthService.instance;
  }

  /**
   * Reset singleton instance (useful when config changes)
   */
  static resetInstance(): void {
    AuthService.instance = undefined as any;
  }

  /**
   * Update configuration (e.g., when base URL changes)
   */
  updateConfig(config: AuthConfig): void {
    this.config = config;
  }

  /**
   * Initialize auth service and restore session if available
   */
  async initialize(): Promise<void> {
    const token = await TokenStorage.getToken();
    
    if (token && this.isTokenValid(token)) {
      try {
        const user = await this.validateToken(token.token);
        this.updateAuthState({
          isAuthenticated: true,
          token,
          user,
        });
      } catch (error) {
        // Token validation failed, clear it
        await TokenStorage.removeToken();
      }
    }
  }

  /**
   * Start authentication flow
   */
  async login(): Promise<void> {
    try {
      const authUrl = `${this.config.baseUrl}/oauth/microsoft/login`;
      
      // Create authentication window
      const authWindow = await chrome.windows.create({
        url: authUrl,
        type: 'popup',
        width: 500,
        height: 700,
      });

      if (!authWindow || !authWindow.id) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          'Failed to create authentication window'
        );
      }

      // Wait for auth callback
      const token = await this.waitForAuthCallback(authWindow.id);
      
      // Validate and store token
      const user = await this.validateToken(token.token);
      await TokenStorage.saveToken(token);
      
      this.updateAuthState({
        isAuthenticated: true,
        token,
        user,
      });

      // Close auth window
      await chrome.windows.remove(authWindow.id);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        AuthErrorType.AUTHENTICATION_FAILED,
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    await TokenStorage.removeToken();
    this.updateAuthState({
      isAuthenticated: false,
      token: null,
      user: null,
    });
  }

  /**
   * Get current authentication state
   */
  getState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && this.authState.token !== null;
  }

  /**
   * Get current token
   */
  async getToken(): Promise<string | null> {
    if (!this.authState.token) {
      const stored = await TokenStorage.getToken();
      if (stored && this.isTokenValid(stored)) {
        return stored.token;
      }
      return null;
    }

    if (!this.isTokenValid(this.authState.token)) {
      await this.logout();
      return null;
    }

    return this.authState.token.token;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (state: AuthState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Wait for authentication callback
   */
  private async waitForAuthCallback(windowId: number): Promise<AuthToken> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new AuthError(
            AuthErrorType.AUTHENTICATION_FAILED,
            'Authentication timeout',
            true
          )
        );
      }, 300000); // 5 minutes

      const tabUpdateListener = (
        _tabId: number,
        _changeInfo: any,
        tab: chrome.tabs.Tab
      ) => {
        if (tab.windowId !== windowId || !tab.url) return;

        // Check for callback URL
        if (tab.url.includes('/oauth/microsoft/callback')) {
          const url = new URL(tab.url);
          
          // Check for error
          if (url.searchParams.has('error')) {
            const error = url.searchParams.get('error');
            const description = url.searchParams.get('error_description');
            
            cleanup();
            
            if (error === 'access_denied') {
              reject(
                new AuthError(
                  AuthErrorType.USER_CANCELLED,
                  description || 'User cancelled authentication',
                  false
                )
              );
            } else {
              reject(
                new AuthError(
                  AuthErrorType.AUTHENTICATION_FAILED,
                  description || 'Authentication failed',
                  true
                )
              );
            }
            return;
          }

          // Extract token from cookie
          this.extractTokenFromCallback()
            .then((token) => {
              cleanup();
              resolve(token);
            })
            .catch((error) => {
              cleanup();
              reject(error);
            });
        }
      };

      const windowRemovedListener = (removedWindowId: number) => {
        if (removedWindowId === windowId) {
          cleanup();
          reject(
            new AuthError(
              AuthErrorType.USER_CANCELLED,
              'Authentication window closed',
              false
            )
          );
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        chrome.windows.onRemoved.removeListener(windowRemovedListener);
      };

      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      chrome.windows.onRemoved.addListener(windowRemovedListener);
    });
  }

  /**
   * Extract token from callback
   */
  private async extractTokenFromCallback(): Promise<AuthToken> {
    // Get token from cookie after callback
    const cookies = await chrome.cookies.getAll({
      url: this.config.baseUrl,
      name: 'token',
    });

    if (cookies.length === 0) {
      throw new AuthError(
        AuthErrorType.AUTHENTICATION_FAILED,
        'No authentication token found in cookies'
      );
    }

    const tokenCookie = cookies[0];
    
    // Calculate expiration (default to session if not specified)
    const expiresAt = tokenCookie.expirationDate
      ? tokenCookie.expirationDate * 1000
      : Date.now() + 24 * 60 * 60 * 1000; // 24 hours default

    return {
      token: tokenCookie.value,
      expiresAt,
    };
  }

  /**
   * Validate token against API
   */
  private async validateToken(token: string): Promise<UserInfo> {
    try {
      return await retryOperation(async () => {
        const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new AuthError(
            AuthErrorType.INVALID_TOKEN,
            'Token validation failed'
          );
        }

        const data = await response.json();
        
        return {
          id: data.id,
          email: data.email,
          name: data.name,
        };
      }, { maxAttempts: 2 });
    } catch (error) {
      throw toAuthError(error);
    }
  }

  /**
   * Check if token is valid (not expired)
   */
  private isTokenValid(token: AuthToken): boolean {
    return token.expiresAt > Date.now();
  }

  /**
   * Update auth state and notify listeners
   */
  private updateAuthState(newState: AuthState): void {
    this.authState = newState;
    this.listeners.forEach((listener) => listener(newState));
  }
}
