# Design: Silent Authentication Implementation

## Context

The authentication service currently always creates a visible popup window when `login()` is called, even in scenarios where the user might already be authenticated or where silent authentication could succeed. This was intentionally deferred during the `add-backend-config-endpoint` change, with a TODO comment documenting the intended enhancement.

Current flow:
```
login() → determineAuthEntryPoint() → create visible popup → wait for callback
```

The backend configuration system (from `add-backend-config-endpoint`) provides the information needed to make intelligent decisions about when silent auth might succeed:
- Single OAuth provider + no login form = good candidate for silent auth
- Multiple providers or login form = must show UI for user selection

## Goals / Non-Goals

### Goals
- Attempt silent authentication before showing popup when conditions suggest it might succeed
- Avoid popup flashing by making decision before any window creation
- Provide seamless re-authentication for users with existing OAuth sessions
- Maintain backward compatibility with existing authentication flows
- Fail gracefully to visible popup when silent auth times out or requires interaction

### Non-Goals
- Implement silent auth for all authentication scenarios (only single provider + no form)
- Cache authentication results across extension restarts (rely on stored tokens)
- Support silent auth for non-OAuth authentication methods
- Implement custom timeout values (use fixed 2-3 second timeout)

## Decisions

### 1. When to Attempt Silent Auth

**Decision**: Attempt silent authentication ONLY when all these conditions are met:
1. Backend config indicates single OAuth provider
2. `enable_login_form === false`
3. User is not currently authenticated (checked via existing token validity)

**Rationale**:
- Single provider + no form = clear authentication path with no user choices needed
- Multiple providers or form = user must make a selection, can't be silent
- Already authenticated = skip auth entirely (handled by existing token check)
- This matches the strategy outlined in the original `add-backend-config-endpoint` design

**Implementation**:
```typescript
private shouldAttemptSilentAuth(): boolean {
  const backendConfig = this.config.backendConfig;
  if (!backendConfig) return false;
  
  const providers = Object.keys(backendConfig.oauth.providers);
  const hasForm = backendConfig.features.enable_login_form;
  
  return providers.length === 1 && !hasForm;
}
```

### 2. Silent Auth Mechanism

**Decision**: Use Chrome's offscreen documents API or hidden iframe approach:

**Option A - Offscreen Document** (Preferred for Manifest V3):
- Create offscreen document with the auth URL
- Monitor for callback URL or timeout
- More secure, better supported in MV3

**Option B - Hidden Tab** (Fallback):
- Create a tab with `active: false`
- Monitor tab URL changes for callback
- Close tab on completion or timeout

**Rationale**:
- Offscreen documents are the recommended MV3 approach for background work
- Provides better isolation than hidden tabs
- Falls back gracefully if offscreen API unavailable
- No visual flashing or interruption to user workflow

**Implementation Note**: Chrome's offscreen document API might not support full navigation, so hidden tab approach may be more reliable for OAuth flows.

### 3. Timeout Handling

**Decision**: Implement 2.5 second timeout for silent auth attempts.

**Rationale**:
- OAuth redirects that work silently typically complete in < 1 second
- 2-3 second range provides buffer for network latency
- Longer timeouts defeat the purpose (user waiting with no feedback)
- On timeout, cleanly transition to visible popup

**Implementation**:
```typescript
const SILENT_AUTH_TIMEOUT_MS = 2500;

async attemptSilentAuth(authUrl: string): Promise<AuthToken | null> {
  return Promise.race([
    this.performSilentAuth(authUrl),
    new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), SILENT_AUTH_TIMEOUT_MS)
    )
  ]);
}
```

### 4. Flow Architecture

**Decision**: Refactor `login()` into a multi-stage flow with clear decision points:

```
login()
  ↓
Check if already authenticated (existing logic)
  ↓ [not authenticated]
Determine auth entry point (existing: determineAuthEntryPoint())
  ↓
Should attempt silent auth? (new: shouldAttemptSilentAuth())
  ↓ [yes - single provider, no form]
  |
  Attempt silent authentication (new: attemptSilentAuth())
    ↓
    Success → Store token, update state, done
    ↓
    Timeout/Failure → Continue to visible popup
  |
  ↓ [no - multiple providers or form]
  |
Create visible popup (existing logic)
  ↓
Wait for callback (existing logic)
  ↓
Store token, update state, done
```

**Rationale**:
- Clear separation between "try silent" and "show popup" paths
- No show/hide flickering - decision made before any UI creation
- Each path is independently testable
- Maintains existing popup logic for complex scenarios

### 5. Error Handling

**Decision**: Treat all silent auth failures as "fallback to popup" scenarios:

| Scenario | Handling |
|----------|----------|
| Silent auth timeout | Log timeout, show visible popup |
| Silent auth network error | Log error, show visible popup |
| OAuth requires interaction | Detected as timeout, show popup |
| Offscreen API unavailable | Log warning, show visible popup immediately |

**Rationale**:
- Silent auth is an optimization, not a requirement
- Visible popup is the reliable fallback
- User always gets authenticated, even if not silently
- Errors in silent auth should not block user workflow

### 6. Logging and Observability

**Decision**: Add detailed logging for silent auth attempts:

```typescript
console.log('[Auth] Attempting silent authentication for provider:', providerName);
// ... attempt ...
if (success) {
  console.log('[Auth] Silent authentication succeeded');
} else {
  console.log('[Auth] Silent authentication timed out, showing popup');
}
```

**Rationale**:
- Silent auth is invisible to user, logging crucial for debugging
- Helps understand success rates and timeout behavior
- Enables monitoring in production without user reports

## Data Flow

```
User triggers login()
  ↓
Check current auth state
  ↓ [unauthenticated]
Get backend config from this.config.backendConfig
  ↓
Determine auth entry point URL
  ↓
Evaluate: shouldAttemptSilentAuth()
  ├─ Single provider + no form
  │   ↓
  │   Create hidden tab with auth URL
  │   ↓
  │   Race: Auth callback vs. 2.5s timeout
  │   ↓
  │   Success → Extract token from cookie
  │            → Validate token
  │            → Store & update auth state
  │            → Close hidden tab
  │            → Return
  │   ↓
  │   Timeout → Log timeout
  │            → Close hidden tab
  │            → Fall through to popup
  │
  └─ Multiple providers OR form
      ↓
      (Skip silent auth)
      ↓
Create visible popup window with auth URL
  ↓
Wait for auth callback in popup
  ↓
Extract token, validate, store
  ↓
Close popup window
  ↓
Return
```

## Implementation Details

### Silent Auth with Hidden Tab

```typescript
private async attemptSilentAuth(authUrl: string): Promise<AuthToken | null> {
  console.log('[Auth] Attempting silent authentication');
  
  let hiddenTab: chrome.tabs.Tab | undefined;
  
  try {
    // Create hidden tab (active: false means not shown)
    hiddenTab = await chrome.tabs.create({
      url: authUrl,
      active: false,
    });
    
    if (!hiddenTab || !hiddenTab.id) {
      console.warn('[Auth] Failed to create hidden tab');
      return null;
    }
    
    // Race between callback and timeout
    const result = await Promise.race([
      this.waitForAuthCallback(hiddenTab.id, true), // true = silent mode
      new Promise<null>((resolve) => 
        setTimeout(() => {
          console.log('[Auth] Silent auth timeout');
          resolve(null);
        }, SILENT_AUTH_TIMEOUT_MS)
      ),
    ]);
    
    return result;
    
  } catch (error) {
    console.warn('[Auth] Silent auth error:', error);
    return null;
  } finally {
    // Always clean up hidden tab
    if (hiddenTab?.id) {
      try {
        await chrome.tabs.remove(hiddenTab.id);
      } catch (e) {
        // Tab might already be closed
      }
    }
  }
}
```

### Modified Login Method

```typescript
async login(): Promise<void> {
  try {
    // Determine auth URL based on backend config
    const authUrl = this.determineAuthEntryPoint();
    
    // Try silent auth if appropriate
    if (this.shouldAttemptSilentAuth()) {
      const token = await this.attemptSilentAuth(authUrl);
      
      if (token) {
        // Silent auth succeeded!
        const user = await this.validateToken(token.token);
        await TokenStorage.saveToken(token);
        
        this.updateAuthState({
          isAuthenticated: true,
          token,
          user,
        });
        
        console.log('[Auth] Silent authentication succeeded');
        return; // Done, no popup needed
      }
      
      // Silent auth timed out, fall through to visible popup
      console.log('[Auth] Silent auth timed out, showing popup');
    }
    
    // Show visible popup (existing logic)
    const authWindow = await chrome.windows.create({
      url: authUrl,
      type: 'popup',
      width: 500,
      height: 700,
    });
    
    // ... rest of existing popup logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

## Risks / Trade-offs

### Risk: Silent auth increases latency when it fails
**Impact**: User waits 2.5 seconds before seeing popup
**Mitigation**: Only attempt silent auth in scenarios likely to succeed (single provider, no form)

### Risk: Hidden tabs might still be visible in some Chrome UI
**Impact**: User might see tab flash in tab strip
**Mitigation**: 
- Use `active: false` to minimize visibility
- Consider offscreen document API if available
- Document behavior for users

### Risk: OAuth provider blocking background authentication
**Impact**: Silent auth always times out for some providers
**Mitigation**: 
- Graceful fallback to popup always works
- Logging helps identify problematic providers
- Consider allowlist/blocklist if needed

### Trade-off: Added complexity vs. improved UX
**Justification**: 
- Silent auth significantly improves UX in common scenarios
- Code complexity is manageable (< 100 lines)
- Clear fallback path reduces risk

## Testing Strategy

### Unit Tests
- `shouldAttemptSilentAuth()` logic for all backend config combinations
- Timeout behavior in `attemptSilentAuth()`
- Error handling when hidden tab creation fails

### Integration Tests
- Silent auth success path (mock instant callback)
- Silent auth timeout path
- Fallback to popup after silent auth failure

### E2E Tests (with mock OAuth provider)
- E2E test with instant redirect (silent auth succeeds)
- E2E test with delayed redirect (silent auth times out, popup appears)
- E2E test with interactive provider (requires user input, popup appears)

### Manual Testing
- Test with real OAuth provider that auto-approves
- Test with real OAuth provider that requires consent
- Verify no tab flashing in various Chrome versions

## Open Questions

None - design is ready for implementation.
