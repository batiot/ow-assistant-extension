import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../../../src/auth/crypto';

describe('Auth Crypto', () => {
  const mockCrypto = {
    subtle: {
      generateKey: vi.fn(() =>
        Promise.resolve({
          type: 'secret',
          extractable: true,
          algorithm: { name: 'AES-GCM', length: 256 },
          usages: ['encrypt', 'decrypt'],
        } as CryptoKey)
      ),
      exportKey: vi.fn(() =>
        Promise.resolve(new ArrayBuffer(32)) // 256-bit key
      ),
      importKey: vi.fn(() =>
        Promise.resolve({
          type: 'secret',
          extractable: false,
          algorithm: { name: 'AES-GCM', length: 256 },
          usages: ['encrypt', 'decrypt'],
        } as CryptoKey)
      ),
      encrypt: vi.fn((algorithm, key, data) =>
        Promise.resolve(new ArrayBuffer(data.byteLength + 16)) // Add auth tag
      ),
      decrypt: vi.fn((algorithm, key, data) => {
        // Simulate decryption by removing auth tag
        const decrypted = new ArrayBuffer(data.byteLength - 16);
        return Promise.resolve(decrypted);
      }),
    },
    getRandomValues: vi.fn((array: Uint8Array) => {
      // Fill with deterministic values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = i;
      }
      return array;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Stub global crypto
    vi.stubGlobal('crypto', mockCrypto);

    // Mock TextEncoder/TextDecoder
    vi.stubGlobal('TextEncoder', class {
      encode(str: string) {
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          arr[i] = str.charCodeAt(i);
        }
        return arr;
      }
    });

    vi.stubGlobal('TextDecoder', class {
      decode(arr: ArrayBuffer) {
        const uint8 = new Uint8Array(arr);
        return String.fromCharCode(...uint8);
      }
    });
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const data = 'test-token-data';

      const encrypted = await encrypt(data);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      expect(mockCrypto.subtle.generateKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should generate encryption key if not exists', async () => {
      chrome.storage.local.get = vi.fn(() => Promise.resolve({}));

      await encrypt('test-data');

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('should reuse existing encryption key', async () => {
      const mockKey = btoa(String.fromCharCode(...new Uint8Array(32)));
      chrome.storage.local.get = vi.fn(() =>
        Promise.resolve({ auth_encryption_key: mockKey })
      );

      await encrypt('test-data');

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.generateKey).not.toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data', async () => {
      // First encrypt some data
      const originalData = 'test-token-data';
      const encrypted = await encrypt(originalData);

      // Mock decrypt to return the original data
      const encodedData = new TextEncoder().encode(originalData);
      mockCrypto.subtle.decrypt = vi.fn(() =>
        Promise.resolve(encodedData.buffer)
      );

      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(originalData);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should handle corrupted encryption key', async () => {
      // Provide a corrupted key that will fail import
      chrome.storage.local.get = vi.fn(() =>
        Promise.resolve({ auth_encryption_key: 'invalid-key' })
      );
      mockCrypto.subtle.importKey = vi.fn(() =>
        Promise.reject(new Error('Invalid key'))
      );

      // Should fall back to generating a new key
      await encrypt('test-data');

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors', async () => {
      mockCrypto.subtle.encrypt = vi.fn(() =>
        Promise.reject(new Error('Encryption failed'))
      );

      await expect(encrypt('test-data')).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption errors', async () => {
      mockCrypto.subtle.decrypt = vi.fn(() =>
        Promise.reject(new Error('Decryption failed'))
      );

      await expect(decrypt('invalid-data')).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      chrome.storage.local.get = vi.fn(() =>
        Promise.reject(new Error('Storage error'))
      );

      await expect(encrypt('test-data')).rejects.toThrow('Storage error');
    });
  });
});
