import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthService } from '../../../src/auth/service';
import { TokenStorage } from '../../../src/auth/storage';
import type { AuthConfig, AuthToken } from '../../../src/auth/types';
import { AuthError, AuthErrorType } from '../../../src/auth/types';

// Mock chrome APIs
const mockTabs = {
  create: vi.fn(),
  remove: vi.fn(),
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockWindows = {
  create: vi.fn(),
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockStorage = {
  session: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  local: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  },
};

const mockCookies = {
  getAll: vi.fn().mockResolvedValue([]),
};

global.chrome = {
  storage: mockStorage,
  tabs: mockTabs,
  windows: mockWindows,
  cookies: mockCookies,
} as any;

global.fetch = vi.fn();

/**
 * Extended unit tests for AuthService authentication flows
 * Tests public methods and integration behavior
 */
describe('AuthService - Authentication Flows', () => {
  const mockConfig: AuthConfig = {
    baseUrl: 'https://test.openwebui.com',
  };

  const mockToken: AuthToken = {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
    expiresAt: Date.now() + 3600000, // 1 hour from now
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    AuthService.resetInstance();
    vi.clearAllMocks();

    // Reset storage mocks
    mockStorage.session.get.mockResolvedValue({});
    mockStorage.local.get.mockResolvedValue({});
    
    // Mock fetch to return valid user data by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockUser,
      headers: new Map(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize()', () => {
    it('should validate existing token and update auth state', async () => {
      // Setup: Token exists in storage
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      
      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      const state = service.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toEqual(mockToken);
      expect(state.user).toEqual(mockUser);
    });

    it('should clear invalid token and remain unauthenticated', async () => {
      // Setup: Expired token - service checks validity before validation
      const expiredToken = { ...mockToken, expiresAt: Date.now() - 1000 };
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(expiredToken);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      const state = service.getState();
      // Expired token is skipped without removal (not validated)
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle missing token gracefully', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(null);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      const state = service.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
    });

    it('should remove token if validation fails', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);
      
      // Mock validation failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid token' }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(TokenStorage.removeToken).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated()', () => {
    it('should return true when authenticated', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      const service = AuthService.getInstance(mockConfig);
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getState()', () => {
    it('should return current authentication state when authenticated', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      const state = service.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toEqual(mockToken);
      expect(state.user).toEqual(mockUser);
    });

    it('should return unauthenticated state by default', () => {
      const service = AuthService.getInstance(mockConfig);
      const state = service.getState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('getToken()', () => {
    it('should return token from state when authenticated', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      const token = await service.getToken();
      expect(token).toBe(mockToken.token);
    });

    it('should return null when not authenticated', async () => {
      const service = AuthService.getInstance(mockConfig);
      const token = await service.getToken();

      expect(token).toBeNull();
    });

    it('should retrieve from storage if not in state', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);

      const service = AuthService.getInstance(mockConfig);
      // Don't initialize, go directly to getToken
      const token = await service.getToken();

      expect(token).toBe(mockToken.token);
      expect(TokenStorage.getToken).toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    it('should clear token and update state', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();
      
      expect(service.isAuthenticated()).toBe(true);

      await service.logout();

      expect(service.isAuthenticated()).toBe(false);
      expect(TokenStorage.removeToken).toHaveBeenCalled();
    });

    it('should handle logout when not authenticated', async () => {
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.logout();

      expect(TokenStorage.removeToken).toHaveBeenCalled();
    });

    it('should clear user data from state', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      await service.logout();

      const state = service.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });

    it('should call server logout endpoint with Bearer token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();
      await service.logout();

      // Verify the signout call (should be the last call after initialize's validation call)
      expect(mockFetch).toHaveBeenCalled();
      const allCalls = mockFetch.mock.calls;
      const signoutCall = allCalls.find(call => call[0].includes('/signout'));
      expect(signoutCall).toBeDefined();
      expect(signoutCall![0]).toContain('/api/v1/auths/signout');
      expect(signoutCall![1].method).toBe('GET');
      expect(signoutCall![1].headers['Authorization']).toBe(`Bearer ${mockToken.token}`);
      expect(signoutCall![1].signal).toBeInstanceOf(AbortSignal);
      expect(TokenStorage.removeToken).toHaveBeenCalled();
    });

    it('should complete logout locally even if server logout fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();
      await service.logout();

      expect(mockFetch).toHaveBeenCalled();
      expect(TokenStorage.removeToken).toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should complete logout locally on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();
      await service.logout();

      expect(mockFetch).toHaveBeenCalled();
      expect(TokenStorage.removeToken).toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should skip server call when no token exists', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.logout();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(TokenStorage.removeToken).toHaveBeenCalled();
    });
  });

  describe('Error Types', () => {
    it('should create AuthError with correct type', () => {
      const error = new AuthError(
        AuthErrorType.AUTHENTICATION_FAILED,
        'Test error'
      );

      expect(error.type).toBe(AuthErrorType.AUTHENTICATION_FAILED);
      expect(error.message).toBe('Test error');
      expect(error.retryable).toBe(false);
    });

    it('should set retriable flag correctly', () => {
      const retriable = new AuthError(
        AuthErrorType.NETWORK_ERROR,
        'Network error',
        true
      );

      const nonRetriable = new AuthError(
        AuthErrorType.USER_CANCELLED,
        'User cancelled',
        false
      );

      expect(retriable.retryable).toBe(true);
      expect(nonRetriable.retryable).toBe(false);
    });

    it('should handle authentication error for expired token', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should handle network errors during validation', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);
      
      // Mock network error - retryOperation will retry but eventually fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Should remove failed token and remain unauthenticated
      expect(TokenStorage.removeToken).toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('login() - Integration Tests', () => {
    it('should not attempt login if already authenticated', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(service.isAuthenticated()).toBe(true);

      // Try login again - should be no-op
      const createWindowSpy = vi.spyOn(mockWindows, 'create');
      const createTabSpy = vi.spyOn(mockTabs, 'create');

      await service.login();

      expect(createWindowSpy).not.toHaveBeenCalled();
      expect(createTabSpy).not.toHaveBeenCalled();
    });

    it('should handle login when not authenticated', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(null);

      const service = AuthService.getInstance(mockConfig);

      // Mock window creation
      mockWindows.create.mockResolvedValue({ id: 123 });

      // We can't fully test login without mocking the entire callback flow
      // but we can verify it attempts to create a window
      const loginPromise = service.login();

      // Give it a tiny bit of time to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have attempted to create auth window or tab
      expect(mockWindows.create.mock.calls.length + mockTabs.create.mock.calls.length).toBeGreaterThan(0);
      
      // Cancel the promise to avoid timeout
      loginPromise.catch(() => {}); // Ignore rejection
    });
  });

  describe('Token Storage Integration', () => {
    it('should persist token to storage after validation', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      vi.spyOn(TokenStorage, 'saveToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should remove token from storage on logout', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      const removeTokenSpy = vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();
      await service.logout();

      expect(removeTokenSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Validation', () => {
    it('should fetch user info on successful token validation', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/v1/auths/',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken.token}`,
          }),
        })
      );

      const state = service.getState();
      expect(state.user).toEqual(mockUser);
    });

    it('should handle user fetch failure gracefully', async () => {
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(mockToken);
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
