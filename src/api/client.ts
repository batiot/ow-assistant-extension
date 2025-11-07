/**
 * OpenWebUI API Client
 * 
 * Provides methods to interact with the OpenWebUI backend API.
 * All requests include authentication token from chrome.storage.
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelsResponse,
  UserValidationResponse,
  ApiError,
  BackendConfig,
} from './types';

/**
 * Get backend configuration without authentication
 * This endpoint is public and doesn't require a token
 */
export async function getBackendConfig(baseUrl: string): Promise<BackendConfig | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/config`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Backend /api/config endpoint not found, using defaults');
        return null;
      }
      throw new Error(`Failed to fetch backend config: ${response.status}`);
    }

    const config = await response.json();
    
    // Validate config structure
    if (!config || typeof config !== 'object') {
      console.warn('Invalid backend config format, using defaults');
      return null;
    }

    return config as BackendConfig;
  } catch (error) {
    console.error('Error fetching backend config:', error);
    return null;
  }
}

export class OpenWebUIClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
  }

  /**
   * Make a request to the OpenWebUI API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.message || `API request failed with status ${response.status}`
      ) as ApiError;
      error.name = 'ApiError';
      (error as any).statusCode = response.status;
      (error as any).response = errorData;
      throw error;
    }

    return response.json();
  }

  /**
   * Validate token and get user info
   */
  async validateToken(): Promise<UserValidationResponse> {
    return this.request<UserValidationResponse>('/api/v1/auths/');
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('/api/models');
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>('/api/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Create a streaming chat completion
   * Returns an async generator that yields SSE events
   */
  async *streamChatCompletion(
    request: ChatCompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/api/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.message || `API request failed with status ${response.status}`
      ) as ApiError;
      error.name = 'ApiError';
      (error as any).statusCode = response.status;
      (error as any).response = errorData;
      throw error;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              return;
            }
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * Factory function to create an API client
 * Retrieves baseUrl and token from storage
 */
export async function createApiClient(): Promise<OpenWebUIClient> {
  const [configResult, authResult] = await Promise.all([
    chrome.storage.local.get('openWebUIBaseUrl'),
    chrome.storage.session.get('authToken'),
  ]);

  const baseUrl = configResult.openWebUIBaseUrl;
  const token = authResult.authToken;

  if (!baseUrl) {
    throw new Error('OpenWebUI base URL not configured');
  }

  if (!token) {
    throw new Error('Not authenticated');
  }

  return new OpenWebUIClient(baseUrl, token);
}
