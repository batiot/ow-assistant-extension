/**
 * Configuration types
 */
export interface ExtensionConfig {
  openWebUIBaseUrl: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Default configuration values
 * Uses VITE_OPENWEBUI_BASE_URL from build-time environment
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
  openWebUIBaseUrl: import.meta.env.VITE_OPENWEBUI_BASE_URL || '',
};

/**
 * Storage key for configuration
 */
export const CONFIG_STORAGE_KEY = 'extension_config';
