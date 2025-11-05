import { describe, it, expect, vi } from 'vitest';
import { retryOperation, isRetryableError, toAuthError } from '../../../src/auth/retry';
import { AuthError, AuthErrorType } from '../../../src/auth/types';

describe('Retry Logic', () => {
  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryOperation(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retryOperation(operation, { delayMs: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new AuthError(
        AuthErrorType.USER_CANCELLED,
        'User cancelled',
        false
      );
      const operation = vi.fn().mockRejectedValue(error);

      await expect(retryOperation(operation)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const error = new AuthError(
        AuthErrorType.NETWORK_ERROR,
        'Network error',
        true
      );
      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        retryOperation(operation, { maxAttempts: 2, delayMs: 10 })
      ).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable AuthError', () => {
      const error = new AuthError(
        AuthErrorType.NETWORK_ERROR,
        'Network error',
        true
      );
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable AuthError', () => {
      const error = new AuthError(
        AuthErrorType.USER_CANCELLED,
        'Cancelled',
        false
      );
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for network errors', () => {
      const error = new TypeError('fetch failed');
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('toAuthError', () => {
    it('should return AuthError as-is', () => {
      const error = new AuthError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid token',
        false
      );
      expect(toAuthError(error)).toBe(error);
    });

    it('should convert network Error to AuthError', () => {
      const error = new Error('fetch failed');
      const authError = toAuthError(error);

      expect(authError).toBeInstanceOf(AuthError);
      expect(authError.type).toBe(AuthErrorType.NETWORK_ERROR);
      expect(authError.retryable).toBe(true);
    });

    it('should convert generic Error to AuthError', () => {
      const error = new Error('Something went wrong');
      const authError = toAuthError(error);

      expect(authError).toBeInstanceOf(AuthError);
      expect(authError.type).toBe(AuthErrorType.AUTHENTICATION_FAILED);
      expect(authError.retryable).toBe(false);
    });

    it('should handle unknown errors', () => {
      const authError = toAuthError('string error');

      expect(authError).toBeInstanceOf(AuthError);
      expect(authError.type).toBe(AuthErrorType.AUTHENTICATION_FAILED);
    });
  });
});
