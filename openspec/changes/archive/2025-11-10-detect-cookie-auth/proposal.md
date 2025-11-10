# Change: Detect Cookie-Based Authentication

**Change ID**: `detect-cookie-auth`  
**Date**: 2025-11-10  
**Status**: Draft  
**Author**: AI Assistant

---

## Why

The extension currently only checks extension storage for authentication tokens, never testing if an existing browser session cookie is still valid. Since OpenWebUI sets HTTP-only cookies that cannot be read directly, the extension should call `/api/v1/auths/` (without Authorization header) to check if a valid session exists. This API returns the token and user info when a valid cookie is present, enabling seamless re-authentication without OAuth popups.

---

## What Changes

- Add `checkSessionAuth()` method to `AuthService` to test for existing session via `/api/v1/auths/`
- Modify `AuthService.initialize()` to check session auth after storage check fails
- Modify `AuthService.login()` to check session auth before opening OAuth popup
- Call `/api/v1/auths/` **without** Authorization header (relies on HTTP-only cookie)
- Extract token from API response JSON (`response.token`)
- Store token in extension storage for subsequent API calls
- Enable true silent authentication when browser session exists

---

## Impact

**Affected specs:**
- `auth` - Add cookie detection requirements, modify authentication flow

**Affected code:**
- `src/auth/service.ts` - Core authentication logic changes
- `src/auth/storage.ts` - No changes (uses existing token storage)
- `src/api/types.ts` - Already has `token` field in `UserValidationResponse`
- `test/unit/auth/` - New unit tests for session detection
- `test/e2e/auth.e2e.ts` - New E2E tests for session-based auth flows

---

## Details

### Authentication Mechanism Overview

OpenWebUI uses a **cookie-based authentication system** with JWT tokens. Understanding this mechanism is critical for proper extension integration.

#### How OpenWebUI Authentication Works

1. **OAuth Flow**: User authenticates via OAuth provider (e.g., Microsoft/EntraID)
2. **Cookie Set**: Backend sets HTTP-only `token` cookie containing JWT
3. **Session Validation**: Cookie is sent automatically with all requests to OpenWebUI
4. **Token Extraction**: `/api/v1/auths/` endpoint returns token value in JSON response

#### HTTP-Only Cookie Characteristics

- **Name**: `token`
- **Attributes**: `HttpOnly`, `Secure` (on HTTPS), `SameSite`
- **Value**: JWT token (e.g., `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
- **Accessibility**: **Cannot be read via JavaScript** (`document.cookie` or `chrome.cookies.getAll()`)
- **Lifespan**: Managed by backend, `expires_at: null` means session-based

#### API Endpoint: `GET /api/v1/auths/`

**Purpose**: Validate current session and retrieve user info + token

**Request (with existing session):**
```http
GET /api/v1/auths/ HTTP/1.1
Host: openwebui.example.com
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK when authenticated):**
```json
{
  "id": "16f44d75-3705-4adf-a83e-f5f6fbedf495",
  "email": "****@aaaa.com",
  "name": "**** ****",
  "role": "admin",
  "profile_image_url": "/user.png",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE2ZjQ0ZDc1LTM3MDUtNGFkZi1hODNlLWY1ZjZmYmVkZjQ5NSJ9.RHDEMoIL2Hc20m2BfxR1XbotgrPMxcbuEknTprxkyXo",
  "token_type": "Bearer",
  "expires_at": null,
  "permissions": { ... },
  "bio": null,
  "gender": null,
  "date_of_birth": null
}
```

**Response (401 Unauthorized when not authenticated):**
```json
{
  "detail": "Unauthorized"
}
```

**Key Fields:**
- `token`: JWT value - **this is what we extract and store**
- `token_type`: Always `"Bearer"`
- `expires_at`: `null` means session-based (no client-side expiry)
- `id`, `email`, `name`, `role`: User information
- `permissions`: Detailed user permissions (optional to use)

#### Extension Authentication Strategy

**Three-Tier Approach:**

1. **Extension Storage (Primary)**
   - Check `chrome.storage` for cached token
   - Fastest method, no network call
   - Used for all subsequent API requests

2. **Session Detection (Fallback)**
   - Call `/api/v1/auths/` without Authorization header
   - Browser sends HTTP-only cookie automatically
   - Extract `response.token` and store in extension storage
   - Enables silent authentication

3. **OAuth Flow (Last Resort)**
   - Open popup to `/oauth/microsoft/login`
   - User authenticates, backend sets cookie
   - Extract token from callback and store
   - Traditional authentication flow

### Technical Approach

**Important:** OpenWebUI sets HTTP-only cookies that cannot be read by `chrome.cookies.getAll()`. Instead, we test for an existing session by calling `/api/v1/auths/` **without** an Authorization header. If a valid HTTP-only cookie exists, the API returns the token and user info in the JSON response.

The authentication service will check for existing sessions at two points:

1. **During initialization** - After checking extension storage, if no valid token exists, call `/api/v1/auths/` without auth header
2. **Before OAuth flow** - When user clicks login, check session first before opening popup

If a session exists:
- API returns `{ id, email, name, token, ... }` 
- Extract `token` from response
- Store token in extension storage
- Update auth state with user info
- Skip OAuth flow

### Session Check Priority
1. Extension storage (fastest - token already cached)
2. Session API call: `GET /api/v1/auths/` without Authorization header
3. Extract token from JSON response if successful
4. Store in extension storage
5. OAuth flow (only if session check fails)

---

## Notes

- HTTP-only cookies cannot be read via `chrome.cookies` API
- Use `/api/v1/auths/` without Authorization header to test session
- API returns token in JSON response when valid cookie present
- Token has no expiry date - only backend can validate it
- Session detection is on-demand only, not periodic polling
- Extension storage remains source of truth after initial session detection

