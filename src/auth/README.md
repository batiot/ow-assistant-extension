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

### Three-Tier Authentication Priority

The extension uses a **three-tier fallback approach** to restore or establish authentication:

1. **Token Storage** (First Priority)
   - Check `chrome.storage.session` for ephemeral token
   - Fallback to `chrome.storage.local` (encrypted with AES-GCM)
   - Validate stored token against `/api/v1/auths/`
   - If valid, restore authentication state

2. **Browser Session Detection** (Second Priority)
   - If no stored token, check for existing browser session
   - Call `/api/v1/auths/` **without** Authorization header
   - Browser automatically sends HTTP-only cookie if session exists
   - Extract token from API response: `{token, email, name, ...}`
   - Store token for future use
   - **This eliminates redundant OAuth popups when user is already logged in**

3. **OAuth Flow** (Last Resort)
   - If no storage token and no browser session exists
   - Open OAuth popup window at `/oauth/microsoft/login`
   - Redirect to Microsoft EntraID login
   - User authenticates with Microsoft
   - Callback returns to `/oauth/microsoft/callback`
   - Server sets HTTP-only cookie with token
   - Extension extracts token and stores it

### Why Session Detection?

OpenWebUI uses **HTTP-only cookies** for session management. The extension **cannot read these cookies directly** via `chrome.cookies.getAll()` due to browser security restrictions. Instead, we detect existing sessions by:

1. Calling the OpenWebUI API endpoint `/api/v1/auths/`
2. Sending the request **without** an Authorization header
3. Browser automatically includes the HTTP-only cookie
4. API returns user data **including the token** if session is valid
5. Extension stores the token for subsequent API calls

This approach:
- ✅ Respects HTTP-only cookie security
- ✅ Avoids unnecessary OAuth popups
- ✅ Provides seamless UX when browser session exists
- ✅ Maintains backward compatibility with existing flows

### Session Restoration Details

**On Extension Startup** (`initialize()`):
1. Check token storage → Validate → Authenticated
2. Check browser session → Extract token → Authenticated
3. No valid session → Unauthenticated (wait for user login)

**On User Login** (`login()`):
1. Already authenticated → Early return
2. Check browser session → Extract token → Authenticated
3. No session → Open OAuth popup → Complete flow

**Token Validation**:
- All tokens validated against `/api/v1/auths/`
- Response includes: `{id, email, name, token, token_type}`
- Invalid tokens trigger re-authentication

**Token Storage**:
- Primary: `chrome.storage.session` (ephemeral, secure)
- Fallback: `chrome.storage.local` (encrypted with AES-GCM)
- Automatic expiration checking (if `expires_at` provided)

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
