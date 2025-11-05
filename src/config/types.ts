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
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
  openWebUIBaseUrl: '',
};

/**
 * Storage key for configuration
 */
export const CONFIG_STORAGE_KEY = 'extension_config';
