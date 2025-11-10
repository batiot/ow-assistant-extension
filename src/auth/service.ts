import type { AuthToken, AuthState, AuthConfig, UserInfo } from './types';
import { AuthError, AuthErrorType } from './types';
import { TokenStorage } from './storage';
import { retryOperation, toAuthError } from './retry';

/**
 * Timeout for silent authentication attempts (2.5 seconds)
 * After this time, silent auth is considered failed and visible popup is shown
 */
const SILENT_AUTH_TIMEOUT_MS = 2500;

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
   * 
   * Checks for authentication in the following order:
   * 1. Extension storage (cached token)
   * 2. Existing browser session (HTTP-only cookie via /api/v1/auths/)
   * 3. No authentication (user must login)
   */
  async initialize(): Promise<void> {
    // First, check extension storage for cached token
    let token = await TokenStorage.getToken();
    
    if (token && this.isTokenValid(token)) {
      try {
        const user = await this.validateToken(token.token);
        this.updateAuthState({
          isAuthenticated: true,
          token,
          user,
        });
        console.log('[Auth] Initialized from storage for user:', user.email);
        return;
      } catch (error) {
        // Token validation failed, clear it and continue to session check
        console.warn('[Auth] Stored token validation failed:', error);
        await TokenStorage.removeToken();
      }
    }

    // Second, check for existing browser session
    const sessionAuth = await this.checkSessionAuth();
    if (sessionAuth) {
      // Store the token for future use
      await TokenStorage.saveToken(sessionAuth.token);
      
      this.updateAuthState({
        isAuthenticated: true,
        token: sessionAuth.token,
        user: sessionAuth.user,
      });
      console.log('[Auth] Initialized from browser session for user:', sessionAuth.user.email);
      return;
    }

    // No authentication found
    console.log('[Auth] No authentication found, user must login');
  }

  /**
   * Start authentication flow
   * 
   * Authentication priority:
   * 1. Check if already authenticated (early return)
   * 2. Check for existing browser session (via /api/v1/auths/)
   * 3. Attempt silent authentication if appropriate (single provider, no form)
   * 4. Fall back to visible popup
   * 
   * Silent authentication flow:
   * - If single provider + no form, attempt silent auth for 2.5s
   * - On silent auth success, store token and return (no popup)
   * - On silent auth timeout/failure, fall through to visible popup
   * 
   * Visible popup flow:
   * - Multiple providers: show base URL for selection
   * - Login form enabled: show base URL
   * - Silent auth failed: show provider-specific URL
   */
  async login(): Promise<void> {
    try {
      // Early return if already authenticated
      if (this.isAuthenticated() && this.authState.token && this.isTokenValid(this.authState.token)) {
        console.log('[Auth] Already authenticated, skipping login');
        return;
      }

      // Check for existing browser session before opening any auth window
      console.log('[Auth] Checking for existing browser session...');
      const sessionAuth = await this.checkSessionAuth();
      
      if (sessionAuth) {
        // Session exists! Store token and update state
        await TokenStorage.saveToken(sessionAuth.token);
        
        this.updateAuthState({
          isAuthenticated: true,
          token: sessionAuth.token,
          user: sessionAuth.user,
        });
        
        console.log('[Auth] Successfully authenticated from existing session');
        return; // Done, no popup needed
      }
      
      console.log('[Auth] No existing session, proceeding with OAuth flow');

      // Determine the authentication URL based on backend config
      const authUrl = this.determineAuthEntryPoint();
      
      // Attempt silent authentication if appropriate
      if (this.shouldAttemptSilentAuth()) {
        const token = await this.attemptSilentAuth(authUrl);
        
        if (token) {
          // Silent auth succeeded! Validate, store, and update state
          const user = await this.validateToken(token.token);
          await TokenStorage.saveToken(token);
          
          this.updateAuthState({
            isAuthenticated: true,
            token,
            user,
          });
          
          console.log('[Auth] Silent authentication completed successfully');
          return; // Done, no popup needed
        }
        
        // Silent auth timed out or failed, fall through to visible popup
        console.log('[Auth] Falling back to visible popup');
      }
      
      // Create visible authentication popup
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

      // Wait for auth callback in popup window
      const token = await this.waitForAuthCallback(authWindow.id, false);
      
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
   * Determine if silent authentication should be attempted
   * 
   * Silent auth is attempted only when:
   * - Backend config exists
   * - Exactly one OAuth provider is configured
   * - Login form is disabled
   * 
   * @returns true if silent auth should be attempted, false otherwise
   */
  private shouldAttemptSilentAuth(): boolean {
    const backendConfig = this.config.backendConfig;
    if (!backendConfig) {
      console.log('[Auth] No backend config, skipping silent auth');
      return false;
    }
    
    const providers = Object.keys(backendConfig.oauth.providers);
    const hasForm = backendConfig.features.enable_login_form;
    
    const shouldAttempt = providers.length === 1 && !hasForm;
    
    if (shouldAttempt) {
      console.log('[Auth] Single provider + no form, eligible for silent auth');
    } else {
      console.log('[Auth] Multiple providers or form enabled, skipping silent auth');
    }
    
    return shouldAttempt;
  }

  /**
   * Attempt silent authentication using a hidden tab
   * 
   * Creates a hidden browser tab to attempt OAuth authentication without
   * showing UI to the user. If the user has an existing OAuth session,
   * authentication completes silently. Otherwise, times out after 2.5s.
   * 
   * @param authUrl - The OAuth provider URL to load
   * @returns AuthToken if successful, null if timeout or error
   */
  private async attemptSilentAuth(authUrl: string): Promise<AuthToken | null> {
    console.log('[Auth] Attempting silent authentication');
    
    let hiddenTab: chrome.tabs.Tab | undefined;
    
    try {
      // Create hidden tab (active: false means not visible/focused)
      hiddenTab = await chrome.tabs.create({
        url: authUrl,
        active: false,
      });
      
      if (!hiddenTab || !hiddenTab.id) {
        console.warn('[Auth] Failed to create hidden tab for silent auth');
        return null;
      }
      
      // Race between callback and timeout
      const result = await Promise.race([
        this.waitForAuthCallback(hiddenTab.id, true), // true = silent mode
        new Promise<null>((resolve) => 
          setTimeout(() => {
            console.log('[Auth] Silent auth timeout after', SILENT_AUTH_TIMEOUT_MS, 'ms');
            resolve(null);
          }, SILENT_AUTH_TIMEOUT_MS)
        ),
      ]);
      
      if (result) {
        console.log('[Auth] Silent authentication succeeded');
      } else {
        console.log('[Auth] Silent auth timed out, will show popup');
      }
      
      return result;
      
    } catch (error) {
      console.warn('[Auth] Silent auth error:', error);
      return null;
    } finally {
      // Always clean up hidden tab
      if (hiddenTab?.id) {
        try {
          await chrome.tabs.remove(hiddenTab.id);
        } catch (e) {
          // Tab might already be closed, ignore error
        }
      }
    }
  }

  /**
   * Wait for authentication callback
   * 
   * @param contextId - Window ID or Tab ID to monitor
   * @param isSilent - If true, monitoring a hidden tab; if false, monitoring a popup window
   * @returns Promise that resolves with AuthToken on success
   */
  private async waitForAuthCallback(contextId: number, isSilent: boolean = false): Promise<AuthToken> {
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
        tabId: number,
        _changeInfo: any,
        tab: chrome.tabs.Tab
      ) => {
        // For silent mode (tab), check tabId directly
        // For popup mode (window), check windowId
        const isRelevantTab = isSilent 
          ? tabId === contextId 
          : tab.windowId === contextId;
        
        if (!isRelevantTab || !tab.url) return;

        // Check for OAuth callback URL pattern (generic for any provider)
        // Matches: /oauth/{provider}/callback
        if (tab.url.includes('/oauth/') && tab.url.includes('/callback')) {
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
        // Only listen for window removal in popup mode (not silent mode)
        if (!isSilent && removedWindowId === contextId) {
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

      const tabRemovedListener = (tabId: number) => {
        // Only listen for tab removal in silent mode
        if (isSilent && tabId === contextId) {
          cleanup();
          reject(
            new AuthError(
              AuthErrorType.USER_CANCELLED,
              'Authentication tab closed',
              false
            )
          );
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        chrome.windows.onRemoved.removeListener(windowRemovedListener);
        chrome.tabs.onRemoved.removeListener(tabRemovedListener);
      };

      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      chrome.windows.onRemoved.addListener(windowRemovedListener);
      chrome.tabs.onRemoved.addListener(tabRemovedListener);
    });
  }

  /**
   * Determine the appropriate authentication entry point based on backend config
   */
  private determineAuthEntryPoint(): string {
    const backendConfig = this.config.backendConfig;
    
    // If no backend config, use default Microsoft OAuth
    if (!backendConfig) {
      console.log('Using default Microsoft OAuth (no backend config)');
      return `${this.config.baseUrl}/oauth/microsoft/login`;
    }

    const providers = backendConfig.oauth.providers;
    const providerKeys = Object.keys(providers);
    const enableLoginForm = backendConfig.features.enable_login_form;

    // Multiple providers or login form enabled: show base URL for user selection
    if (providerKeys.length > 1 || enableLoginForm) {
      console.log('Multiple providers or login form enabled, showing base URL');
      return this.config.baseUrl;
    }

    // Single provider and no login form: direct to provider OAuth
    if (providerKeys.length === 1) {
      const providerName = providerKeys[0];
      console.log(`Single provider (${providerName}), direct auth`);
      return `${this.config.baseUrl}/oauth/${providerName}/login`;
    }

    // No providers and no form: error case (fallback to base URL)
    console.warn('No OAuth providers configured, falling back to base URL');
    return this.config.baseUrl;
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
   * Check for existing session by calling /api/v1/auths/ without Authorization header
   * 
   * This method tests if a valid HTTP-only session cookie exists. Since the cookie
   * cannot be read directly (HttpOnly), we call the API endpoint and let the browser
   * automatically send the cookie. If valid, the API returns the token in the response.
   * 
   * @returns AuthToken with token value and user info if session exists, null otherwise
   */
  private async checkSessionAuth(): Promise<{ token: AuthToken; user: UserInfo } | null> {
    try {
      console.log('[Auth] Checking for existing session...');
      
      const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
        method: 'GET',
        credentials: 'include', // Important: includes HTTP-only cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.log('[Auth] No existing session (401/403)');
        } else {
          console.warn('[Auth] Session check failed with status:', response.status);
        }
        return null;
      }

      const data = await response.json();
      
      // Validate response has required fields
      if (!data.token || !data.id || !data.email || !data.name) {
        console.warn('[Auth] Session response missing required fields');
        return null;
      }

      console.log('[Auth] Existing session found for user:', data.email);

      // Create AuthToken - use far future expiry for session-based tokens (expires_at: null)
      const token: AuthToken = {
        token: data.token,
        expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year (backend is source of truth)
      };

      const user: UserInfo = {
        id: data.id,
        email: data.email,
        name: data.name,
      };

      return { token, user };
    } catch (error) {
      console.warn('[Auth] Session check error:', error);
      return null;
    }
  }

  /**
   * Validate token against API
   */
  private async validateToken(token: string): Promise<UserInfo> {
    try {
      return await retryOperation(async () => {
        // Create AbortController with 5 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
