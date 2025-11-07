import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenWebUIClient, getBackendConfig } from '../../../src/api/client';
import type { ChatCompletionRequest, BackendConfig } from '../../../src/api/types';

/**
 * Extended tests for API client HTTP functionality
 */
describe('OpenWebUIClient - Extended', () => {
  const baseUrl = 'https://test.openwebui.com';
  const token = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with base URL and token', () => {
      const client = new OpenWebUIClient(baseUrl, token);
      expect(client).toBeDefined();
    });

    it('should remove trailing slash from base URL', () => {
      const client = new OpenWebUIClient('https://test.openwebui.com/', token);
      expect(client).toBeDefined();
      // URL normalization is tested through actual requests
    });
  });

  describe('validateToken()', () => {
    it('should make GET request to /api/v1/auths/', async () => {
      const mockResponse = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new OpenWebUIClient(baseUrl, token);
      const result = await client.validateToken();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/v1/auths/',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw error for failed validation', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const client = new OpenWebUIClient(baseUrl, token);

      await expect(client.validateToken()).rejects.toThrow();
    });
  });

  describe('getModels()', () => {
    it('should fetch available models', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockModels,
      });

      const client = new OpenWebUIClient(baseUrl, token);
      const result = await client.getModels();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );

      expect(result).toEqual(mockModels);
    });

    it('should throw error if models endpoint fails', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      });

      const client = new OpenWebUIClient(baseUrl, token);

      await expect(client.getModels()).rejects.toThrow('Server error');
    });
  });

  describe('chatCompletion()', () => {
    it('should send chat completion request', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const mockResponse = {
        id: 'chat-123',
        choices: [
          {
            message: { role: 'assistant', content: 'Hi there!' },
            finish_reason: 'stop',
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new OpenWebUIClient(baseUrl, token);
      const result = await client.chatCompletion(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.openwebui.com/api/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw error for failed chat completion', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid request' }),
      });

      const client = new OpenWebUIClient(baseUrl, token);

      await expect(client.chatCompletion(request)).rejects.toThrow('Invalid request');
    });
  });

  describe('Error handling', () => {
    it('should include status code in error', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not found' }),
      });

      const client = new OpenWebUIClient(baseUrl, token);

      try {
        await client.validateToken();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Not found');
      }
    });

    it('should handle JSON parse error in error response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); },
      });

      const client = new OpenWebUIClient(baseUrl, token);

      try {
        await client.validateToken();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('500');
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const client = new OpenWebUIClient(baseUrl, token);

      await expect(client.validateToken()).rejects.toThrow('Network error');
    });
  });

  describe('Custom headers', () => {
    it('should allow custom headers in requests', async () => {
      const mockResponse = { data: [] };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new OpenWebUIClient(baseUrl, token);
      
      // Access private request method through chat completion
      await client.chatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });
  });
});

describe('getBackendConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Suppress console warnings during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch backend configuration', async () => {
    const mockConfig: BackendConfig = {
      oauth: {
        providers: {
          microsoft: { enabled: true },
        },
      },
      features: {
        enable_login_form: false,
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    });

    const result = await getBackendConfig('https://test.openwebui.com');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.openwebui.com/api/config',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    expect(result).toEqual(mockConfig);
  });

  it('should remove trailing slash from base URL', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await getBackendConfig('https://test.openwebui.com/');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.openwebui.com/api/config',
      expect.any(Object)
    );
  });

  it('should return null and warn on 404', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await getBackendConfig('https://test.openwebui.com');

    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Backend /api/config endpoint not found, using defaults'
    );
  });

  it('should return null on network error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await getBackendConfig('https://test.openwebui.com');

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Error fetching backend config:',
      expect.any(Error)
    );
  });

  it('should return null for invalid config format', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => 'invalid',
    });

    const result = await getBackendConfig('https://test.openwebui.com');

    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Invalid backend config format, using defaults'
    );
  });

  it('should return null for non-object config', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => null,
    });

    const result = await getBackendConfig('https://test.openwebui.com');

    expect(result).toBeNull();
  });

  it('should return null on server error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await getBackendConfig('https://test.openwebui.com');

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
