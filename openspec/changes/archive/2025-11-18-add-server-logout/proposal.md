# Proposal: Add Server-Side Logout

## Why

Users expect that clicking the logout button will fully sign them out of the application, both locally and on the server. Currently, the logout functionality only clears the local token from extension storage without notifying the OpenWebUI backend. This creates an incomplete logout experience:

1. **Security gap**: The server session remains active even after the user believes they've logged out
2. **Inconsistent state**: If the user has OpenWebUI open in a browser tab, they remain logged in there while logged out of the extension
3. **Audit trail**: No server-side record that the user logged out from the extension

By calling the backend's `/api/v1/auths/signout` endpoint during logout, we ensure a complete, secure logout that invalidates the session on both the client and server.

## Problem Statement

The current logout implementation (`AuthService.logout()`) only performs local cleanup by removing the token from `chrome.storage` and updating the local auth state. It does not communicate with the OpenWebUI backend to invalidate the server-side session.

### Current Behavior

1. User clicks the logout button in the extension UI
2. `AuthContext.logout()` sends `AUTH_LOGOUT` message to background script
3. Background script calls `authService.logout()`
4. Auth service:
   - Removes token from local storage (`TokenStorage.removeToken()`)
   - Updates auth state to unauthenticated
   - Notifies listeners
5. **Missing**: No call to server to invalidate the session
6. Server session remains active with a valid token

### Root Cause

The `logout()` method in `AuthService` (`src/auth/service.ts`) is designed as a client-only operation. It was not implemented with server-side session invalidation because:

1. The initial implementation focused on local state management
2. Silent logout was prioritized (no visible errors to user)
3. Server-side logout endpoint (`/api/v1/auths/signout`) integration was deferred

### Impact

- **Security**: User sessions remain active on the server after local logout
- **User expectation**: Users believe they are fully logged out when they are not
- **Session management**: No server-side tracking of logout events
- **Multi-device scenarios**: Logging out from the extension doesn't affect other sessions (browser tabs, other devices)
- **Compliance**: May not meet organizational requirements for complete session termination

## Proposed Solution

Enhance the logout functionality to call the OpenWebUI backend's `/api/v1/auths/signout` endpoint before clearing local state, ensuring both client and server sessions are terminated.

### Implementation Approach

1. **Add server-side logout call** in `AuthService.logout()`:
   - Before clearing local storage, make a GET request to `/api/v1/auths/signout`
   - Include the current authentication token in the `Authorization: Bearer` header
   - The endpoint is expected to be silent (no response body required, just status code)

2. **Handle the call gracefully**:
   - If the server call succeeds (200-299 status), proceed with local cleanup
   - If the server call fails (network error, 401, 500, etc.), still proceed with local cleanup
   - Log server errors for debugging but don't block the logout
   - Ensure logout always completes from the user's perspective (silent failures)

3. **Verify auth status after logout**:
   - After clearing local state, optionally verify by calling `/api/v1/auths/` (should return 401)
   - This is a verification step, not a blocking requirement

### Success Criteria

1. Logout button triggers server-side session invalidation
2. Local token and state are cleared regardless of server response
3. Server sessions are terminated when backend is reachable
4. Logout completes successfully even if server is unreachable (graceful degradation)
5. No visible errors to user during normal logout flow
6. Existing tests continue to pass
7. New tests verify server logout endpoint is called

### Out of Scope

- Forcing logout across all user devices/sessions (server may or may not implement this)
- Handling complex multi-session scenarios (e.g., logout from all tabs)
- UI changes (existing logout button behavior is correct)
- Changing logout button placement or styling

## Dependencies

- **OpenWebUI Backend**: Assumes `/api/v1/auths/signout` endpoint exists and accepts GET requests with Bearer token
- **Auth Service**: Requires access to current token and baseUrl configuration
- **No breaking changes**: Implementation should be backward compatible with current logout behavior

## Risk Assessment

**Low Risk**:
- Changes are localized to `AuthService.logout()` method
- Graceful degradation ensures logout always works
- No UI changes required
- Existing behavior is preserved (always clears local state)

**Mitigation**:
- Silent failure handling ensures user experience is not degraded
- Comprehensive error logging for debugging
- Tests verify both success and failure scenarios

## Timeline Estimate

- Implementation: 1-2 hours
- Testing: 1 hour (unit tests + e2e tests)
- Review and validation: 30 minutes

**Total**: ~3 hours
