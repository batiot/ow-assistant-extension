# Mock Server Test API

The mock OpenWebUI server provides HTTP endpoints for customizing behavior in E2E tests.

## Why HTTP Endpoints?

Playwright's global setup runs in a separate process from test workers. The mock server instance is not directly accessible from test files due to process isolation. HTTP endpoints allow tests to configure the mock server across process boundaries.

## Available Endpoints

### 1. Error Mode Control

**Endpoint:** `POST /test/error-mode`

Control error scenarios for testing error handling.

**Request:**
```json
{
  "mode": "none" | "network" | "invalid_token" | "server_error"
}
```

**Example:**
```typescript
await fetch(`${mockServerUrl}/test/error-mode`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'network' }),
});
```

**Modes:**
- `none`: Normal operation (default)
- `network`: Return 503 Service Unavailable
- `invalid_token`: Return 401 Unauthorized
- `server_error`: Return 500 Internal Server Error

---

### 2. OAuth Delay Control

**Endpoint:** `POST /test/oauth-delay`

Set OAuth redirect delay in milliseconds for testing timeouts and silent auth.

**Request:**
```json
{
  "delay": 100 | 3000 | <number>
}
```

**Example:**
```typescript
// Fast/silent auth (default)
await fetch(`${mockServerUrl}/test/oauth-delay`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ delay: 100 }),
});

// Test timeout scenario
await fetch(`${mockServerUrl}/test/oauth-delay`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ delay: 3000 }),
});
```

---

### 3. Auth Scenario Control

**Endpoint:** `POST /test/auth-scenario`

Customize authentication endpoint (`/api/v1/auths/`) behavior for testing different authentication methods.

**Request:**
```json
{
  "scenario": "default" | "require-cookie-header" | "require-bearer-token" | "missing-token" | "custom-user"
}
```

**Example:**
```typescript
// Test HttpOnly cookie handling
await fetch(`${mockServerUrl}/test/auth-scenario`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenario: 'require-cookie-header' }),
});
```

**Scenarios:**

| Scenario | Description | Use Case |
|----------|-------------|----------|
| `default` | Accept token from Bearer header or Cookie | Normal operation |
| `require-cookie-header` | Only accept token from Cookie header | HttpOnly cookie tests |
| `require-bearer-token` | Only accept token from Authorization header | Bearer token tests |
| `missing-token` | Always return 401 | Unauthenticated state tests |
| `custom-user` | Return admin user with full permissions | Permission-based feature tests |

---

## Usage Pattern in Tests

### Setup
```typescript
test.beforeAll(async () => {
  mockServerUrl = process.env.MOCK_SERVER_URL || '';
  if (!mockServerUrl) {
    throw new Error('Mock server not initialized');
  }
});
```

### Configure for Test
```typescript
test('my test', async ({ page, extensionId }) => {
  // Set desired scenario
  await fetch(`${mockServerUrl}/test/auth-scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'require-cookie-header' }),
  });
  
  // Run your test...
});
```

### Cleanup
```typescript
test.afterEach(async () => {
  // Reset to default after each test
  await fetch(`${mockServerUrl}/test/auth-scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'default' }),
  });
});
```

---

## Alternative: Direct Method Calls (Unit/Integration Tests Only)

For unit or integration tests that create their own mock server instance, you can use direct method calls:

```typescript
const server = new MockOpenWebUIServer();
await server.start();

// Direct method calls work here
server.setErrorMode('network');
server.setOAuthDelay(3000);
server.setRouteHandler('/api/v1/auths/', (req, res) => {
  res.json({ custom: 'response' });
});

// Cleanup
await server.stop();
```

**Note:** This approach does NOT work in E2E tests that use the global mock server due to process isolation.

---

## Examples

### Test HttpOnly Cookie Authentication
```typescript
test('should detect session using HttpOnly cookie', async ({ page, extensionId }) => {
  // Configure mock to only accept Cookie header
  await fetch(`${mockServerUrl}/test/auth-scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'require-cookie-header' }),
  });

  // Set HttpOnly cookie
  await page.context().addCookies([{
    name: 'token',
    value: 'test-token',
    domain: 'localhost',
    httpOnly: true,
    url: mockServerUrl,
  }]);

  // Extension should read cookie and send in Cookie header
  // Mock server validates it was sent correctly
});
```

### Test Error Handling
```typescript
test('should handle network errors', async ({ page, extensionId }) => {
  // Simulate network failure
  await fetch(`${mockServerUrl}/test/error-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'network' }),
  });

  // Extension should show appropriate error message
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  
  const errorMsg = await page.textContent('[data-testid="error-message"]');
  expect(errorMsg).toContain('network');
});
```

### Test Admin Permissions
```typescript
test('should show admin features', async ({ page, extensionId }) => {
  // Use custom user with admin role
  await fetch(`${mockServerUrl}/test/auth-scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'custom-user' }),
  });

  // Login and verify admin features are visible
  // Mock server returns user with admin role and full permissions
});
```

---

## See Also

- [MockOpenWebUIServer class](./utils/mock-server.ts) - Full implementation
- [httponly-cookie.e2e.ts](./httponly-cookie.e2e.ts) - Example usage
- [auth.e2e.ts](./auth.e2e.ts) - Error mode examples
