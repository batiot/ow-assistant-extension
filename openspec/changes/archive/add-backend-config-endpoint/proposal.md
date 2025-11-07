# Change: Add Backend Configuration Endpoint Integration

## Why

The extension currently uses hardcoded authentication logic that assumes a single OAuth provider (Microsoft) and doesn't adapt to different OpenWebUI backend configurations. This creates inflexibility when:
- OpenWebUI instances support multiple authentication methods (OAuth providers, login forms)
- Authentication may be disabled entirely on some instances
- The extension needs to present the appropriate login UI based on backend capabilities

By reading the backend's `/api/config` endpoint, the extension can dynamically adapt its authentication flow to match the backend's actual configuration, improving compatibility and user experience.

## What Changes

- **NEW**: Fetch backend configuration from `/api/config` endpoint containing OAuth providers and authentication features
- **NEW**: Configuration fetching triggered on extension initialization (if base URL exists) and when base URL changes
- **MODIFIED**: Authentication initialization becomes conditional based on `features.auth` flag from backend config
- **MODIFIED**: Authentication flow selects appropriate entry point based on:
  - Multiple OAuth providers → show base URL (/) in popup to let user choose
  - Single OAuth provider + no login form → directly load provider-specific OAuth URL (e.g., `/oauth/microsoft/login`)
  - Login form enabled → show base URL (/) in popup
- **MODIFIED**: Popup visibility logic - hide if single OAuth provider with no user interaction required
- **NEW**: Document `/api/config` response format and `/api/v1/auths/` authentication check in API documentation

## Impact

### Affected Specs
- **openwebui-integration**: Add backend configuration fetching requirements
- **auth**: Modify authentication flow to be config-driven with smart provider selection

### Affected Code
- `src/api/client.ts` - Add `getBackendConfig()` method
- `src/api/types.ts` - Add `BackendConfig` and related types
- `src/config/manager.ts` - Add config caching and retrieval logic
- `src/background/index.ts` - Fetch config on init and URL change, pass to AuthService
- `src/auth/service.ts` - Update `initialize()` to accept backend config, implement conditional auth and smart popup logic
- `src/auth/types.ts` - Add backend config types
- New: `docs/API.md` - Document backend API endpoints with request/response examples

### Breaking Changes
None - this is additive functionality that enhances existing authentication logic.
