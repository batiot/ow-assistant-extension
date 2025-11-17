import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthService } from '../../../src/auth/service';
import { TokenStorage } from '../../../src/auth/storage';
import type { AuthConfig } from '../../../src/auth/types';

// Mock chrome.storage and chrome.cookies
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
  get: vi.fn(),
};

const mockWindows = {
  create: vi.fn().mockResolvedValue({ id: 123 }),
  remove: vi.fn(),
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockTabs = {
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

global.chrome = {
  storage: mockStorage,
  cookies: mockCookies,
  windows: mockWindows,
  tabs: mockTabs,
} as any;

// Mock fetch globally
global.fetch = vi.fn();

/**
 * Unit tests for session-based authentication detection
 */
describe('AuthService - Session Detection', () => {
  const mockConfig: AuthConfig = {
    baseUrl: 'https://test.openwebui.com',
  };

  const mockSessionResponse = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    token: 'mock-jwt-token',
    token_type: 'Bearer',
    expires_at: null,
  };

  beforeEach(() => {
    AuthService.resetInstance();
    vi.clearAllMocks();
    
    // Reset chrome mocks
    mockCookies.get.mockReset();
    mockWindows.create.mockReset().mockResolvedValue({ id: 123 });
    mockWindows.remove.mockReset();
    mockWindows.onRemoved.addListener.mockReset();
    mockWindows.onRemoved.removeListener.mockReset();
    mockTabs.onUpdated.addListener.mockReset();
    mockTabs.onUpdated.removeListener.mockReset();
    mockTabs.onRemoved.addListener.mockReset();
    mockTabs.onRemoved.removeListener.mockReset();
    
    // Reset fetch mock
    (global.fetch as any).mockReset();
    
    // Mock TokenStorage methods
    vi.spyOn(TokenStorage, 'getToken').mockResolvedValue(null);
    vi.spyOn(TokenStorage, 'saveToken').mockResolvedValue(undefined);
    vi.spyOn(TokenStorage, 'removeToken').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize() with session detection', () => {
    it('should check session when no stored token exists', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        value: 'cookie-token-value',
      });

      // Mock successful session response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSessionResponse,
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Verify cookie was read
      expect(mockCookies.get).toHaveBeenCalledWith({
        url: 'https://test.openwebui.com',
        name: 'token',
      });

      // Verify fetch was called with Authorization Bearer header
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/v1/auths/',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer cookie-token-value',
          },
        })
      );

      // Verify token was stored
      expect(TokenStorage.saveToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock-jwt-token',
        })
      );

      // Verify state was updated
      const state = service.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
    });

    it('should skip session check when valid stored token exists', async () => {
      // Mock stored token
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue({
        token: 'stored-token',
        expiresAt: Date.now() + 1000000,
      });

      // Mock token validation
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-id',
          email: 'stored@example.com',
          name: 'Stored User',
        }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Should only call fetch once for token validation (with Authorization header)
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/v1/auths/',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer stored-token',
          }),
        })
      );
    });

    it('should handle 401 Unauthorized session response', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        value: 'invalid-cookie-token',
      });

      // Mock 401 response (no session)
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Verify token was not stored
      expect(TokenStorage.saveToken).not.toHaveBeenCalled();

      // Verify state remains unauthenticated
      const state = service.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should skip session check when no cookie exists', async () => {
      // Mock no cookie found
      mockCookies.get.mockResolvedValueOnce(null);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Verify fetch was not called (no cookie to send)
      expect(global.fetch).not.toHaveBeenCalled();

      // Verify state remains unauthenticated
      const state = service.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle session response missing token field', async () => {
      // Mock response without token
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          // token field missing
        }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Verify token was not stored
      expect(TokenStorage.saveToken).not.toHaveBeenCalled();

      // Verify state remains unauthenticated
      const state = service.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle network errors during session check', async () => {
      // Mock network error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Should not throw, just log and continue
      expect(TokenStorage.saveToken).not.toHaveBeenCalled();

      const state = service.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should fall back to session check when stored token is invalid', async () => {
      // Mock invalid stored token
      vi.spyOn(TokenStorage, 'getToken').mockResolvedValue({
        token: 'invalid-token',
        expiresAt: Date.now() + 1000000,
      });

      // Mock token validation failure
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Mock no cookie (so no session check happens)
      mockCookies.get.mockResolvedValueOnce(null);

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Should call fetch once for validation (session check skipped due to no cookie)
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify token was removed due to validation failure
      expect(TokenStorage.removeToken).toHaveBeenCalled();
    });
  });

  describe('login() with session detection', () => {
    it('should check session before opening OAuth popup', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        value: 'session-cookie-token',
      });

      // Mock successful session response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSessionResponse,
      });

      const service = AuthService.getInstance(mockConfig);
      await service.login();

      // Verify fetch was called for session check with Authorization Bearer header
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/v1/auths/',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer session-cookie-token',
          },
        })
      );

      // Verify token was stored
      expect(TokenStorage.saveToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock-jwt-token',
        })
      );

      // Verify state was updated
      const state = service.getState();
      expect(state.isAuthenticated).toBe(true);
    });

    it('should skip OAuth popup when session exists', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        value: 'valid-session-cookie',
      });

      // Mock successful session response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSessionResponse,
      });

      const service = AuthService.getInstance(mockConfig);
      await service.login();

      // Verify popup was NOT created
      expect(mockWindows.create).not.toHaveBeenCalled();
    });

    it('should proceed to OAuth when no session exists', async () => {
      // Mock no cookie
      mockCookies.get.mockResolvedValueOnce(null);

      const service = AuthService.getInstance(mockConfig);
      
      // Start login but don't wait for it to complete (it will timeout)
      service.login().catch(() => {
        // Expected to fail since we're not completing the OAuth flow
      });

      // Wait a bit for OAuth start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify no fetch call was made (no cookie to send)
      expect(global.fetch).not.toHaveBeenCalled();

      // Verify popup was created (OAuth flow started)
      expect(global.chrome.windows.create).toHaveBeenCalled();
    });
  });

  describe('session response validation', () => {
    it('should extract complete user info from session response', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        value: 'test-cookie-token',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-123',
          email: 'user@test.com',
          name: 'Full Name',
          role: 'admin',
          token: 'jwt-token-value',
          token_type: 'Bearer',
          expires_at: null,
          profile_image_url: '/avatar.png',
        }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      const state = service.getState();
      expect(state.user).toEqual({
        id: 'user-123',
        email: 'user@test.com',
        name: 'Full Name',
      });
    });

    it('should handle empty token string', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        value: 'test-cookie',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          token: '', // Empty token
          token_type: 'Bearer',
          expires_at: null,
        }),
      });

      const service = AuthService.getInstance(mockConfig);
      await service.initialize();

      // Should not store empty token (validation should fail)
      expect(TokenStorage.saveToken).not.toHaveBeenCalled();

      const state = service.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
