# Configuration Changes for Mock Server and Production URLs

## Changes Made

### 1. Updated `vite.config.ts`

Added support for environment-based configuration:

- **Test mode**: Automatically uses `MOCK_SERVER_URL` (set by global setup)
- **Production mode**: Uses `DEFAULT_OPENWEBUI_BASE_URL` from CI/CD variables
- **Development mode**: Uses `VITE_OPENWEBUI_BASE_URL` from `.env` file or empty string

### 2. Updated `src/config/types.ts`

Modified `DEFAULT_CONFIG` to use the injected environment variable:

```typescript
export const DEFAULT_CONFIG: ExtensionConfig = {
  openWebUIBaseUrl: import.meta.env.VITE_OPENWEBUI_BASE_URL || '',
};
```

This ensures:
- E2E tests automatically connect to the mock server
- Production builds can have a default URL baked in
- Development can use local OpenWebUI instances

### 3. Updated `README.md`

Added comprehensive configuration documentation explaining:
- How end users can configure the URL (via Settings UI)
- How to set the default URL for production builds (CI/CD)
- How to configure for development (`.env` file)
- How E2E testing works automatically (mock server)

## How It Works

### Test Mode (`npm run test:e2e`)

1. Global setup starts mock server on random port
2. Sets `process.env.MOCK_SERVER_URL` to mock server URL
3. Vite build (test mode) injects this URL into `import.meta.env.VITE_OPENWEBUI_BASE_URL`
4. Extension initializes with mock server URL
5. Auth tests can now run successfully ✅

### Production Mode (`npm run build`)

1. CI/CD sets `DEFAULT_OPENWEBUI_BASE_URL=https://production-openwebui.com`
2. Vite build injects this URL into `import.meta.env.VITE_OPENWEBUI_BASE_URL`
3. Extension initializes with production URL
4. Users can still override via settings if needed

### Development Mode (`npm run dev`)

1. Developer creates `.env` with `VITE_OPENWEBUI_BASE_URL=http://localhost:8080`
2. Vite reads `.env` and injects the URL
3. Extension connects to local OpenWebUI instance

## Environment Variable Priority

```
Test Mode:
  MOCK_SERVER_URL (from global-setup.ts)

Production Mode:
  1. DEFAULT_OPENWEBUI_BASE_URL (CI/CD variable)
  2. VITE_OPENWEBUI_BASE_URL (.env file)
  3. '' (empty, requires user configuration)

Development Mode:
  1. VITE_OPENWEBUI_BASE_URL (.env file)
  2. '' (empty, requires user configuration)
```

## Testing

The configuration now allows the auth E2E tests to run properly because:

1. ✅ Mock server starts automatically (global setup)
2. ✅ Mock server URL is injected into the build
3. ✅ Extension initializes `AuthService` with mock server URL
4. ✅ Login/logout flows work with the mock server
5. ✅ Tests can validate the complete authentication flow

## CI/CD Integration

For GitHub Actions or other CI/CD platforms, set the build environment variable:

```yaml
# .github/workflows/build.yml
- name: Build Extension
  env:
    DEFAULT_OPENWEBUI_BASE_URL: ${{ secrets.OPENWEBUI_BASE_URL }}
  run: npm run build
```

## Notes

- The URL is baked in at build time, not runtime
- Users can still override it via chrome.storage.local
- Empty string is a valid default (requires user configuration)
- Test mode always uses mock server regardless of other variables
