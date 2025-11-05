import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenStorage } from '../../../src/auth/storage';
import type { AuthToken } from '../../../src/auth/types';

// Mock chrome.storage
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

global.chrome = {
  storage: mockStorage,
} as any;

describe('TokenStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveToken', () => {
    it('should save token to session storage when available', async () => {
      const token: AuthToken = {
        token: 'test-token',
        expiresAt: Date.now() + 3600000,
      };

      await TokenStorage.saveToken(token);

      expect(mockStorage.session.set).toHaveBeenCalledWith(
        expect.objectContaining({
          auth_token: expect.objectContaining({
            version: 1,
            data: token,
          }),
        })
      );
    });
  });

  describe('getToken', () => {
    it('should retrieve valid token from storage', async () => {
      const token: AuthToken = {
        token: 'test-token',
        expiresAt: Date.now() + 3600000,
      };

      mockStorage.session.get.mockResolvedValueOnce({
        auth_token: {
          version: 1,
          data: token,
          savedAt: Date.now(),
        },
      });

      const retrieved = await TokenStorage.getToken();

      expect(retrieved).toEqual(token);
    });

    it('should return null for expired token', async () => {
      const expiredToken: AuthToken = {
        token: 'expired-token',
        expiresAt: Date.now() - 1000,
      };

      mockStorage.session.get.mockResolvedValueOnce({
        auth_token: {
          version: 1,
          data: expiredToken,
          savedAt: Date.now() - 5000,
        },
      });

      const retrieved = await TokenStorage.getToken();

      expect(retrieved).toBeNull();
      expect(mockStorage.session.remove).toHaveBeenCalledWith('auth_token');
    });

    it('should return null for invalid version', async () => {
      mockStorage.session.get.mockResolvedValueOnce({
        auth_token: {
          version: 0,
          data: { token: 'test', expiresAt: Date.now() + 1000 },
          savedAt: Date.now(),
        },
      });

      const retrieved = await TokenStorage.getToken();

      expect(retrieved).toBeNull();
    });
  });

  describe('removeToken', () => {
    it('should remove token from both storages', async () => {
      await TokenStorage.removeToken();

      expect(mockStorage.session.remove).toHaveBeenCalledWith('auth_token');
      expect(mockStorage.local.remove).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('hasValidToken', () => {
    it('should return true when valid token exists', async () => {
      const token: AuthToken = {
        token: 'test-token',
        expiresAt: Date.now() + 3600000,
      };

      mockStorage.session.get.mockResolvedValueOnce({
        auth_token: {
          version: 1,
          data: token,
          savedAt: Date.now(),
        },
      });

      const hasToken = await TokenStorage.hasValidToken();

      expect(hasToken).toBe(true);
    });

    it('should return false when no token exists', async () => {
      mockStorage.session.get.mockResolvedValueOnce({});

      const hasToken = await TokenStorage.hasValidToken();

      expect(hasToken).toBe(false);
    });
  });
});
