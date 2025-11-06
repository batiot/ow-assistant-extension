import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenWebUIClient } from '../../../src/api/client';
import { ApiError } from '../../../src/api/types';

describe('API Client', () => {
  let client: OpenWebUIClient;

  beforeEach(() => {
    client = new OpenWebUIClient('https://api.example.com', 'test-token');
    vi.clearAllMocks();
  });

  describe('ApiError class', () => {
    it('should create ApiError with message and status code', () => {
      const error = new ApiError('Test error', 404, { detail: 'Not found' });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.response).toEqual({ detail: 'Not found' });
    });

    it('should create ApiError without response data', () => {
      const error = new ApiError('Test error', 500);

      expect(error.statusCode).toBe(500);
      expect(error.response).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new OpenWebUIClient('https://api.example.com/', 'token');
      
      expect((clientWithSlash as any).baseUrl).toBe('https://api.example.com');
    });

    it('should preserve baseUrl without trailing slash', () => {
      expect((client as any).baseUrl).toBe('https://api.example.com');
    });
  });

  describe('request error handling', () => {
    it('should throw ApiError on HTTP 4xx error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Unauthorized' }),
        } as Response)
      );

      await expect(client.validateToken()).rejects.toThrow('Unauthorized');
      await expect(client.validateToken()).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 401,
      });
    });

    it('should throw ApiError on HTTP 5xx error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Internal Server Error' }),
        } as Response)
      );

      await expect(client.validateToken()).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 500,
        message: 'Internal Server Error',
      });
    });

    it('should handle error response without message', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({}),
        } as Response)
      );

      await expect(client.validateToken()).rejects.toThrow('API request failed with status 404');
    });

    it('should handle malformed JSON error response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      );

      await expect(client.validateToken()).rejects.toThrow('API request failed with status 500');
    });

    it('should include response data in ApiError', async () => {
      const errorData = { code: 'INVALID_TOKEN', details: 'Token expired' };
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve(errorData),
        } as Response)
      );

      try {
        await client.validateToken();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.response).toEqual(errorData);
      }
    });
  });

  describe('request headers', () => {
    it('should include Authorization header with Bearer token', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: '123', email: 'test@example.com' }),
        } as Response)
      );

      await client.validateToken();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should include Content-Type header', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      );

      await client.getModels();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('validateToken', () => {
    it('should call correct endpoint', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: '123', email: 'test@example.com', name: 'Test', role: 'user' }),
        } as Response)
      );

      await client.validateToken();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/auths/',
        expect.any(Object)
      );
    });
  });

  describe('network error handling', () => {
    it('should propagate network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(client.validateToken()).rejects.toThrow('Network error');
    });

    it('should handle fetch timeout', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Request timeout'))
      );

      await expect(client.getModels()).rejects.toThrow('Request timeout');
    });
  });
});
