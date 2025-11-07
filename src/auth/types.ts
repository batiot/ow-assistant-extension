/**
 * Authentication types and interfaces
 */

import type { BackendConfig } from '@/api/types';

export interface AuthToken {
  token: string;
  expiresAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: AuthToken | null;
  user: UserInfo | null;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export interface AuthConfig {
  baseUrl: string;
  backendConfig?: BackendConfig | null;
}

export enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  USER_CANCELLED = 'USER_CANCELLED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
}

export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
