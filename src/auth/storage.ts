import type { AuthToken } from './types';
import { encrypt, decrypt } from './crypto';

/**
 * Token storage manager using chrome.storage.session with fallback to chrome.storage.local
 */
export class TokenStorage {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly STORAGE_VERSION = 1;

  /**
   * Check if chrome.storage.session is available
   */
  private static isSessionStorageAvailable(): boolean {
    return typeof chrome?.storage?.session !== 'undefined';
  }

  /**
   * Save authentication token securely
   */
  static async saveToken(token: AuthToken): Promise<void> {
    const useSessionStorage = this.isSessionStorageAvailable();
    const storage = useSessionStorage
      ? chrome.storage.session
      : chrome.storage.local;

    let dataToStore: any;

    if (useSessionStorage) {
      // No encryption needed for session storage
      dataToStore = {
        version: this.STORAGE_VERSION,
        data: token,
        savedAt: Date.now(),
      };
    } else {
      // Encrypt token when using local storage
      const encrypted = await encrypt(JSON.stringify(token));
      dataToStore = {
        version: this.STORAGE_VERSION,
        data: encrypted,
        encrypted: true,
        savedAt: Date.now(),
      };
    }

    await storage.set({ [this.TOKEN_KEY]: dataToStore });
  }

  /**
   * Retrieve authentication token
   */
  static async getToken(): Promise<AuthToken | null> {
    const storage = this.isSessionStorageAvailable()
      ? chrome.storage.session
      : chrome.storage.local;

    const result = await storage.get(this.TOKEN_KEY);
    const stored = result[this.TOKEN_KEY];

    if (!stored || stored.version !== this.STORAGE_VERSION) {
      return null;
    }

    let token: AuthToken;

    // Decrypt if stored in local storage
    if (stored.encrypted) {
      try {
        const decrypted = await decrypt(stored.data);
        token = JSON.parse(decrypted);
      } catch (error) {
        // Decryption failed, remove corrupted data
        await this.removeToken();
        return null;
      }
    } else {
      token = stored.data as AuthToken;
    }

    // Check if token is expired
    if (token.expiresAt && token.expiresAt < Date.now()) {
      await this.removeToken();
      return null;
    }

    return token;
  }

  /**
   * Remove authentication token
   */
  static async removeToken(): Promise<void> {
    // Remove from both storages to ensure cleanup
    await Promise.all([
      chrome.storage.session?.remove(this.TOKEN_KEY).catch(() => {}),
      chrome.storage.local.remove(this.TOKEN_KEY),
    ]);
  }

  /**
   * Check if a valid token exists
   */
  static async hasValidToken(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }
}
