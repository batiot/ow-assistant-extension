/**
 * Simple encryption utility for token storage fallback
 * Uses SubtleCrypto API for AES-GCM encryption
 */

const ENCRYPTION_KEY_NAME = 'auth_encryption_key';

/**
 * Get or generate encryption key
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // Try to get existing key
  const stored = await chrome.storage.local.get(ENCRYPTION_KEY_NAME);
  
  if (stored[ENCRYPTION_KEY_NAME]) {
    try {
      const keyData = Uint8Array.from(atob(stored[ENCRYPTION_KEY_NAME]), c => c.charCodeAt(0));
      return await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } catch {
      // Key corrupted, generate new one
    }
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Store key
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyString = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  await chrome.storage.local.set({ [ENCRYPTION_KEY_NAME]: keyString });

  return key;
}

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}
