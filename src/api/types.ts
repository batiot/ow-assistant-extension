/**
 * OpenWebUI API types
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
}

export interface Model {
  id: string;
  name: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  data: Model[];
}

export interface UserValidationResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  profile_image_url?: string;
  token?: string;
  token_type?: string;
  expires_at?: string | null;
  permissions?: {
    workspace?: Record<string, boolean>;
    sharing?: Record<string, boolean>;
    chat?: Record<string, boolean>;
    features?: Record<string, boolean>;
  };
  bio?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
}

/**
 * OAuth provider configuration
 * Maps provider name to provider identifier (e.g., { "microsoft": "microsoft" })
 */
export type OAuthProviders = Record<string, string>;

/**
 * Backend feature flags
 */
export interface BackendFeatures {
  /** Whether authentication is required */
  auth: boolean;
  /** Whether login form is available */
  enable_login_form: boolean;
}

/**
 * Backend configuration from /api/config endpoint
 */
export interface BackendConfig {
  oauth: {
    providers: OAuthProviders;
  };
  features: BackendFeatures;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
