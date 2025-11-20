# Proposal: Fix OAuth Callback Query Parameter Preservation

## Why

The current OAuth callback flow fails because query parameters (authorization code, state, session_state) are lost during the `declarativeNetRequest` redirect. This causes authentication to fail silently after the user successfully completes OAuth login.

### Current Behavior (Broken)

1. User completes OAuth login with provider (e.g., Microsoft)
2. Provider redirects to: `http://localhost:8080/oauth/microsoft/callback?code=...&state=...&session_state=...`
3. `declarativeNetRequest` rule intercepts and redirects using `extensionPath`
4. Redirect target becomes: `chrome-extension://<id>/src/pages/oauth-callback.html` **WITHOUT** query parameters ❌
5. `launchWebAuthFlow` returns URL without `code` parameter
6. Auth service cannot extract authorization code → authentication fails

### Root Causes

1. **Chrome API Limitation**: The `extensionPath` redirect type in `declarativeNetRequest` does NOT automatically preserve query parameters
2. **Missing JavaScript Logic**: The `oauth-callback.html` page has no script to handle the callback or signal completion
3. **Provider Context Loss**: The redirect loses information about which OAuth provider was used (needed for token exchange)

### Evidence

From Chrome documentation and testing:
- `declarativeNetRequest` with `"redirect": { "extensionPath": "..." }` performs simple string substitution without query parameter handling
- Current `public/rules.json` uses `urlFilter` and `extensionPath`, which cannot capture or transform URL components
- Unit tests mock the complete URL with parameters, masking this real-world failure

## What Changes

This proposal implements two complementary fixes:

### Fix 1: Use regexFilter with URL Redirect and Query Parameter Preservation

Replace the simple `extensionPath` redirect with a `regexFilter` + `url` redirect that:
- Captures the provider name from the callback URL path
- Preserves all query parameters (code, state, session_state)
- Constructs the extension callback URL with both provider context and OAuth parameters

### Fix 2: Add JavaScript Logic to OAuth Callback Page

Add a minimal script to `oauth-callback.html` that:
- Validates the presence of required query parameters
- Signals successful callback to `launchWebAuthFlow` (implicit by page load)
- Provides user feedback during processing
- Handles error states gracefully

## Impact

- **Affected specs**: `auth`, `testing`
- **Affected code**:
  - `public/rules.json` - Complete rewrite with `regexFilter` and parameter preservation
  - `src/pages/oauth-callback.html` - Add JavaScript for validation and user feedback
  - `src/auth/service.ts` - Minor: Extract provider from callback URL instead of guessing
  - Unit tests - Update mocks to reflect actual Chrome behavior
  - E2E tests - May need updates if callback page behavior changes
- **Breaking changes**: None - This fixes existing broken behavior
- **Backend changes**: None required
- **Security considerations**: 
  - Query parameters are preserved in extension URL (acceptable for ephemeral auth codes)
  - No sensitive data is persisted
  - Callback page validates parameters before accepting them

## Non-Goals

- Supporting multiple simultaneous OAuth providers (already not supported)
- Changing the overall OAuth flow architecture
- Adding refresh token support
- Implementing OAuth PKCE (not required by current backend)

## Approach

### Implementation Strategy

1. **Update declarativeNetRequest Rule**:
   - Use `regexFilter` to capture provider name: `^(https?://[^/]+)/oauth/([^/]+)/callback(.*)$`
   - Use `url` redirect with `regexSubstitution` to build extension URL
   - Preserve query string using capture group: `chrome-extension://EXTENSION_ID/src/pages/oauth-callback.html?provider=\2\3`

2. **Add Callback Page Logic**:
   - Parse query parameters (code, state, provider)
   - Validate required parameters are present
   - Display appropriate user feedback (success/error)
   - Let `launchWebAuthFlow` detect successful redirect automatically

3. **Update Auth Service**:
   - Extract `provider` from callback URL query parameter
   - Use provider for accurate token exchange endpoint construction
   - Remove hardcoded provider assumptions

### Technical Details

**Why regexFilter + url works**:
- `regexFilter` allows capturing URL components (host, path segments, query string)
- `url` redirect with `regexSubstitution` can reassemble URL with captured groups
- Query string (capture group `\3` in pattern above) includes leading `?` or `&`

**Extension ID Handling**:
- Chrome's `declarativeNetRequest` doesn't support runtime extension ID in rules
- Solution: Use a placeholder pattern or generate rules at build time
- Alternative: Rely on relative redirect if Chrome supports it

**Parameter Validation**:
- Callback page checks for required `code` parameter
- Missing parameters trigger error display
- `error` and `error_description` parameters are handled gracefully

## Alternatives Considered

### Alternative 1: Use transform rules to append query parameters
- **Rejected**: Transform rules cannot access original URL query parameters in declarativeNetRequest
- More complex and less explicit than regexSubstitution

### Alternative 2: Change architecture to avoid declarativeNetRequest
- **Rejected**: Would require backend changes to support chrome-extension:// redirect URIs
- OAuth providers (like Microsoft) don't allow non-https redirect URIs for production

### Alternative 3: Use webRequest API instead of declarativeNetRequest
- **Rejected**: webRequest requires additional permissions and is being deprecated
- Manifest V3 discourages webRequest for performance reasons

### Alternative 4: Custom OAuth server proxy
- **Rejected**: Adds infrastructure complexity
- Defeats purpose of using OpenWebUI's existing OAuth integration

## Success Criteria

1. User completes OAuth login → sees callback page with success message
2. `launchWebAuthFlow` returns complete URL including `code`, `state`, `session_state`, and `provider` query parameters
3. Auth service successfully exchanges authorization code for token
4. Authentication completes without errors
5. Multi-provider setups work correctly (provider parameter used for token exchange)
6. Unit tests reflect actual Chrome behavior (no query params in mocked URLs unless explicitly preserved)
7. E2E tests pass with real OAuth flow including callback redirect

## Open Questions

1. **Extension ID in static rules**: How to handle extension ID in `declarativeNetRequest` rules?
   - Option A: Generate rules at build time with actual extension ID
   - Option B: Use relative URLs if Chrome supports them
   - Option C: Leave placeholder and document manual update process
   
2. **Callback page auto-close**: Should the callback page auto-close after successful parameter extraction?
   - `launchWebAuthFlow` may auto-close when it detects the matching URL
   - Need to verify Chrome behavior

3. **Error recovery**: If OAuth fails with `error` parameter, should callback page:
   - Display error and require manual close?
   - Auto-close after delay?
   - Provide retry button?

## Dependencies

- Chrome Extension Manifest V3 declarativeNetRequest API
- Current OpenWebUI OAuth implementation (no changes required)
- Existing `launchWebAuthFlow` integration in auth service
