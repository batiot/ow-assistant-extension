import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../../src/auth/service';
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

global.chrome = {
  storage: mockStorage,
  cookies: mockCookies,
} as any;

/**
 * Unit tests for cookie-based token extraction using chrome.cookies API
 */
describe('AuthService - Cookie Extraction', () => {
  const mockConfig: AuthConfig = {
    baseUrl: 'http://localhost:8080',
  };

  beforeEach(() => {
    AuthService.resetInstance();
    vi.clearAllMocks();
  });

  describe('getTokenCookie()', () => {
    it('should successfully retrieve token cookie value', async () => {
      // Mock cookie found
      mockCookies.get.mockResolvedValueOnce({
        name: 'token',
        value: 'test-token-value',
        domain: 'localhost',
        path: '/',
        secure: false,
        httpOnly: true,
        sameSite: 'strict',
      });

      const service = AuthService.getInstance(mockConfig);
      // Access private method via any cast for testing
      const result = await (service as any).getTokenCookie();

      expect(mockCookies.get).toHaveBeenCalledWith({
        url: 'http://localhost:8080',
        name: 'token',
      });
      expect(result).toBe('test-token-value');
    });

    it('should return null when cookie not found', async () => {
      // Mock cookie not found
      mockCookies.get.mockResolvedValueOnce(null);

      const service = AuthService.getInstance(mockConfig);
      const result = await (service as any).getTokenCookie();

      expect(result).toBe(null);
    });

    it('should handle cookie API errors gracefully', async () => {
      // Mock error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCookies.get.mockRejectedValueOnce(new Error('Cookie access denied'));

      const service = AuthService.getInstance(mockConfig);
      const result = await (service as any).getTokenCookie();

      expect(result).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Auth] Error getting token cookie:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should work with different base URLs', async () => {
      const customConfig: AuthConfig = {
        baseUrl: 'https://custom.example.com',
      };

      mockCookies.get.mockResolvedValueOnce({
        name: 'token',
        value: 'custom-token',
      });

      const service = AuthService.getInstance(customConfig);
      await (service as any).getTokenCookie();

      expect(mockCookies.get).toHaveBeenCalledWith({
        url: 'https://custom.example.com',
        name: 'token',
      });
    });

    it('should access HttpOnly cookies via privileged API', async () => {
      // Mock HttpOnly cookie
      mockCookies.get.mockResolvedValueOnce({
        name: 'token',
        value: 'httponly-token',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      const service = AuthService.getInstance(mockConfig);
      const result = await (service as any).getTokenCookie();

      // Should successfully retrieve HttpOnly cookie
      expect(result).toBe('httponly-token');
    });
  });

  describe('extractTokenFromCallback()', () => {
    it('should extract token using getTokenCookie helper', async () => {
      // Mock cookie found with expiration
      mockCookies.get
        .mockResolvedValueOnce({ value: 'callback-token' }) // First call from getTokenCookie
        .mockResolvedValueOnce({
          value: 'callback-token',
          expirationDate: (Date.now() / 1000) + 3600, // 1 hour from now
        }); // Second call for full cookie details

      const service = AuthService.getInstance(mockConfig);
      const result = await (service as any).extractTokenFromCallback();

      expect(result).toEqual({
        token: 'callback-token',
        expiresAt: expect.any(Number),
      });
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should throw error when cookie not found', async () => {
      // Mock cookie not found
      mockCookies.get.mockResolvedValueOnce(null);

      const service = AuthService.getInstance(mockConfig);

      await expect((service as any).extractTokenFromCallback()).rejects.toThrow(
        'No authentication token found in cookies'
      );
    });

    it('should default to 24 hours expiration for session cookies', async () => {
      const now = Date.now();
      
      // Mock session cookie (no expirationDate)
      mockCookies.get
        .mockResolvedValueOnce({ value: 'session-token' })
        .mockResolvedValueOnce({
          value: 'session-token',
          expirationDate: undefined, // Session cookie
        });

      const service = AuthService.getInstance(mockConfig);
      const result = await (service as any).extractTokenFromCallback();

      expect(result.token).toBe('session-token');
      // Should be approximately 24 hours from now
      const expectedExpiry = now + 24 * 60 * 60 * 1000;
      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(result.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should handle cookies with explicit expiration dates', async () => {
      const futureTimestamp = (Date.now() / 1000) + 7200; // 2 hours from now
      
      mockCookies.get
        .mockResolvedValueOnce({ value: 'expiring-token' })
        .mockResolvedValueOnce({
          value: 'expiring-token',
          expirationDate: futureTimestamp,
        });

      const service = AuthService.getInstance(mockConfig);
      const result = await (service as any).extractTokenFromCallback();

      expect(result.expiresAt).toBe(futureTimestamp * 1000);
    });
  });
});
