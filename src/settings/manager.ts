import type {
  UserSettings,
  SyncSettings,
  LocalSettings,
  SettingsValidationResult,
  Theme,
  Language,
} from './types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './types';

/**
 * Settings manager for user preferences
 * Singleton pattern for consistent access across extension contexts
 */
export class SettingsManager {
  private static instance: SettingsManager;
  private settings: UserSettings = DEFAULT_SETTINGS;
  private listeners: Set<(settings: UserSettings) => void> = new Set();

  private constructor() {
    // Listen for storage changes from other contexts
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes[STORAGE_KEYS.SYNC]) {
        const syncSettings: SyncSettings = changes[STORAGE_KEYS.SYNC].newValue;
        // Only update if newValue is defined (not a removal)
        if (syncSettings !== undefined) {
          this.settings = { ...this.settings, ...syncSettings };
          this.notifyListeners();
        }
      }
      if (areaName === 'local' && changes[STORAGE_KEYS.LOCAL]) {
        const localSettings: LocalSettings = changes[STORAGE_KEYS.LOCAL].newValue;
        // Only update if newValue is defined (not a removal)
        if (localSettings !== undefined) {
          this.settings = { ...this.settings, ...localSettings };
          this.notifyListeners();
        }
      }
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Initialize settings from storage
   */
  async initialize(): Promise<void> {
    try {
      // Check if migration is needed
      await this.migrateFromLegacyConfig();

      // Load sync settings (theme, language)
      const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.SYNC);
      const syncSettings: SyncSettings = syncResult[STORAGE_KEYS.SYNC] || {};

      // Load local settings (instance URL)
      const localResult = await chrome.storage.local.get(STORAGE_KEYS.LOCAL);
      const localSettings: LocalSettings = localResult[STORAGE_KEYS.LOCAL] || {};

      // Detect fresh install: migration complete but no settings in storage
      // This ensures default instance URL persists across service worker restarts
      const migrationResult = await chrome.storage.local.get(STORAGE_KEYS.MIGRATION);
      const isFreshInstall = migrationResult[STORAGE_KEYS.MIGRATION] && 
                            !syncResult[STORAGE_KEYS.SYNC] && 
                            !localResult[STORAGE_KEYS.LOCAL];

      if (isFreshInstall) {
        console.log('[Settings] Fresh install detected, writing default instance URL to storage');
        // Write default instance URL to storage so it persists across service worker restarts
        await chrome.storage.local.set({
          [STORAGE_KEYS.LOCAL]: {
            instanceUrl: DEFAULT_SETTINGS.instanceUrl,
          },
        });
        localSettings.instanceUrl = DEFAULT_SETTINGS.instanceUrl;
      }

      // Merge with defaults
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...syncSettings,
        ...localSettings,
      };
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  /**
   * Migrate from legacy ConfigManager (openWebUIBaseUrl)
   * This ensures backward compatibility when upgrading from older versions
   */
  private async migrateFromLegacyConfig(): Promise<void> {
    try {
      // Check if migration already completed
      const migrationResult = await chrome.storage.local.get(STORAGE_KEYS.MIGRATION);
      if (migrationResult[STORAGE_KEYS.MIGRATION]) {
        return; // Migration already done
      }

      // Check for legacy config
      const CONFIG_STORAGE_KEY = 'extension_config';
      const legacyResult = await chrome.storage.local.get(CONFIG_STORAGE_KEY);
      const legacyConfig = legacyResult[CONFIG_STORAGE_KEY];

      if (legacyConfig && legacyConfig.openWebUIBaseUrl) {
        console.log('Migrating legacy config to settings...');
        
        // Migrate instance URL to new settings
        await chrome.storage.local.set({
          [STORAGE_KEYS.LOCAL]: {
            instanceUrl: legacyConfig.openWebUIBaseUrl,
          },
        });

        // Mark migration as complete
        await chrome.storage.local.set({
          [STORAGE_KEYS.MIGRATION]: true,
        });

        console.log('Migration completed successfully');
      } else {
        // No legacy config found, just mark migration as complete
        await chrome.storage.local.set({
          [STORAGE_KEYS.MIGRATION]: true,
        });
      }
    } catch (error) {
      console.error('Failed to migrate legacy config:', error);
      // Don't throw - allow initialization to continue with defaults
    }
  }

  /**
   * Get current settings (synchronous, from cache)
   */
  getSettings(): UserSettings {
    return { ...this.settings };
  }

  /**
   * Update settings (partial update)
   */
  async updateSettings(newSettings: Partial<UserSettings>): Promise<void> {
    // Validate before updating
    const validation = this.validateSettings(newSettings);
    if (!validation.isValid) {
      throw new Error(
        `Invalid settings: ${Object.values(validation.errors).join(', ')}`
      );
    }

    // Merge with current settings
    const updatedSettings = { ...this.settings, ...newSettings };

    // Split into sync and local storage
    const syncSettings: SyncSettings = {
      theme: updatedSettings.theme,
      language: updatedSettings.language,
    };

    const localSettings: LocalSettings = {
      instanceUrl: updatedSettings.instanceUrl,
    };

    // Save to storage
    await Promise.all([
      chrome.storage.sync.set({ [STORAGE_KEYS.SYNC]: syncSettings }),
      chrome.storage.local.set({ [STORAGE_KEYS.LOCAL]: localSettings }),
    ]);

    // Update cache
    this.settings = updatedSettings;

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Validate settings
   */
  validateSettings(settings: Partial<UserSettings>): SettingsValidationResult {
    const errors: Record<string, string> = {};

    // Validate theme
    if (settings.theme !== undefined) {
      const validThemes: Theme[] = ['light', 'dark', 'system'];
      if (!validThemes.includes(settings.theme)) {
        errors.theme = `Invalid theme. Must be one of: ${validThemes.join(', ')}`;
      }
    }

    // Validate language
    if (settings.language !== undefined) {
      const validLanguages: Language[] = ['en', 'fr'];
      if (!validLanguages.includes(settings.language)) {
        errors.language = `Invalid language. Must be one of: ${validLanguages.join(', ')}`;
      }
    }

    // Validate instance URL
    if (settings.instanceUrl !== undefined) {
      if (!settings.instanceUrl) {
        errors.instanceUrl = 'Instance URL is required';
      } else {
        try {
          const url = new URL(settings.instanceUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            errors.instanceUrl = 'URL must use HTTP or HTTPS protocol';
          }
        } catch {
          errors.instanceUrl = 'Invalid URL format';
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<void> {
    // Clear storage
    await Promise.all([
      chrome.storage.sync.remove(STORAGE_KEYS.SYNC),
      chrome.storage.local.remove(STORAGE_KEYS.LOCAL),
    ]);

    // Reset cache
    this.settings = { ...DEFAULT_SETTINGS };

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Add a settings change listener
   */
  addListener(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of settings change
   */
  private notifyListeners(): void {
    const settings = this.getSettings();
    this.listeners.forEach((listener) => {
      try {
        listener(settings);
      } catch (error) {
        console.error('Error in settings listener:', error);
      }
    });
  }
}

/**
 * Get settings manager singleton
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
