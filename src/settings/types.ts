/**
 * User settings types
 */

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Supported language codes
 */
export type Language = 'en' | 'fr';

/**
 * User settings interface
 */
export interface UserSettings {
  theme: Theme;
  language: Language;
  instanceUrl: string;
}

/**
 * Settings stored in sync storage (cross-device)
 */
export interface SyncSettings {
  theme: Theme;
  language: Language;
}

/**
 * Settings stored in local storage (device-specific)
 */
export interface LocalSettings {
  instanceUrl: string;
}

/**
 * Validation result
 */
export interface SettingsValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Default user settings
 */
export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  language: 'en',
  instanceUrl: import.meta.env.VITE_OPENWEBUI_BASE_URL || 'http://localhost:8080/',
};

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  SYNC: 'user_settings_sync',
  LOCAL: 'user_settings_local',
  MIGRATION: 'settings_migration_v1',
} as const;
