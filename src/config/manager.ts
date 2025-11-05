import type { ExtensionConfig, ConfigValidationResult } from './types';
import { DEFAULT_CONFIG, CONFIG_STORAGE_KEY } from './types';

/**
 * Configuration manager for extension settings
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: ExtensionConfig = DEFAULT_CONFIG;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize configuration from storage
   */
  async initialize(): Promise<void> {
    const stored = await chrome.storage.local.get(CONFIG_STORAGE_KEY);
    if (stored[CONFIG_STORAGE_KEY]) {
      this.config = { ...DEFAULT_CONFIG, ...stored[CONFIG_STORAGE_KEY] };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ExtensionConfig {
    return { ...this.config };
  }

  /**
   * Get OpenWebUI base URL
   */
  getOpenWebUIBaseUrl(): string {
    return this.config.openWebUIBaseUrl;
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<ExtensionConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await chrome.storage.local.set({
      [CONFIG_STORAGE_KEY]: this.config,
    });
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<ExtensionConfig> = this.config): ConfigValidationResult {
    const errors: string[] = [];

    // Validate OpenWebUI base URL
    if (!config.openWebUIBaseUrl) {
      errors.push('OpenWebUI base URL is required');
    } else {
      try {
        const url = new URL(config.openWebUIBaseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('OpenWebUI base URL must use http or https protocol');
        }
      } catch {
        errors.push('Invalid OpenWebUI base URL format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if configuration is complete
   */
  isConfigured(): boolean {
    return this.validateConfig().isValid;
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await chrome.storage.local.remove(CONFIG_STORAGE_KEY);
  }
}

/**
 * Get config manager singleton
 */
export function getConfigManager(): ConfigManager {
  return ConfigManager.getInstance();
}
