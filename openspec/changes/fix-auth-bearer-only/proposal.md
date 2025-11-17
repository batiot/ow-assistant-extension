# Proposal: Fix Auth Bearer-Only Endpoint

## Summary
Fix session authentication to use `Authorization: Bearer` header instead of `Cookie` header when validating tokens via `/api/v1/auths/`, because the actual OpenWebUI backend only accepts Bearer tokens and ignores Cookie headers.

## Problem
The current `checkSessionAuth()` implementation reads the token cookie via `chrome.cookies.get()` and sends it in the `Cookie` header when calling `/api/v1/auths/`. However, the real OpenWebUI backend:

1. **Only validates tokens from `Authorization: Bearer` header** - Cookie header is completely ignored
2. **Always re-sets the auth cookie** when called with a valid Bearer token
3. Returns 401 Unauthorized when only Cookie header is present (no Authorization header)

This causes session detection to fail even when a valid token cookie exists, forcing users through unnecessary OAuth flows.

The current implementation works with our mock server (which accepts both Bearer and Cookie for testing flexibility) but fails against the real OpenWebUI backend.

## Why
Session authentication currently fails against the real OpenWebUI backend because `checkSessionAuth()` sends tokens in the Cookie header, but the backend only validates tokens from the `Authorization: Bearer` header. This forces users through unnecessary OAuth flows even when they have valid session cookies.

The implementation was based on documentation assumptions, but testing against the real backend revealed:
- The `/api/v1/auths/` endpoint completely ignores Cookie headers
- Only `Authorization: Bearer <token>` is validated
- The backend re-sets the auth cookie when called with a valid Bearer token

This fix aligns the extension with actual backend behavior, improving user experience and eliminating authentication failures in production.

## Proposed Solution

### High-Level Approach
Change `checkSessionAuth()` to use the cookie value as a Bearer token instead of sending it in the Cookie header:

```typescript
// CURRENT (doesn't work with real backend):
const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
  headers: {
    'Cookie': `token=${tokenValue}`,  // ❌ Backend ignores this
  },
});

// PROPOSED (works with real backend):
const response = await fetch(`${this.config.baseUrl}/api/v1/auths/`, {
  headers: {
    'Authorization': `Bearer ${tokenValue}`,  // ✅ Backend validates this
  },
});
```

### Key Changes
1. **Update `checkSessionAuth()` method** in `src/auth/service.ts`:
   - Keep using `chrome.cookies.get()` to read HttpOnly cookie
   - Change from `Cookie` header to `Authorization: Bearer` header
   - Update comments to reflect actual backend behavior

2. **Update auth spec** in `openspec/specs/auth/spec.md`:
   - Modify requirements to specify Bearer header usage
   - Update scenarios to reflect real backend behavior
   - Document that backend re-sets cookie on validation

3. **Update mock server to match real backend behavior**:
   - Remove Cookie header authentication from mock server `/api/v1/auths/` endpoint
   - Make mock server accept ONLY `Authorization: Bearer` tokens (like real backend)
   - Remove `require-cookie-header` scenario (not real backend behavior)
   - Remove `default` scenario's Cookie header support
   - Keep only `require-bearer-token` scenario as the standard behavior

4. **Clean up test scenarios**:
   - Remove all tests using `require-cookie-header` scenario
   - Update E2E tests to only test Bearer token authentication
   - Update unit tests to verify Bearer header is sent
   - Remove Cookie header assertions from test expectations
   - Simplify mock server documentation (no more dual-mode complexity)

### Implementation Notes
- The `validateToken()` method already uses Bearer header correctly - no changes needed
- The `extractTokenFromCallback()` method uses `chrome.cookies.get()` correctly - no changes needed
- **Mock server will be updated to match real backend**: only accept Bearer tokens, reject Cookie headers
- This eliminates confusion between test and production behavior
- Tests will exclusively test Bearer token scenarios
- Real backend behavior: calling with Bearer token causes backend to re-set the same cookie (harmless side effect)

## Affected Components
- `src/auth/service.ts` - `checkSessionAuth()` method
- `openspec/specs/auth/spec.md` - Session detection requirements
- `test/e2e/utils/mock-server.ts` - Remove Cookie header support from `/api/v1/auths/`
- `test/e2e/httponly-cookie.e2e.ts` - Remove Cookie header test scenarios
- `test/unit/auth/session-detection.test.ts` - Update to verify Bearer header
- `test/e2e/MOCK_SERVER_API.md` - Simplify documentation (Bearer-only)
- Documentation comments throughout

## Benefits
- ✅ Session detection works with real OpenWebUI backend
- ✅ Reduces unnecessary OAuth popups for users with existing sessions
- ✅ Aligns implementation with actual backend API behavior
- ✅ Mock server now matches real backend behavior exactly
- ✅ Eliminates confusion between test and production environments
- ✅ Cleaner test suite focused on real backend scenarios
- ✅ Removes misleading test scenarios that don't match production
- ✅ No breaking changes to public API or extension behavior

## Risks & Mitigation
- **Risk**: Tests might fail if they assume Cookie header behavior
  - **Mitigation**: Review and update test scenarios, preserve mock server flexibility
  
- **Risk**: Backend might change to accept Cookie header in future
  - **Mitigation**: Mock server supports both methods, easy to revert if needed

## Alternatives Considered
1. **Modify backend to accept Cookie header** - Not feasible, we don't control OpenWebUI
2. **Skip session detection entirely** - Worse UX, forces unnecessary OAuth flows
3. **Use both headers (Belt and suspenders)** - Unnecessary, Bearer header is sufficient

## Success Criteria
- [ ] Session detection succeeds when valid token cookie exists
- [ ] Extension authenticates without OAuth popup when browser session is valid
- [ ] Mock server rejects Cookie header authentication (matches real backend)
- [ ] All tests use Bearer token scenarios exclusively
- [ ] No tests rely on Cookie header authentication
- [ ] Mock server documentation simplified (Bearer-only)
- [ ] Code comments accurately reflect backend behavior
