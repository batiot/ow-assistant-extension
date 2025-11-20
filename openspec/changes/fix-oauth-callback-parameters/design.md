# Design: OAuth Callback Query Parameter Preservation

## Architecture Overview

### Current Flow (Broken)

```
User → OAuth Provider → Backend Callback URL
                            ↓
                    declarativeNetRequest intercepts
                            ↓
                    extensionPath redirect (loses query params)
                            ↓
                    chrome-extension://.../oauth-callback.html
                            ↓
                    launchWebAuthFlow returns URL without code
                            ↓
                    Auth fails (no authorization code)
```

### Proposed Flow (Fixed)

```
User → OAuth Provider → Backend Callback URL with params
                            ↓
                    declarativeNetRequest intercepts
                            ↓
                    regexFilter captures provider + params
                            ↓
                    url redirect with regexSubstitution
                            ↓
                    chrome-extension://.../oauth-callback.html?provider=X&code=Y&state=Z
                            ↓
                    Callback page validates params + shows UI
                            ↓
                    launchWebAuthFlow returns complete URL
                            ↓
                    Auth service extracts code + provider
                            ↓
                    Token exchange succeeds
```

## Component Design

### 1. DeclarativeNetRequest Rule

**File**: `public/rules.json`

**Current Implementation** (broken):
```json
{
  "action": {
    "type": "redirect",
    "redirect": {
      "extensionPath": "/src/pages/oauth-callback.html"
    }
  },
  "condition": {
    "urlFilter": "*/oauth/*/callback*"
  }
}
```

**Problems**:
- `extensionPath` doesn't preserve query parameters
- `urlFilter` cannot capture URL segments
- No way to extract provider name

**Proposed Implementation**:
```json
{
  "action": {
    "type": "redirect",
    "redirect": {
      "regexSubstitution": "chrome-extension://EXTENSION_ID/src/pages/oauth-callback.html?provider=\\2\\3"
    }
  },
  "condition": {
    "regexFilter": "^(https?://[^/]+)/oauth/([^/]+)/callback(.*)$",
    "resourceTypes": ["main_frame"]
  }
}
```

**Regex Breakdown**:
- `^(https?://[^/]+)` - Capture group 1: Protocol and host (e.g., `http://localhost:8080`)
- `/oauth/` - Literal path segment
- `([^/]+)` - Capture group 2: Provider name (e.g., `microsoft`, `google`)
- `/callback` - Literal path segment  
- `(.*)$` - Capture group 3: Everything after `/callback` including `?code=...&state=...`

**Substitution**:
- `chrome-extension://EXTENSION_ID/src/pages/oauth-callback.html` - Target page
- `?provider=\\2` - Add provider as query param using capture group 2
- `\\3` - Append original query string from capture group 3

**Result**:
```
Original: http://localhost:8080/oauth/microsoft/callback?code=ABC&state=XYZ
Result:   chrome-extension://EXTENSION_ID/src/pages/oauth-callback.html?provider=microsoft&code=ABC&state=XYZ
```

### 2. OAuth Callback Page

**File**: `src/pages/oauth-callback.html`

**Current State**: Static HTML with loading message

**Proposed Enhancement**: Add inline JavaScript for:

**Responsibilities**:
1. Parse and validate query parameters
2. Display appropriate UI based on state (success/error)
3. Signal completion to `launchWebAuthFlow` (implicit)
4. Handle error scenarios

**Implementation**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Callback</title>
  <style>/* ... existing styles ... */</style>
</head>
<body>
  <div class="container">
    <div id="status">
      <h2>Authenticating...</h2>
      <p>Processing authentication response...</p>
    </div>
  </div>
  
  <script>
    // Parse query parameters
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const provider = params.get('provider');
    
    const statusEl = document.getElementById('status');
    
    if (error) {
      // OAuth error from provider
      statusEl.innerHTML = `
        <h2>Authentication Failed</h2>
        <p>${errorDescription || error}</p>
        <p class="hint">You can close this window.</p>
      `;
    } else if (!code) {
      // Missing authorization code
      statusEl.innerHTML = `
        <h2>Authentication Error</h2>
        <p>No authorization code received.</p>
        <p class="hint">Please try again.</p>
      `;
    } else {
      // Success - code present
      statusEl.innerHTML = `
        <h2>Authentication Successful</h2>
        <p>Completing sign-in...</p>
        <p class="hint">This window will close automatically.</p>
      `;
    }
    
    // Log for debugging (remove in production)
    console.log('[OAuth Callback]', {
      code: code ? 'present' : 'missing',
      provider,
      error,
      hasState: params.has('state')
    });
  </script>
</body>
</html>
```

**Why This Works**:
- `launchWebAuthFlow` monitors the popup window for URL changes
- When a URL matching the extension's pattern appears, it captures it
- The API automatically closes the window and returns the complete URL
- Our script just needs to provide user feedback during the brief moment the page is visible

### 3. Auth Service Updates

**File**: `src/auth/service.ts`

**Current Code** (problematic):
```typescript
private async exchangeCodeForToken(code: string, state: string | null): Promise<AuthToken> {
  // Hardcoded provider assumption
  let provider = 'microsoft';
  
  // Complex logic trying to guess provider from config
  // ...
}
```

**Proposed Changes**:
```typescript
async login(): Promise<void> {
  // ... existing code ...
  
  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  
  const url = new URL(redirectUrl);
  const code = url.searchParams.get('code');
  const provider = url.searchParams.get('provider'); // NEW: Extract from URL
  const state = url.searchParams.get('state');
  
  // ... validation ...
  
  const token = await this.exchangeCodeForToken(code, state, provider); // Pass provider
}

private async exchangeCodeForToken(
  code: string, 
  state: string | null, 
  provider: string // NEW: Required parameter
): Promise<AuthToken> {
  // No more guessing - use the provider from URL
  const callbackUrl = `${this.config.baseUrl}/oauth/${provider}/callback?code=${code}&state=${state || ''}`;
  // ... rest of implementation ...
}
```

## Extension ID Challenge

### Problem

Chrome's `declarativeNetRequest` rules are static JSON files loaded at extension startup. They cannot:
- Access runtime extension ID
- Use template variables
- Execute JavaScript

But we need the extension ID in the `regexSubstitution` pattern:
```
chrome-extension://EXTENSION_ID/src/pages/oauth-callback.html?provider=\\2\\3
```

### Solutions

#### Option 1: Build-Time Generation (Recommended)

Generate `public/rules.json` during the build process with the actual extension ID.

**Implementation**:
1. Add build script to read extension ID from manifest or environment
2. Generate `rules.json` with substituted ID
3. Use `.gitignore` to exclude generated file

**Vite Plugin Approach**:
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    crx({ manifest: manifestConfig }),
    {
      name: 'generate-dnr-rules',
      buildStart() {
        const extensionId = process.env.EXT_ID || 'DEV_EXTENSION_ID';
        const rules = [{
          id: 1,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: `chrome-extension://${extensionId}/src/pages/oauth-callback.html?provider=\\\\2\\\\3`
            }
          },
          condition: {
            regexFilter: "^(https?://[^/]+)/oauth/([^/]+)/callback(.*)$",
            resourceTypes: ["main_frame"]
          }
        }];
        
        fs.writeFileSync(
          'public/rules.json',
          JSON.stringify(rules, null, 2)
        );
      }
    }
  ]
});
```

**Pros**:
- Clean, automated solution
- Works with any extension ID
- No manual intervention required

**Cons**:
- Adds build complexity
- Different rules for dev vs production

#### Option 2: Use Relative Path (If Supported)

Chrome might support relative extension URLs in declarativeNetRequest.

**Pattern**:
```json
{
  "regexSubstitution": "/src/pages/oauth-callback.html?provider=\\2\\3"
}
```

**Verification Needed**: Test if Chrome automatically resolves relative paths to `chrome-extension://` URLs.

**Pros**:
- Simple, no build-time generation
- Works for any extension ID

**Cons**:
- May not be supported by Chrome
- Need to verify in documentation/testing

#### Option 3: Placeholder with Documentation

Keep a placeholder ID in the static file with clear documentation.

```json
{
  "regexSubstitution": "chrome-extension://YOUR_EXTENSION_ID_HERE/src/pages/oauth-callback.html?provider=\\2\\3"
}
```

**Pros**:
- Simple initial implementation
- Clear what needs to be configured

**Cons**:
- Manual step required
- Error-prone
- Breaks on extension updates

### Recommended Approach

**Phase 1** (Initial Implementation):
- Use Option 1 (build-time generation) for development
- Document the process clearly

**Phase 2** (Optimization):
- Test Option 2 (relative path)
- If Chrome supports it, simplify to relative paths

## Data Flow

### Successful Authentication

```
1. User clicks "Login"
   ↓
2. AuthService.login() calls launchWebAuthFlow
   URL: http://localhost:8080/oauth/microsoft/login
   ↓
3. User authenticates with Microsoft
   ↓
4. Microsoft redirects to:
   http://localhost:8080/oauth/microsoft/callback?code=ABC&state=XYZ
   ↓
5. declarativeNetRequest intercepts (before page loads)
   Regex matches: 
     Group 1: http://localhost:8080
     Group 2: microsoft
     Group 3: ?code=ABC&state=XYZ
   ↓
6. Redirect to:
   chrome-extension://ID/src/pages/oauth-callback.html?provider=microsoft&code=ABC&state=XYZ
   ↓
7. Callback page loads:
   - Parses params: {provider: 'microsoft', code: 'ABC', state: 'XYZ'}
   - Validates code exists
   - Shows success message
   ↓
8. launchWebAuthFlow detects extension URL
   - Captures complete URL with params
   - Closes popup window
   - Returns URL to AuthService
   ↓
9. AuthService receives:
   "chrome-extension://ID/src/pages/oauth-callback.html?provider=microsoft&code=ABC&state=XYZ"
   ↓
10. AuthService extracts:
    code = 'ABC'
    provider = 'microsoft'
    state = 'XYZ'
   ↓
11. AuthService calls exchangeCodeForToken:
    POST http://localhost:8080/oauth/microsoft/callback?code=ABC&state=XYZ
   ↓
12. Backend sets session cookie and returns token
   ↓
13. AuthService stores token → User authenticated ✓
```

### Error Scenarios

**Scenario 1: User Cancels**
```
launchWebAuthFlow throws error
→ AuthService catches and throws AuthError(USER_CANCELLED)
→ UI shows "Authentication cancelled"
```

**Scenario 2: OAuth Provider Error**
```
Provider redirects with: ?error=access_denied&error_description=...
→ declarativeNetRequest preserves error params
→ Callback page shows error message
→ launchWebAuthFlow returns URL
→ AuthService parses error and throws AuthError
```

**Scenario 3: Missing Code**
```
Callback called without code parameter (configuration error)
→ Callback page shows "No authorization code" message
→ launchWebAuthFlow returns URL
→ AuthService validates and throws AuthError(AUTHENTICATION_FAILED)
```

## Security Considerations

### Query Parameters in Extension URL

**Concern**: Authorization code visible in extension URL

**Mitigation**:
- Authorization codes are single-use and expire quickly (typically 10 minutes)
- Extension URLs are not shared or logged externally
- Code is immediately exchanged for token and not stored
- Chrome doesn't persist extension popup history

**Risk**: LOW - Standard OAuth practice, matches web app behavior

### Token Exchange

**Concern**: Replay attacks if code is intercepted

**Mitigation**:
- HTTPS required for backend communication (enforced by manifest)
- State parameter validated by backend
- Code is single-use only
- Session cookie has HTTP-only flag

### Cross-Origin Considerations

**Concern**: Callback page loaded from extension origin

**Mitigation**:
- No cross-origin requests from callback page
- Page only parses URL and displays UI
- No data sent to external origins
- CSP headers restrict script execution

## Performance Considerations

### Redirect Performance

- `declarativeNetRequest` operates at network layer (fast)
- Regex evaluation is O(n) where n = URL length (negligible)
- No additional network hops (redirect is local)

**Impact**: < 10ms additional latency

### Callback Page Load

- Minimal HTML/CSS/JS (< 5KB)
- Inline resources (no external loads)
- Single-pass parameter parsing

**Impact**: < 50ms page render time

### Memory Footprint

- Callback page exists briefly (< 2 seconds)
- Automatically closed by `launchWebAuthFlow`
- No persistent state or listeners

**Impact**: Negligible memory overhead

## Testing Strategy

### Unit Tests

**Mocks to Update**:
```typescript
// Before (incorrect mock)
mockIdentity.launchWebAuthFlow.mockResolvedValue(
  'chrome-extension://id/oauth-callback.html?code=ABC'  // ❌ Unrealistic
);

// After (realistic mock)
mockIdentity.launchWebAuthFlow.mockResolvedValue(
  'chrome-extension://id/src/pages/oauth-callback.html?provider=microsoft&code=ABC&state=XYZ'
);
```

**New Test Cases**:
- Extract provider from callback URL
- Handle missing provider parameter
- Parse multiple query parameters correctly
- Validate provider name format

### Integration Tests

**Callback Page Tests**:
- Load page with valid parameters → shows success
- Load page with error parameter → shows error
- Load page without code → shows error
- Validate DOM updates correctly

### E2E Tests

**OAuth Flow Test**:
1. Mock OAuth provider response
2. Verify redirect preserves parameters
3. Check callback page renders
4. Confirm `launchWebAuthFlow` returns complete URL
5. Validate token exchange uses correct provider

## Migration Path

### Phase 1: Fix Parameter Preservation
- Update `public/rules.json` with regex pattern
- Add build-time ID substitution
- Update unit test mocks

### Phase 2: Enhance Callback Page
- Add parameter validation script
- Improve error messaging
- Add visual feedback

### Phase 3: Update Auth Service
- Extract provider from URL
- Remove hardcoded provider logic
- Update token exchange signature

### Phase 4: Testing & Validation
- Run full test suite
- Manual testing with real OAuth
- Verify multi-provider scenarios

### Rollback Plan

If issues arise:
1. Revert `public/rules.json` to simple `extensionPath`
2. Keep callback page enhancements (backward compatible)
3. Revert auth service provider extraction
4. Document remaining issues for future fix

## Open Issues

1. **Extension ID Resolution**: Which approach to use?
   - Need to test if relative paths work
   - Or commit to build-time generation

2. **Callback Page Auto-Close**: 
   - Does `launchWebAuthFlow` close window automatically?
   - How long is callback page visible?
   - Should we add explicit close logic?

3. **Error Display Duration**:
   - For error states, should page stay open?
   - Add manual close button?
   - Auto-close after timeout?

4. **Multi-Provider Support**:
   - Current implementation assumes provider in URL path
   - What if backend URL structure changes?
   - Need fallback logic?
