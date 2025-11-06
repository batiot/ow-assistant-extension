import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '@/settings/manager';
import { DEFAULT_SETTINGS } from '@/settings/types';

// Mock chrome.storage API
const mockStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
  },
};

global.chrome = {
  storage: mockStorage,
} as any;

describe('SettingsManager', () => {
  let manager: SettingsManager;

  beforeEach(() => {
    // Reset singleton instance
    (SettingsManager as any).instance = undefined;
    manager = SettingsManager.getInstance();

    // Reset mocks
    vi.clearAllMocks();
    mockStorage.sync.get.mockResolvedValue({});
    mockStorage.local.get.mockResolvedValue({});
    mockStorage.sync.set.mockResolvedValue(undefined);
    mockStorage.local.set.mockResolvedValue(undefined);
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = SettingsManager.getInstance();
      const instance2 = SettingsManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should load settings from storage', async () => {
      mockStorage.sync.get.mockResolvedValue({
        user_settings_sync: { theme: 'dark', language: 'fr' },
      });
      mockStorage.local.get.mockResolvedValue({
        user_settings_local: { instanceUrl: 'https://example.com' },
      });

      await manager.initialize();

      const settings = manager.getSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.language).toBe('fr');
      expect(settings.instanceUrl).toBe('https://example.com');
    });

    it('should use defaults when storage is empty', async () => {
      await manager.initialize();

      const settings = manager.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.sync.get.mockRejectedValue(new Error('Storage error'));

      await manager.initialize();

      const settings = manager.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('getSettings', () => {
    it('should return current settings', () => {
      const settings = manager.getSettings();
      expect(settings).toBeDefined();
      expect(settings.theme).toBeDefined();
      expect(settings.language).toBeDefined();
      expect(settings.instanceUrl).toBeDefined();
    });

    it('should return a copy of settings', () => {
      const settings1 = manager.getSettings();
      const settings2 = manager.getSettings();
      expect(settings1).not.toBe(settings2);
      expect(settings1).toEqual(settings2);
    });
  });

  describe('updateSettings', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should update theme setting', async () => {
      await manager.updateSettings({ theme: 'dark' });

      expect(mockStorage.sync.set).toHaveBeenCalledWith({
        user_settings_sync: expect.objectContaining({ theme: 'dark' }),
      });

      const settings = manager.getSettings();
      expect(settings.theme).toBe('dark');
    });

    it('should update language setting', async () => {
      await manager.updateSettings({ language: 'fr' });

      expect(mockStorage.sync.set).toHaveBeenCalledWith({
        user_settings_sync: expect.objectContaining({ language: 'fr' }),
      });

      const settings = manager.getSettings();
      expect(settings.language).toBe('fr');
    });

    it('should update instance URL', async () => {
      await manager.updateSettings({ instanceUrl: 'https://test.com' });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        user_settings_local: { instanceUrl: 'https://test.com' },
      });

      const settings = manager.getSettings();
      expect(settings.instanceUrl).toBe('https://test.com');
    });

    it('should update multiple settings at once', async () => {
      await manager.updateSettings({
        theme: 'light',
        language: 'fr',
        instanceUrl: 'https://multi.com',
      });

      expect(mockStorage.sync.set).toHaveBeenCalled();
      expect(mockStorage.local.set).toHaveBeenCalled();

      const settings = manager.getSettings();
      expect(settings.theme).toBe('light');
      expect(settings.language).toBe('fr');
      expect(settings.instanceUrl).toBe('https://multi.com');
    });

    it('should reject invalid theme', async () => {
      await expect(
        manager.updateSettings({ theme: 'invalid' as any })
      ).rejects.toThrow('Invalid settings');
    });

    it('should reject invalid language', async () => {
      await expect(
        manager.updateSettings({ language: 'de' as any })
      ).rejects.toThrow('Invalid settings');
    });

    it('should reject invalid URL', async () => {
      await expect(
        manager.updateSettings({ instanceUrl: 'not-a-url' })
      ).rejects.toThrow('Invalid settings');
    });

    it('should reject empty URL', async () => {
      await expect(
        manager.updateSettings({ instanceUrl: '' })
      ).rejects.toThrow('Invalid settings');
    });
  });

  describe('validateSettings', () => {
    it('should validate correct theme', () => {
      const result = manager.validateSettings({ theme: 'dark' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should validate correct language', () => {
      const result = manager.validateSettings({ language: 'en' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should validate correct URL', () => {
      const result = manager.validateSettings({
        instanceUrl: 'https://example.com',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should reject invalid theme', () => {
      const result = manager.validateSettings({ theme: 'blue' as any });
      expect(result.isValid).toBe(false);
      expect(result.errors.theme).toBeDefined();
    });

    it('should reject invalid language', () => {
      const result = manager.validateSettings({ language: 'es' as any });
      expect(result.isValid).toBe(false);
      expect(result.errors.language).toBeDefined();
    });

    it('should reject invalid URL format', () => {
      const result = manager.validateSettings({ instanceUrl: 'not a url' });
      expect(result.isValid).toBe(false);
      expect(result.errors.instanceUrl).toBeDefined();
    });

    it('should reject non-HTTP(S) URLs', () => {
      const result = manager.validateSettings({ instanceUrl: 'ftp://example.com' });
      expect(result.isValid).toBe(false);
      expect(result.errors.instanceUrl).toContain('HTTP or HTTPS');
    });

    it('should reject empty URL', () => {
      const result = manager.validateSettings({ instanceUrl: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.instanceUrl).toContain('required');
    });

    it('should validate multiple settings', () => {
      const result = manager.validateSettings({
        theme: 'light',
        language: 'fr',
        instanceUrl: 'https://valid.com',
      });
      expect(result.isValid).toBe(true);
    });

    it('should collect multiple errors', () => {
      const result = manager.validateSettings({
        theme: 'invalid' as any,
        language: 'invalid' as any,
        instanceUrl: 'invalid',
      });
      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors)).toHaveLength(3);
    });
  });

  describe('resetSettings', () => {
    it('should clear storage and reset to defaults', async () => {
      await manager.updateSettings({ theme: 'dark' });
      await manager.resetSettings();

      expect(mockStorage.sync.remove).toHaveBeenCalledWith('user_settings_sync');
      expect(mockStorage.local.remove).toHaveBeenCalledWith('user_settings_local');

      const settings = manager.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on settings change', async () => {
      const listener = vi.fn();
      manager.addListener(listener);

      await manager.updateSettings({ theme: 'dark' });

      expect(listener).toHaveBeenCalled();
      const calledSettings = listener.mock.calls[0][0];
      expect(calledSettings.theme).toBe('dark');
    });

    it('should allow unsubscribing', async () => {
      const listener = vi.fn();
      const unsubscribe = manager.addListener(listener);

      unsubscribe();
      await manager.updateSettings({ theme: 'dark' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      manager.addListener(listener1);
      manager.addListener(listener2);

      await manager.updateSettings({ theme: 'dark' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should not fail if listener throws', async () => {
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      manager.addListener(badListener);
      manager.addListener(goodListener);

      await manager.updateSettings({ theme: 'dark' });

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });
});
