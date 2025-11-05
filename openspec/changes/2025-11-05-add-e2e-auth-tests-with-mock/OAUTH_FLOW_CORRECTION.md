# OAuth Flow Correction Summary

## Issue Identified

The initial proposal incorrectly assumed the OAuth callback returned the JWT token as a URL parameter:
- ❌ **Incorrect**: `/oauth/microsoft/callback?token=eyJh...`
- ✅ **Correct**: `/oauth/microsoft/callback?code=auth-code-123` with `Set-Cookie: token=eyJh...`

## Corrected OAuth Flow

### Actual OpenWebUI OAuth Flow

```
1. User clicks "Login"
   ↓
2. Extension opens popup: /oauth/microsoft/login
   ↓
3. OAuth redirects to: /oauth/microsoft/callback?code=<auth-code>
   ↓
4. Response includes: Set-Cookie: token=eyJh...
   ↓
5. Extension extracts token from cookie (not URL)
   ↓
6. Token is stored and validated
```

### Token Retrieval from /api/v1/auths/

The endpoint supports two authentication modes:

**Mode 1: Bearer Token (Standard)**
```http
GET /api/v1/auths/
Authorization: Bearer eyJh...

Response:
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "User Name",
  ...
}
```

**Mode 2: Cookie Authentication**
```http
GET /api/v1/auths/
Cookie: token=eyJh...

Response:
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "User Name",
  "token": "eyJh...",  // Token included in response when using cookie auth
  ...
}
```

## Updated Mock Server Implementation

### Key Changes

1. **OAuth Callback Endpoint**
   - Now returns `code` parameter (not `token`)
   - Sets `Set-Cookie` header with JWT token
   - Requires cookie-parser middleware

2. **Token Validation Endpoint**
   - Accepts Bearer token OR cookie token
   - Returns token in JSON response if authenticated via cookie
   - Dual authentication support

3. **Dependencies**
   - Added `express` (recommended for cookie support)
   - Added `cookie-parser` middleware
   - Cookie handling utilities in test helpers

## Updated Test Scenarios

### Login Flow Test
```typescript
// OLD (incorrect)
await waitForCallbackUrl('/oauth/microsoft/callback?token=...');
const token = extractTokenFromUrl();

// NEW (correct)
await waitForCallbackUrl('/oauth/microsoft/callback?code=...');
const token = extractTokenFromCookie(response);
```

### Mock Server Configuration
```typescript
// Callback endpoint now sets cookie
app.get('/oauth/microsoft/callback', (req, res) => {
  const token = generateTestToken();
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.send(successHtml);
});

// Auth endpoint supports both methods
app.get('/api/v1/auths/', (req, res) => {
  const bearerToken = req.headers.authorization?.replace('Bearer ', '');
  const cookieToken = req.cookies?.token;
  const token = bearerToken || cookieToken;
  
  // ... validation ...
  
  const response = { ...userData };
  if (cookieToken && !bearerToken) {
    response.token = cookieToken; // Include token for cookie auth
  }
  res.json(response);
});
```

## Files Updated

1. ✅ **design.md**
   - Corrected OAuth flow diagram
   - Updated endpoint implementations
   - Added cookie handling section
   
2. ✅ **proposal.md**
   - Updated "What Changes" section
   - Added cookie-parser dependency
   - Clarified dual authentication support
   
3. ✅ **specs/testing/spec.md**
   - Updated OAuth callback scenario
   - Modified token validation scenario
   - Enhanced login flow scenario
   
4. ✅ **tasks.md**
   - Added cookie-parser middleware task
   - Added Set-Cookie implementation task
   - Added cookie extraction helper tasks
   - Updated test implementation tasks

## Validation

✅ OpenSpec validation passed with strict mode
✅ All scenarios include cookie-based authentication
✅ Dual authentication modes properly documented
✅ Mock server implementation matches real OpenWebUI behavior

## Impact on Implementation

### Additional Requirements
- Install `express` and `cookie-parser` packages
- Implement cookie extraction in extension (may already exist)
- Add cookie inspection utilities for tests
- Support both auth modes in mock server

### No Breaking Changes
- All changes are additive to the test infrastructure
- Extension code already handles cookie-based auth
- Mock server provides more realistic testing environment
