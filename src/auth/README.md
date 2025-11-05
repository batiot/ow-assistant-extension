# Authentication Module

This module provides secure authentication for the extension using OpenWebUI's SSO integration with EntraID (Azure AD).

## Architecture

### Components

1. **AuthService** (`service.ts`) - Main authentication service
   - Manages authentication flow
   - Handles token validation
   - Coordinates with OAuth window
   - Manages authentication state

2. **TokenStorage** (`storage.ts`) - Secure token storage
   - Uses `chrome.storage.session` when available
   - Falls back to `chrome.storage.local` with encryption
   - Automatic token expiration handling

3. **Types** (`types.ts`) - TypeScript definitions
   - AuthToken, AuthState, AuthConfig
   - Error types and interfaces

4. **Retry Logic** (`retry.ts`) - Resilient operations
   - Automatic retry with exponential backoff
   - Error type detection
   - Configurable retry behavior

5. **Crypto** (`crypto.ts`) - Encryption utilities
   - AES-GCM encryption for local storage
   - Automatic key management

## Usage

### Initialize Authentication

```typescript
import { AuthService } from '@/auth';

const authService = AuthService.getInstance({
  baseUrl: 'https://your-openwebui-instance.com'
});

// Initialize and restore session
await authService.initialize();
```

### Login Flow

```typescript
try {
  await authService.login();
  console.log('Authentication successful');
} catch (error) {
  if (error instanceof AuthError) {
    if (error.type === AuthErrorType.USER_CANCELLED) {
      console.log('User cancelled authentication');
    } else if (error.retryable) {
      // Show retry option to user
    }
  }
}
```

### Check Authentication Status

```typescript
if (authService.isAuthenticated()) {
  const token = await authService.getToken();
  // Use token for API calls
}
```

### Subscribe to Auth State Changes

```typescript
const unsubscribe = authService.onAuthStateChanged((state) => {
  console.log('Auth state changed:', state);
  // Update UI accordingly
});

// Clean up when done
unsubscribe();
```

### Logout

```typescript
await authService.logout();
```

## Authentication Flow

1. **Initial Authentication**
   - User triggers login action
   - Extension opens OAuth window at `/oauth/microsoft/login`
   - Redirects to Microsoft login
   - User authenticates with Microsoft
   - Callback returns to `/oauth/microsoft/callback`
   - Token is set in cookie
   - Extension extracts and stores token

2. **Token Validation**
   - Token validated against `/api/v1/auths/`
   - User information retrieved
   - Authentication state updated

3. **Token Storage**
   - Primary: `chrome.storage.session` (ephemeral, secure)
   - Fallback: `chrome.storage.local` (encrypted with AES-GCM)
   - Automatic expiration checking

4. **Session Restoration**
   - On extension startup, check for stored token
   - Validate token if present
   - Restore authentication state

## Error Handling

### Error Types

- `NETWORK_ERROR` - Network connectivity issues (retryable)
- `INVALID_TOKEN` - Token validation failed
- `USER_CANCELLED` - User closed authentication window
- `AUTHENTICATION_FAILED` - General authentication failure
- `TOKEN_EXPIRED` - Token has expired

### Retry Logic

Network errors and certain authentication failures are automatically retried with exponential backoff:

```typescript
const config = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2
};
```

## Security Considerations

1. **Token Storage**
   - Session storage preferred (cleared on browser close)
   - Local storage encrypted with AES-GCM 256-bit
   - Encryption key generated per installation
   - Automatic cleanup on logout

2. **Token Expiration**
   - Tokens checked for expiration before use
   - Expired tokens automatically removed
   - Re-authentication required when expired

3. **OAuth Flow**
   - Popup window for authentication
   - State validation
   - Error parameter checking
   - Window lifecycle management

4. **No Long-lived Secrets**
   - No client secrets stored in extension
   - OAuth delegation to OpenWebUI
   - Short-lived session tokens only

## Testing

### Unit Tests

```bash
npm test -- auth
```

### E2E Tests

```bash
npm run test:e2e -- auth
```

## API Reference

### AuthService

#### Methods

- `getInstance(config: AuthConfig): AuthService` - Get singleton instance
- `initialize(): Promise<void>` - Initialize and restore session
- `login(): Promise<void>` - Start authentication flow
- `logout(): Promise<void>` - End session and clear tokens
- `getState(): AuthState` - Get current authentication state
- `isAuthenticated(): boolean` - Check if user is authenticated
- `getToken(): Promise<string | null>` - Get current token
- `onAuthStateChanged(callback): () => void` - Subscribe to state changes

### TokenStorage

#### Methods

- `saveToken(token: AuthToken): Promise<void>` - Store token securely
- `getToken(): Promise<AuthToken | null>` - Retrieve stored token
- `removeToken(): Promise<void>` - Remove stored token
- `hasValidToken(): Promise<boolean>` - Check if valid token exists

## Configuration

### Environment Variables

```typescript
interface AuthConfig {
  baseUrl: string; // OpenWebUI instance URL
}
```

### Required Permissions

```json
{
  "permissions": [
    "storage",
    "cookies"
  ],
  "host_permissions": [
    "https://your-openwebui-instance.com/*",
    "https://login.microsoftonline.com/*"
  ]
}
```

## Troubleshooting

### Token Validation Fails

1. Check OpenWebUI instance URL configuration
2. Verify network connectivity
3. Check browser console for errors
4. Clear storage and re-authenticate

### Authentication Window Doesn't Open

1. Check for popup blockers
2. Verify extension permissions
3. Check browser console for errors

### Token Not Persisting

1. Verify storage permissions
2. Check if browser supports `chrome.storage.session`
3. Look for encryption errors in console
