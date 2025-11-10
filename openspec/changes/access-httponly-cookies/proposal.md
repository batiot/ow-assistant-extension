# Proposal: Access HttpOnly Cookies

## Summary
Enhance the authentication system to properly access HttpOnly cookies set by the OpenWebUI backend using the `chrome.cookies` API, which provides privileged access to cookies regardless of HttpOnly, Secure, and SameSite flags.

## Problem
The current implementation has two critical issues with HttpOnly cookie handling:

1. **Session Detection (`checkSessionAuth()`)**: The method calls `/api/v1/auths/` with `credentials: 'include'`, expecting the browser to automatically send the HttpOnly cookie. However, in an extension context, fetch requests don't share the same cookie jar as web pages, so the cookie is NOT automatically included. This causes session detection to fail even when a valid cookie exists.

2. **OAuth Callback (`extractTokenFromCallback()`)**: The method attempts to extract tokens using `chrome.cookies.getAll()`, which works but needs refinement for cleaner code and better error handling.

The extension needs to:
1. Read the HttpOnly token cookie using `chrome.cookies.get()` 
2. Explicitly include it in the `Cookie` header when calling `/api/v1/auths/`
3. Properly handle the token cookie regardless of security flags (HttpOnly, Secure, SameSite=Strict)
4. Work correctly in both localhost development and production environments

## Motivation
As per the user's research, `chrome.cookies` API works at a privileged browser level and can access cookies regardless of HttpOnly, Secure, and SameSite=Strict flags. The backend sets an HttpOnly cookie named "token" at `http://localhost:8080`, and the extension needs to reliably extract this value for authentication purposes.

## Proposed Solution

### 1. Create a Shared Cookie Helper Function
Create a reusable `getTokenCookie()` helper that uses `chrome.cookies.get()`:

```typescript
async function getTokenCookie(baseUrl: string): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: baseUrl,
      name: "token"
    });
    
    if (cookie) {
      return cookie.value;
    } else {
      console.warn("Token cookie not found");
      return null;
    }
  } catch (error) {
    console.error("Error getting cookie:", error);
    return null;
  }
}
```

This helper:
- Uses `chrome.cookies.get()` for direct access (works with HttpOnly cookies)
- Returns the cookie value or null
- Works even when cookie is HttpOnly, Secure, and SameSite=Strict
- Provides clear error handling and logging

### 2. Update `checkSessionAuth()` Method
Modify the session detection to explicitly read and send the cookie:

```typescript
private async checkSessionAuth(): Promise<{ token: AuthToken; user: UserInfo } | null> {
  try {
    // Read the HttpOnly cookie using chrome.cookies API
    const tokenValue = await this.getTokenCookie();
    
    if (!tokenValue) {
      console.log('[Auth] No token cookie found for session check');
      return null;
    }
    
    // Send the cookie explicitly in the Cookie header
    const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${tokenValue}`,  // Explicitly include the cookie
      },
    });
    
    // ... rest of validation logic
  } catch (error) {
    console.warn('[Auth] Session check error:', error);
    return null;
  }
}
```

**Why this is necessary:** In an extension context, `credentials: 'include'` does NOT automatically send cookies because the extension's fetch doesn't share the browser's cookie jar with web pages. We must read the cookie via `chrome.cookies.get()` and explicitly include it in the request.

### 3. Update `extractTokenFromCallback()` Method
Simplify token extraction to use the shared helper:

```typescript
private async extractTokenFromCallback(): Promise<AuthToken> {
  const tokenValue = await this.getTokenCookie();
  
  if (!tokenValue) {
    throw new AuthError(
      AuthErrorType.AUTHENTICATION_FAILED,
      'No authentication token found in cookies'
    );
  }
  
  // Get cookie details for expiration
  const cookie = await chrome.cookies.get({
    url: this.config.baseUrl,
    name: 'token',
  });
  
  const expiresAt = cookie?.expirationDate
    ? cookie.expirationDate * 1000
    : Date.now() + 24 * 60 * 60 * 1000;
  
  return { token: tokenValue, expiresAt };
}
```

## Scope
**Capabilities affected:**
- `auth` - MODIFIED to improve cookie-based token extraction

**Out of scope:**
- Changes to backend cookie configuration
- Modifications to OAuth flow itself
- Token storage mechanisms (already handled)

## Success Criteria
1. Extension successfully extracts token from HttpOnly cookie after OAuth callback
2. Authentication works with cookies marked as HttpOnly, Secure, and SameSite=Strict
3. Clear error messages when token cookie is not found
4. No regression in existing authentication flows

## Dependencies
- Requires `cookies` permission in manifest (already present)
- Requires proper host_permissions for the backend URL (already present)

## Risks
- Minimal risk: changes are localized to token extraction method
- The `chrome.cookies` API is well-established and stable
- Existing fallback mechanisms (session-based auth) remain intact
