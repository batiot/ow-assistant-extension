import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../../src/auth/service';
import type { AuthConfig } from '../../../src/auth/types';

// Mock chrome.storage (required for AuthService dependencies)
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

/**
 * Unit tests for AuthService singleton management and reconfiguration
 */
describe('AuthService', () => {
  const mockConfig: AuthConfig = {
    baseUrl: 'https://test.openwebui.com',
  };

  beforeEach(() => {
    // Reset singleton before each test
    AuthService.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = AuthService.getInstance(mockConfig);
      const instance2 = AuthService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error when getInstance called without config on first access', () => {
      expect(() => {
        AuthService.getInstance();
      }).toThrow('AuthService requires config for initialization');
    });

    it('should return existing instance without config after initialization', () => {
      const instance1 = AuthService.getInstance(mockConfig);
      const instance2 = AuthService.getInstance(); // No config needed
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('resetInstance()', () => {
    it('should clear the singleton instance', () => {
      // Create instance
      const instance1 = AuthService.getInstance(mockConfig);
      expect(instance1).toBeDefined();

      // Reset singleton
      AuthService.resetInstance();

      // New instance should be different
      const instance2 = AuthService.getInstance(mockConfig);
      expect(instance2).toBeDefined();
      expect(instance2).not.toBe(instance1);
    });

    it('should allow getInstance to create new instance after reset', () => {
      AuthService.getInstance(mockConfig);
      AuthService.resetInstance();

      // Should not throw - new instance can be created
      expect(() => {
        AuthService.getInstance(mockConfig);
      }).not.toThrow();
    });

    it('should require config again after reset', () => {
      AuthService.getInstance(mockConfig);
      AuthService.resetInstance();

      // After reset, config is required again
      expect(() => {
        AuthService.getInstance();
      }).toThrow('AuthService requires config for initialization');
    });
  });

  describe('updateConfig()', () => {
    it('should update the base URL configuration', () => {
      const instance = AuthService.getInstance(mockConfig);
      const newConfig: AuthConfig = {
        baseUrl: 'https://new.openwebui.com',
      };

      instance.updateConfig(newConfig);

      // Verify config is updated (indirectly through getState or other methods)
      // Note: We can't directly access private config, but the method should not throw
      expect(() => {
        instance.updateConfig(newConfig);
      }).not.toThrow();
    });

    it('should update config on existing instance without creating new instance', () => {
      const instance1 = AuthService.getInstance(mockConfig);
      
      instance1.updateConfig({
        baseUrl: 'https://updated.openwebui.com',
      });

      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Reconfiguration Workflow', () => {
    it('should support full reconfiguration workflow', () => {
      // Step 1: Initial configuration
      const instance1 = AuthService.getInstance({
        baseUrl: 'https://initial.openwebui.com',
      });
      expect(instance1).toBeDefined();

      // Step 2: Reset for reconfiguration
      AuthService.resetInstance();

      // Step 3: Create new instance with different config
      const instance2 = AuthService.getInstance({
        baseUrl: 'https://reconfigured.openwebui.com',
      });

      expect(instance2).toBeDefined();
      expect(instance2).not.toBe(instance1);
    });

    it('should handle multiple resets and recreations', () => {
      const configs = [
        { baseUrl: 'https://url1.com' },
        { baseUrl: 'https://url2.com' },
        { baseUrl: 'https://url3.com' },
      ];

      const instances: AuthService[] = [];

      configs.forEach((config) => {
        AuthService.resetInstance();
        const instance = AuthService.getInstance(config);
        instances.push(instance);
      });

      // All instances should be different
      expect(instances[0]).not.toBe(instances[1]);
      expect(instances[1]).not.toBe(instances[2]);
      expect(instances[0]).not.toBe(instances[2]);
    });
  });
});
