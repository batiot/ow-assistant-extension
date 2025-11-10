# OpenWebUI Authentication Mechanism

## Overview

This document provides a detailed explanation of how OpenWebUI authentication works and how the extension integrates with it.

---

## OpenWebUI Backend Authentication

### Cookie-Based Session Management

OpenWebUI uses **HTTP-only cookies** to maintain user sessions after OAuth authentication:

1. User authenticates via OAuth provider (Microsoft/EntraID)
2. Backend sets `token` cookie with these attributes:
   - **Name**: `token`
   - **Value**: JWT token (e.g., `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - **HttpOnly**: `true` (cannot be accessed via JavaScript)
   - **Secure**: `true` (HTTPS only in production)
   - **SameSite**: Set by backend
   - **Expiration**: Managed by backend

### Session Validation Endpoint

**Endpoint**: `GET /api/v1/auths/`

**Purpose**: Validate current session and retrieve user information + token

#### Authenticated Request/Response

When a valid HTTP-only cookie exists, the browser automatically sends it:

**Request:**
```http
GET /api/v1/auths/ HTTP/1.1
Host: openwebui.example.com
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "id": "16f44d75-3705-4adf-a83e-f5f6fbedf495",
  "email": "batiot@live.com",
  "name": "david batiot",
  "role": "admin",
  "profile_image_url": "/user.png",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE2ZjQ0ZDc1LTM3MDUtNGFkZi1hODNlLWY1ZjZmYmVkZjQ5NSJ9.RHDEMoIL2Hc20m2BfxR1XbotgrPMxcbuEknTprxkyXo",
  "token_type": "Bearer",
  "expires_at": null,
  "permissions": {
    "workspace": {
      "models": false,
      "knowledge": false,
      "prompts": false,
      "tools": false
    },
    "sharing": {
      "public_models": false,
      "public_knowledge": false,
      "public_prompts": false,
      "public_tools": false,
      "public_notes": false
    },
    "chat": {
      "controls": true,
      "valves": true,
      "system_prompt": true,
      "params": true,
      "file_upload": true,
      "delete": true,
      "delete_message": true,
      "continue_response": true,
      "regenerate_response": true,
      "rate_response": true,
      "edit": true,
      "share": true,
      "export": true,
      "stt": true,
      "tts": true,
      "call": true,
      "multiple_models": true,
      "temporary": true,
      "temporary_enforced": false
    },
    "features": {
      "direct_tool_servers": false,
      "web_search": true,
      "image_generation": true,
      "code_interpreter": true,
      "notes": true
    }
  },
  "bio": null,
  "gender": null,
  "date_of_birth": null
}
```

**Key Response Fields:**
- `token` ⭐ **CRITICAL**: JWT token value - this is what the extension extracts and stores
- `token_type`: Always `"Bearer"`
- `expires_at`: `null` means session-based (no client-side expiry)
- `id`, `email`, `name`, `role`: User profile information
- `permissions`: Detailed user permissions (optional)

#### Unauthenticated Request/Response

When no valid cookie exists or session expired:

**Request:**
```http
GET /api/v1/auths/ HTTP/1.1
Host: openwebui.example.com
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Unauthorized"
}
```

---

## Extension Authentication Strategy

### Three-Tier Authentication Approach

#### Tier 1: Extension Storage (Primary - Fastest)

**Check**: `chrome.storage.local` or `chrome.storage.session`

**When**: On every extension startup and before API calls

**Behavior**:
- Read cached token from extension storage
- If valid token exists → Use it immediately
- If no token or invalid → Proceed to Tier 2

**Performance**: ~1ms (local read)

---

#### Tier 2: Session Detection (Fallback - Silent)

**Check**: Call `GET /api/v1/auths/` without Authorization header

**When**: Extension storage is empty or has invalid token

**Flow**:
```
1. Call GET /api/v1/auths/ (no Authorization header)
2. Browser automatically includes HTTP-only cookie
3. Backend validates cookie
4. Response contains token in JSON
5. Extract response.token
6. Store in extension storage
7. Update UI to authenticated state
```

**Why This Works**:
- HTTP-only cookies cannot be read via `chrome.cookies.getAll()`
- Browser automatically sends cookie with same-origin requests
- API returns token value in response when cookie is valid
- Enables **silent authentication** without user interaction

**Performance**: ~50-200ms (network call)

**Example Code**:
```typescript
async function checkSessionAuth(): Promise<AuthToken | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/auths/`, {
      method: 'GET',
      credentials: 'include', // Important: includes cookies
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        return {
          token: data.token,
          expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // Session-based
        };
      }
    }
    return null;
  } catch (error) {
    console.warn('Session check failed:', error);
    return null;
  }
}
```

---

#### Tier 3: OAuth Flow (Last Resort - Interactive)

**Trigger**: Session detection returns 401/403 or fails

**When**: No existing session, token expired, or user logged out

**Flow**:
```
1. Open popup window to /oauth/microsoft/login
2. User authenticates via Microsoft/EntraID
3. Backend sets HTTP-only cookie
4. Redirect to /oauth/microsoft/callback
5. Extension detects callback URL
6. Extract token from cookie (via /api/v1/auths/ call)
7. Store in extension storage
8. Close popup window
```

**Performance**: ~5-30 seconds (user interaction required)

---

## Why HTTP-Only Cookies?

### Security Benefits

1. **XSS Protection**: JavaScript cannot read the token
2. **Cookie Hijacking**: Harder to steal via client-side attacks
3. **Automatic Management**: Browser handles sending/storing

### Extension Challenge

❌ **Cannot use**: `chrome.cookies.getAll()` - Returns empty because cookie is HTTP-only

✅ **Solution**: Use `/api/v1/auths/` as a "cookie validator" that returns the token

---

## Token Lifecycle

### Token Creation
1. User authenticates via OAuth
2. Backend generates JWT token
3. Backend sets HTTP-only cookie with token
4. Backend also returns token in callback response

### Token Storage (Extension)
1. Extract from `/api/v1/auths/` response or OAuth callback
2. Store in `chrome.storage.local` or `chrome.storage.session`
3. Use for subsequent API calls with `Authorization: Bearer {token}` header

### Token Validation
- **Client-side**: Not performed (JWT has no expiry field we can check)
- **Server-side**: Backend validates on every API call
- **Expiry**: `expires_at: null` means session-based
- **Renewal**: Not implemented - user must re-authenticate when session expires

### Token Expiration
1. Backend invalidates session
2. API calls return 401 Unauthorized
3. Extension clears stored token
4. User must re-authenticate (Tier 3)

---

## Implementation Checklist

- [x] Document authentication mechanism
- [ ] Implement `checkSessionAuth()` method
- [ ] Update `initialize()` to check session as fallback
- [ ] Update `login()` to check session before OAuth
- [ ] Add comprehensive tests (unit + E2E)
- [ ] Update API types with complete response structure
- [ ] Update documentation in `src/auth/README.md`

---

## FAQ

**Q: Why not just read the cookie directly?**
A: The cookie is HTTP-only, which means it's invisible to JavaScript and `chrome.cookies.getAll()`. This is a security feature.

**Q: How does the extension get the token then?**
A: By calling `/api/v1/auths/` without auth, the browser sends the cookie automatically, and the API returns the token in the JSON response.

**Q: What if the token has no expiration?**
A: Set `expiresAt` to a far future date or omit expiry checks. The backend is the source of truth - it will return 401 when the token is invalid.

**Q: Can we use the token for API calls?**
A: Yes! Once extracted, store it and use `Authorization: Bearer {token}` header for all API requests.

**Q: What happens if both cookie and stored token exist?**
A: Extension storage takes priority (Tier 1). Session check (Tier 2) only runs if storage is empty or invalid.

**Q: How do we handle token refresh?**
A: Currently not implemented. User must re-authenticate when session expires. Could be added in future.

---

## Related Files

- `src/auth/service.ts` - Core authentication logic
- `src/auth/storage.ts` - Token storage utilities
- `src/api/types.ts` - API response types
- `src/api/client.ts` - API client with auth
- `test/e2e/auth.e2e.ts` - E2E authentication tests
