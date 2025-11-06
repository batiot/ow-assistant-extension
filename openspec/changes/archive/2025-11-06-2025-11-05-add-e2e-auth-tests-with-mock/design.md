# Design: E2E Authentication Tests with Mock Server

## Overview

This design implements comprehensive E2E testing for the authentication flow by creating a mock OpenWebUI server that simulates OAuth endpoints and token validation. The mock server allows us to test the complete authentication cycle without external dependencies while maintaining realistic behavior.

## Architecture

### Mock Server Design

The mock server will be implemented as a lightweight HTTP server that runs during test execution:

```
Test Lifecycle:
1. beforeAll: Start mock server on random port
2. Configure extension with mock server URL
3. Run tests against mock endpoints
4. afterAll: Stop mock server and cleanup
```

**Mock Server Responsibilities:**
- Serve OAuth login page HTML (simulates Microsoft login)
- Handle OAuth callback with token parameter
- Validate tokens and return user information
- Return appropriate errors for test scenarios
- Log requests for debugging

**Technology Choice:**
- Use Node.js built-in `http` module or `express` for simplicity
- No authentication required (it's a mock)
- Stateless design - each test scenario can configure responses

### OAuth Flow Simulation

The mock server simulates Microsoft OAuth without actual Microsoft integration:

```
Extension Flow:                Mock Server Response:
1. Open /oauth/microsoft/login → Return HTML with auto-redirect button
2. User "authenticates"        → JavaScript auto-clicks redirect
3. Redirect to callback        → /oauth/microsoft/callback?code=auth-code-123
4. Extension detects callback  → Response includes Set-Cookie: token=eyJh...
5. Extension extracts token    → Extension reads token from cookie
6. Validate at /api/v1/auths/  → Returns mock user data (or token if cookie present)
```

**Simplified OAuth Simulation:**
- Login page returns HTML with JavaScript that auto-redirects after 100ms
- Callback URL includes OAuth `code` parameter (not the token)
- Callback response sets a `Set-Cookie: token=eyJh...` header with the JWT
- Extension auth service extracts token from the cookie header
- `/api/v1/auths/` can be called with cookie OR with Bearer token
- No real cryptographic validation needed (it's a test environment)

### Test Structure

Tests will be organized by scenario using Playwright's `test.describe`:

```typescript
test.describe('Authentication E2E', () => {
  let mockServer: MockOpenWebUIServer;
  
  test.beforeAll(async () => {
    mockServer = new MockOpenWebUIServer();
    await mockServer.start();
  });
  
  test.afterAll(async () => {
    await mockServer.stop();
  });
  
  test.describe('Login Flow', () => {
    // Login tests
  });
  
  test.describe('State Management', () => {
    // Persistence and sync tests
  });
  
  test.describe('Error Handling', () => {
    // Error scenario tests
  });
});
```

### Extension Configuration for Tests

The extension needs to know the mock server URL during tests:

**Option 1: Environment Variable (Recommended)**
- Set `VITE_OPENWEBUI_BASE_URL` during test build
- Extension reads from `import.meta.env.VITE_OPENWEBUI_BASE_URL`
- Clean separation of test vs production config

**Option 2: Chrome Storage Injection**
- Inject base URL into chrome.storage before tests
- More complex but doesn't require build-time config

We'll use Option 1 for simplicity and clarity.

## Mock Server Implementation

### Endpoints

**GET /oauth/microsoft/login**
```typescript
// Returns HTML page that auto-redirects to callback
response.send(`
  <!DOCTYPE html>
  <html>
    <body>
      <h1>Mock Microsoft Login</h1>
      <p>Redirecting...</p>
      <script>
        setTimeout(() => {
          window.location.href = '${baseUrl}/oauth/microsoft/callback?code=mock-auth-code-${Date.now()}';
        }, 100);
      </script>
    </body>
  </html>
`);
```

**GET /oauth/microsoft/callback**
```typescript
// Returns page and sets token in cookie
// Extension monitors this URL and extracts token from Set-Cookie header
const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-${Date.now()}`;

response.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; Secure; SameSite=None`);
response.send(`
  <!DOCTYPE html>
  <html>
    <body>
      <h1>Authentication Successful</h1>
      <p>You can close this window.</p>
    </body>
  </html>
`);
```

**GET /api/v1/auths/**
```typescript
// Validates token and returns user info
// Supports both Bearer token in Authorization header and cookie
const bearerToken = req.headers.authorization?.replace('Bearer ', '');
const cookieToken = req.cookies?.token;
const token = bearerToken || cookieToken;

if (!token || !token.includes('test-')) {
  return res.status(401).json({ error: 'Invalid token' });
}

// Can also return token in response if cookie is present
const response = {
  id: 'test-user-123',
  email: 'test.user@example.com',
  name: 'Test User',
  role: 'user',
  profile_image_url: 'https://example.com/avatar.jpg'
};

// If called with cookie (no bearer token), include token in response
if (cookieToken && !bearerToken) {
  response.token = cookieToken;
}

res.json(response);
```

### Error Scenarios

The mock server should support configurable error responses:

```typescript
class MockOpenWebUIServer {
  private errorMode: 'none' | 'network' | 'invalid_token' | 'server_error' = 'none';
  
  setErrorMode(mode: 'none' | 'network' | 'invalid_token' | 'server_error') {
    this.errorMode = mode;
  }
  
  // In validation endpoint:
  if (this.errorMode === 'invalid_token') {
    return res.status(401).json({ error: 'Token expired' });
  }
  if (this.errorMode === 'server_error') {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## Test Scenarios

### 1. Complete Login Flow

**Setup:** Extension is unauthenticated, mock server is ready

**Steps:**
1. Open extension popup
2. Click "Login" button
3. Wait for OAuth popup window to open
4. Mock server auto-redirects to callback with `code` parameter
5. Callback response sets `Set-Cookie: token=eyJh...` header
6. Extension extracts token from cookie, validates it, closes popup
7. Verify user profile displayed in extension

**Assertions:**
- Popup window opens with correct URL
- OAuth callback URL is detected (with `code` parameter)
- Token is extracted from Set-Cookie header
- Token is stored in chrome.storage.session
- User name and email are displayed
- Logout button is visible
- Login button is hidden

### 2. Logout Flow

**Setup:** Extension is authenticated

**Steps:**
1. Open extension popup (authenticated state)
2. Click "Logout" button
3. Wait for state to clear

**Assertions:**
- Token is removed from storage
- User profile is hidden
- Login button is visible
- Logout button is hidden

### 3. State Persistence

**Setup:** Extension is authenticated

**Steps:**
1. Authenticate user
2. Close popup
3. Reopen popup
4. Verify authenticated state is restored

**Assertions:**
- User profile displayed immediately (no loading delay)
- Token still present in storage
- No re-authentication required

### 4. State Synchronization

**Setup:** Extension with popup and sidepanel

**Steps:**
1. Open popup and sidepanel
2. Login via popup
3. Verify sidepanel updates automatically
4. Logout via sidepanel
5. Verify popup updates automatically

**Assertions:**
- Both contexts show same auth state
- State changes broadcast correctly
- No manual refresh needed

### 5. Error Handling

**Setup:** Mock server in error mode

**Scenarios:**
- Network failure during login
- Invalid token (401 response)
- Server error (500 response)
- Timeout waiting for OAuth callback

**Assertions:**
- Error message displayed to user
- UI remains functional
- Retry option available when appropriate
- No partial auth state (clean failure)

## Test Utilities

### MockOpenWebUIServer Class

```typescript
class MockOpenWebUIServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private errorMode: ErrorMode = 'none';
  
  async start(port?: number): Promise<void>
  async stop(): Promise<void>
  getBaseUrl(): string
  setErrorMode(mode: ErrorMode): void
  getRequestLog(): RequestLog[]
}
```

### AuthTestHelper Class

```typescript
class AuthTestHelper {
  constructor(private page: Page, private extensionId: string);
  
  async openPopup(): Promise<void>
  async clickLogin(): Promise<void>
  async waitForAuthComplete(): Promise<void>
  async clickLogout(): Promise<void>
  async verifyAuthenticatedState(): Promise<void>
  async verifyUnauthenticatedState(): Promise<void>
  async getStoredToken(): Promise<string | null>
  async openSidepanel(): Promise<void>
}
```

## Implementation Plan

1. **Create Mock Server** (`test/e2e/utils/mock-server.ts`)
   - Implement HTTP server with OAuth endpoints
   - Add token validation endpoint
   - Add error mode configuration

2. **Create Test Helpers** (`test/e2e/utils/auth-helper.ts`)
   - Implement authentication helper methods
   - Add state verification utilities
   - Add storage inspection helpers

3. **Update Playwright Config**
   - Add `globalSetup` to start mock server
   - Add `globalTeardown` to stop mock server
   - Set environment variable for mock server URL

4. **Implement Tests** (`test/e2e/auth.e2e.ts`)
   - Replace placeholder tests with real scenarios
   - Add all test cases described above
   - Ensure proper cleanup between tests

5. **Update Build Configuration**
   - Ensure test build includes mock server URL
   - Verify extension can read test configuration

## Trade-offs and Considerations

### Why Mock Server Instead of Real OAuth?

**Pros:**
- ✅ No external dependencies (Microsoft, Azure)
- ✅ Deterministic and fast
- ✅ Easy to test error scenarios
- ✅ No rate limiting or quota concerns
- ✅ Works offline and in CI
- ✅ Simpler test setup

**Cons:**
- ❌ Doesn't test actual Microsoft OAuth integration
- ❌ Won't catch issues with real OAuth flow

**Decision:** Use mock server for E2E tests. Real OAuth integration should be validated manually or in a staging environment with real credentials.

### Simplified Token Format

We use simple test tokens like `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-12345` instead of fully valid JWTs because:
- Extension doesn't validate JWT signature (backend does)
- Format looks like a real JWT (base64 header + payload identifier)
- Clear distinction between test and production tokens
- Easier debugging while maintaining realistic structure

### Cookie vs Bearer Token Handling

The mock server supports both authentication methods:
- **Set-Cookie in OAuth callback**: Mimics real OpenWebUI OAuth flow
- **Bearer token in API requests**: Standard API authentication
- **Cookie in API requests**: Alternative authentication method
- `/api/v1/auths/` accepts both and can return token if cookie is present

### Port Selection

Mock server will use a random available port to avoid conflicts:
- Find free port on startup
- Store port for test access
- Clean shutdown on test completion

### State Cleanup

Each test should start with clean state:
- Clear chrome.storage before each test
- Reset mock server error mode
- Close all extension windows
- Use `test.beforeEach` for cleanup

## Security Considerations

- Mock server only runs during tests (not in production)
- Test tokens are clearly marked as test tokens
- No real credentials used
- Mock server only accepts local connections

## Performance

- Mock server startup: <100ms
- Test execution: ~30-60s for full auth suite
- No impact on production bundle size
- Parallel execution possible with dynamic ports
