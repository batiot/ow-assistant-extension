# Design: Backend Configuration Endpoint Integration

## Context

The OpenWebUI backend exposes a `/api/config` endpoint that provides runtime configuration including authentication features and available OAuth providers. The extension needs to consume this configuration to adapt its authentication behavior dynamically rather than hardcoding assumptions about available authentication methods.

Current authentication logic assumes Microsoft OAuth is always available, which limits flexibility when backends support multiple providers or different authentication methods.

## Goals / Non-Goals

### Goals
- Fetch backend configuration early (extension init and on URL change)
- Cache configuration to minimize repeated requests
- Make authentication flow conditional on backend capabilities
- Intelligently select authentication entry point to minimize user friction
- Document API contracts clearly for maintainability

### Non-Goals
- Support for authentication methods beyond OAuth and form-based login
- Configuration hot-reloading (only fetch on init/URL change)
- Backward compatibility with backends that don't expose `/api/config` (fail gracefully)
- Configuration UI for overriding backend settings

## Decisions

### 1. Configuration Fetching Strategy

**Decision**: Fetch configuration during background service initialization and whenever base URL changes.

**Rationale**:
- Configuration is relatively static and doesn't need real-time updates
- Fetching on URL change ensures fresh config when user switches backends
- Background worker is persistent and natural place for config management
- Minimizes API calls while keeping config reasonably fresh

**Implementation**:
```typescript
// In background/index.ts
async function initializeServices() {
  const baseUrl = configManager.getOpenWebUIBaseUrl();
  if (baseUrl) {
    // Fetch backend config
    const backendConfig = await fetchBackendConfig(baseUrl);
    
    // Initialize auth only if enabled
    if (backendConfig?.features?.auth) {
      authService = AuthService.getInstance({ 
        baseUrl, 
        backendConfig 
      });
    }
  }
}
```

### 2. Configuration Caching

**Decision**: Store backend config in `ConfigManager` as in-memory cache, not persisted to storage.

**Rationale**:
- Backend config can change server-side, shouldn't persist stale data
- Fetching on each extension startup is acceptable (infrequent operation)
- Avoids complexity of cache invalidation
- Memory cache sufficient for session lifetime

**Alternatives Considered**:
- Persist to chrome.storage.local: Rejected - risk of stale config
- No caching: Rejected - would require passing config through many layers

### 3. Authentication Flow Selection

**Decision**: Use deterministic logic based on provider count and form availability:

```
IF features.auth === false
  → Skip authentication entirely

ELSE IF single provider AND enable_login_form === false
  → Direct to provider OAuth URL (/oauth/{provider}/login)
  → Hide popup if no user interaction needed

ELSE (multiple providers OR login form enabled)
  → Load base URL (/) in popup
  → User selects authentication method
```

**Rationale**:
- Single provider + no form = clear path, minimize friction
- Multiple options = must let user choose
- Login form presence indicates user needs to see that option
- Aligns with standard OAuth UX patterns

### 4. Popup Visibility Logic

**Decision**: Determine authentication strategy BEFORE opening any popup, then conditionally create popup only when user interaction is required.

**Strategy determination order**:
1. Check if authentication is disabled (`features.auth === false`) → No popup
2. Check if user is already authenticated via `/api/v1/auths/` → No popup
3. Analyze provider configuration:
   - Single provider AND no login form → Attempt silent auth first
   - Multiple providers OR login form enabled → Show popup immediately

**Silent authentication attempt**:
- For single provider + no form, open authentication URL in a hidden/background context
- If OAuth provider redirects immediately (no user interaction), complete silently
- If provider requires interaction (login prompt, consent), THEN open visible popup
- Timeout after 2-3 seconds: if not complete, show popup

**Rationale**:
- Prevents popup flashing by making informed decision upfront
- Silent auth only attempted when configuration suggests it's possible
- Fallback to visible popup ensures user is never blocked
- Clean separation between "need to show" vs "might not need to show" cases

**Implementation Note**: Use separate code paths for "definitely show popup" (multiple providers/form) vs "try silent first" (single provider, no form). This avoids the show/hide pattern that causes flashing.

### 5. API Error Handling

**Decision**: Fail gracefully if `/api/config` endpoint unavailable:
- Log warning
- Assume auth is enabled (safe default)
- Use hardcoded Microsoft provider as fallback
- Continue with existing authentication flow

**Rationale**:
- Backward compatibility with older backends
- Extension remains functional even if endpoint missing
- Explicit logging helps debugging

### 6. Type Safety

**Decision**: Define strict TypeScript interfaces for backend config:

```typescript
interface BackendConfig {
  oauth: {
    providers: Record<string, string>;  // e.g., { "microsoft": "microsoft" }
  };
  features: {
    auth: boolean;
    enable_login_form: boolean;
  };
}
```

**Rationale**:
- Clear contract for backend API
- Type safety prevents runtime errors
- Self-documenting code

## Data Flow

```
Extension Startup / URL Change
  ↓
Background Worker: Fetch /api/config
  ↓
ConfigManager: Cache config in memory
  ↓
IF features.auth === true
  ↓
  AuthService.initialize(config)
    ↓
    Check /api/v1/auths/ (authenticated?)
      ↓
      IF authenticated → Done
      ↓
      IF not authenticated → Determine auth flow
        ↓
        Single provider + no form
          → Open /oauth/{provider}/login
          → Hide popup if silent
        ↓
        Multiple providers OR form
          → Open base URL (/)
          → Show popup
```

## Risks / Trade-offs

### Risk: Backend config endpoint unavailable
**Mitigation**: Graceful fallback to current behavior (Microsoft OAuth assumed)

### Risk: Configuration format changes server-side
**Mitigation**: Validate response shape, log warnings on unexpected structure

### Risk: Race condition between config fetch and auth initialization
**Mitigation**: Make config fetch synchronous prerequisite for auth initialization

### Trade-off: Additional API call on startup
**Impact**: ~50-200ms added to initialization
**Justification**: Necessary for correct behavior, acceptable overhead

## Migration Plan

### Phase 1: Add Configuration Fetching
1. Add `/api/config` endpoint method to `OpenWebUIClient`
2. Add types for `BackendConfig`
3. Update `ConfigManager` with config caching
4. Fetch config in background worker initialization

### Phase 2: Update Authentication Flow
1. Modify `AuthService.initialize()` to accept backend config
2. Implement provider selection logic
3. Update popup visibility logic
4. Add logging for debugging flow selection

### Phase 3: Documentation
1. Create/update `docs/API.md` with endpoint documentation
2. Add JSDoc comments to new methods
3. Update README if user-facing behavior changes

### Rollback Plan
If issues arise, revert to hardcoded Microsoft OAuth by:
1. Skipping `/api/config` fetch
2. Passing `null` for backend config
3. Using existing default flow

No data migration needed (no persistent storage changes).

## Open Questions

None - design is sufficiently specified for implementation.
