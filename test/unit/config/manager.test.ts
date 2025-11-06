import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../../../src/config/manager';

describe('Config Manager', () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = ConfigManager.getInstance();
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const config = {
        openWebUIBaseUrl: 'https://api.example.com',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty URL', () => {
      const config = {
        openWebUIBaseUrl: '',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenWebUI base URL is required');
    });

    it('should reject missing URL', () => {
      const config = {};

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenWebUI base URL is required');
    });

    it('should reject invalid URL format', () => {
      const config = {
        openWebUIBaseUrl: 'not-a-valid-url',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid OpenWebUI base URL format');
    });

    it('should reject non-http/https protocols', () => {
      const config = {
        openWebUIBaseUrl: 'ftp://api.example.com',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('OpenWebUI base URL must use http or https protocol');
    });

    it('should accept http URL', () => {
      const config = {
        openWebUIBaseUrl: 'http://localhost:3000',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept https URL', () => {
      const config = {
        openWebUIBaseUrl: 'https://api.example.com',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept URL with path', () => {
      const config = {
        openWebUIBaseUrl: 'https://api.example.com/api/v1',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept URL with port', () => {
      const config = {
        openWebUIBaseUrl: 'https://api.example.com:8080',
      };

      const result = manager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isConfigured', () => {
    it('should return true for valid configuration', () => {
      // Set a valid config
      (manager as any).config = {
        openWebUIBaseUrl: 'https://api.example.com',
      };

      expect(manager.isConfigured()).toBe(true);
    });

    it('should return false for invalid configuration', () => {
      // Set an invalid config
      (manager as any).config = {
        openWebUIBaseUrl: '',
      };

      expect(manager.isConfigured()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      (manager as any).config = {
        openWebUIBaseUrl: 'https://api.example.com',
      };

      const config = manager.getConfig();

      expect(config).toEqual({
        openWebUIBaseUrl: 'https://api.example.com',
      });

      // Verify it's a copy (mutation doesn't affect original)
      config.openWebUIBaseUrl = 'https://other.example.com';
      expect(manager.getConfig().openWebUIBaseUrl).toBe('https://api.example.com');
    });
  });
});
