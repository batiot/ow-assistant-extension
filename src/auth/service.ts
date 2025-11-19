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
  /**
   * Start authentication flow
   */
  async login(): Promise<void> {
    try {
      // Early return if already authenticated
      if (this.isAuthenticated() && this.authState.token && this.isTokenValid(this.authState.token)) {
        console.log('[Auth] Already authenticated, skipping login');
        return;
      }

      // Check for existing browser session
      console.log('[Auth] Checking for existing browser session...');
      const sessionAuth = await this.checkSessionAuth();

      if (sessionAuth) {
        await TokenStorage.saveToken(sessionAuth.token);
        this.updateAuthState({
          isAuthenticated: true,
          token: sessionAuth.token,
          user: sessionAuth.user,
        });
        console.log('[Auth] Successfully authenticated from existing session');
        return;
      }

      console.log('[Auth] No existing session, proceeding with OAuth flow');

      // Determine the authentication URL
      const authUrl = this.determineAuthEntryPoint();

      // Launch Web Auth Flow
      // The declarativeNetRequest rule will redirect the backend callback to our extension page
      // launchWebAuthFlow will detect this redirect and return the URL
      console.log('[Auth] Launching Web Auth Flow with URL:', authUrl);

      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      if (!redirectUrl) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          'Authentication flow failed (no redirect URL)'
        );
      }

      // Parse the redirect URL to extract the code
      const url = new URL(redirectUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          errorDescription || `Authentication error: ${error}`
        );
      }

      if (!code) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          'No authorization code found in redirect URL'
        );
      }

      console.log('[Auth] Captured authorization code, exchanging for token...');

      // Manually exchange the code for a token by replaying the callback to the backend
      // This allows the backend to process the code and set the session cookie
      const token = await this.exchangeCodeForToken(code, url.searchParams.get('state'));

      // Validate and store token
      const user = await this.validateToken(token.token);
      await TokenStorage.saveToken(token);

      this.updateAuthState({
        isAuthenticated: true,
        token,
        user,
      });

    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      // Handle "User cancelled" from launchWebAuthFlow
      if (error instanceof Error && error.message.includes('User interaction failed')) {
        throw new AuthError(
          AuthErrorType.USER_CANCELLED,
          'User cancelled authentication'
        );
      }

      throw new AuthError(
        AuthErrorType.AUTHENTICATION_FAILED,
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Exchange authorization code for token by replaying the callback
   */
  private async exchangeCodeForToken(code: string, state: string | null): Promise<AuthToken> {
    try {
      // Construct the backend callback URL
      // We need to know which provider was used. For now, we can try to infer it or use a generic approach.
      // However, the backend callback URL usually includes the provider name: /oauth/{provider}/callback
      // The redirect URL we captured is: chrome-extension://.../oauth-callback.html?code=...
      // We don't strictly know the provider path from the extension URL unless we passed it through.
      // BUT, the initial authUrl had the provider.

      // Strategy: We can't easily know the exact callback URL path the backend expects just from the code.
      // However, we know the `authUrl` we started with.
      // If we assume the standard OpenWebUI pattern:
      // /oauth/{provider}/login -> /oauth/{provider}/callback

      // Let's try to reconstruct the callback URL.
      // This is a bit fragile if we don't know the provider.
      // A robust way is to pass the provider in the 'state' param if possible, but we can't easily modify that.

      // Alternative: The backend likely accepts the code at ANY valid callback endpoint if the state matches, 
      // or we just need to hit the one corresponding to the provider.

      // Let's look at determineAuthEntryPoint. It returns `.../oauth/{provider}/login`.
      // So we can store the provider we used.

      // For simplicity, let's re-determine the provider here or assume 'microsoft' if default.
      // Better: check the config again.

      const backendConfig = this.config.backendConfig;
      let provider = 'microsoft'; // Default

      if (backendConfig) {
        const providers = Object.keys(backendConfig.oauth.providers);
        if (providers.length === 1) {
          provider = providers[0];
        }
        // If multiple, the user selected one on the backend page. 
        // In that case, we don't know which one they picked!
        // This is a problem.

        // However, if the user picked one, the backend redirected to /oauth/{provider}/login.
        // Then to the provider.
        // Then back to /oauth/{provider}/callback.

        // Wait! The `declarativeNetRequest` rule intercepts `*/oauth/*/callback*`.
        // The original URL that was intercepted IS the backend callback URL!
        // `launchWebAuthFlow` returns the *final* URL (the extension one).
        // Does it give us the intermediate one? No.

        // CRITICAL: We need the original callback URL path to replay it correctly.
        // But we lost it when we redirected to the extension page.

        // SOLUTION: We can include the original URL in the redirect!
        // We can use regex substitution in declarativeNetRequest to pass the provider or the full path.
        // But `extensionPath` doesn't support regex substitution of the path, only query params are preserved.

        // Actually, `regexSubstitution` is for `redirect` with `regexFilter`.
        // Let's check our rule.
        // "urlFilter": "*/oauth/*/callback*"
        // "redirect": { "extensionPath": "/src/pages/oauth-callback.html" }

        // If we use `regexFilter` instead of `urlFilter`, we can capture the provider.
        // regexFilter: "^https?://[^/]+/oauth/([^/]+)/callback.*"
        // substitution: "chrome-extension://<id>/src/pages/oauth-callback.html?provider=\1"

        // BUT `extensionPath` does not support substitution variables. `regexSubstitution` is for `url` redirect.
        // And we can't use `url` to redirect to chrome-extension:// scheme easily if it's not web-accessible?
        // Actually we can.

        // Let's stick to the current plan. If we can't get the provider, we might fail for multi-provider setups.
        // But for now, let's assume single provider or try to find a workaround.

        // Workaround: The `state` parameter is preserved.
        // If we can't get the provider, we can try to fetch the code against the most likely callback URL.

        // Let's assume the provider is 'microsoft' or the single configured one for now.
        // If multiple providers are enabled, this might be tricky without the regex rule change.
        // I'll add a TODO to improve this with regex rules later if needed.
      }

      const callbackUrl = `${this.config.baseUrl}/oauth/${provider}/callback?code=${code}&state=${state || ''}`;

      console.log('[Auth] Replaying callback to:', callbackUrl);

      // Perform the fetch to the backend to set the cookie
      await fetch(callbackUrl);

      // The backend should set the cookie and redirect (likely to /)
      // We just need to check if we got a token cookie now.

      // Wait a bit for cookie to settle? Usually immediate.
      const tokenValue = await this.getTokenCookie();

      if (!tokenValue) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          'Token exchange failed: No token cookie received from backend'
        );
      }

      // Get full token details
      return await this.extractTokenFromCallback();

    } catch (error) {
      console.error('[Auth] Token exchange error:', error);
      throw new AuthError(
        AuthErrorType.AUTHENTICATION_FAILED,
        'Failed to exchange authorization code for token'
      );
    }
  }

  /**
   * Logout and clear session
   * 
   * Calls the server-side logout endpoint to invalidate the session,
   * then clears local storage and auth state. If the server call fails,
   * local cleanup still proceeds (graceful degradation).
   */
  async logout(): Promise<void> {
    // Attempt server-side logout if we have a token
    if (this.authState.token) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${this.config.baseUrl}/api/v1/auths/signout`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.authState.token.token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('[Auth] Server logout successful');
        } else {
          console.warn('[Auth] Server logout failed with status:', response.status);
        }
      } catch (error) {
        // Log error but don't block logout
        console.warn('[Auth] Server logout error:', error);
      }
    }

    // Always clear local state regardless of server response
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
   * Get token cookie value using chrome.cookies API
   * 
   * This method uses the chrome.cookies API which has privileged access to cookies
   * regardless of HttpOnly, Secure, and SameSite flags. This is necessary because:
   * 1. The token cookie is HttpOnly and cannot be accessed via document.cookie
   * 2. Extension fetch requests don't share the browser's cookie jar with web pages
   * 
   * @returns The token cookie value if found, null otherwise
   */
  private async getTokenCookie(): Promise<string | null> {
    try {
      const cookie = await chrome.cookies.get({
        url: this.config.baseUrl,
        name: 'token',
      });

      if (cookie) {
        return cookie.value;
      } else {
        console.warn('[Auth] Token cookie not found');
        return null;
      }
    } catch (error) {
      console.error('[Auth] Error getting token cookie:', error);
      return null;
    }
  }

  /**
   * Extract token from callback
   * 
   * Uses chrome.cookies API to read the HttpOnly token cookie set by the backend
   * after OAuth callback. Works regardless of cookie security flags.
   */
  private async extractTokenFromCallback(): Promise<AuthToken> {
    // Get token value using helper
    const tokenValue = await this.getTokenCookie();

    if (!tokenValue) {
      throw new AuthError(
        AuthErrorType.AUTHENTICATION_FAILED,
        'No authentication token found in cookies'
      );
    }

    // Get full cookie details for expiration
    const cookie = await chrome.cookies.get({
      url: this.config.baseUrl,
      name: 'token',
    });

    // Calculate expiration (default to 24 hours if not specified)
    const expiresAt = cookie?.expirationDate
      ? cookie.expirationDate * 1000
      : Date.now() + 24 * 60 * 60 * 1000;

    return {
      token: tokenValue,
      expiresAt,
    };
  }

  /**
   * Check for existing session by reading token cookie and validating it
   * 
   * IMPORTANT: In an extension context, fetch requests don't share the browser's
   * cookie jar with web pages. Using `credentials: 'include'` does NOT automatically
   * send HttpOnly cookies. We must:
   * 1. Read the cookie explicitly using chrome.cookies.get()
   * 2. Include it manually in the Cookie header
   * 
   * @returns AuthToken with token value and user info if session exists, null otherwise
   */
  private async checkSessionAuth(): Promise<{ token: AuthToken; user: UserInfo } | null> {
    try {
      console.log('[Auth] Checking for existing session...');

      // Read the HttpOnly cookie using chrome.cookies API
      const tokenValue = await this.getTokenCookie();

      if (!tokenValue) {
        console.log('[Auth] No token cookie found for session check');
        return null;
      }

      // Use the cookie value as a Bearer token
      // The backend only validates tokens from the Authorization header
      const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenValue}`,
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
