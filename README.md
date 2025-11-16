# OpenWebUI Assistant Extension

A Chrome extension that provides seamless integration with OpenWebUI, enabling AI-powered chat capabilities directly in your browser through popup and sidepanel interfaces.

## Features

- **SSO Authentication**: Secure login via Microsoft EntraID (Azure AD)
- **Visual Status Indicator**: Extension icon badge shows authentication status at a glance
- **User Settings**: Configurable theme, language, and instance URL via dedicated options page
- **Theme Support**: Light, dark, and system-auto themes with instant switching
- **Multi-language**: English and French interface support
- **Token Management**: Automatic token storage and validation with session/local storage fallback
- **Dual UI**: Access chat through both popup and sidepanel interfaces
- **Real-time Sync**: Settings and auth state synchronized across all extension contexts
- **OpenWebUI Integration**: Direct API integration with OpenWebUI backend
- **TypeScript**: Full type safety throughout the codebase
- **Modern Stack**: React 19, Vite 7, Chrome Manifest V3

## Quick Status Check

The extension icon displays a small red badge (•) when you're not authenticated. This provides immediate visual feedback about your connection status without needing to open the extension.

**Badge States:**
- **No badge** = Authenticated and connected
- **Red dot (•)** = Not authenticated or invalid token

## Configuration

### User Settings

The extension provides a dedicated settings page accessible via:
- Right-click the extension icon → "Options"
- Chrome extensions page → Extension details → "Extension options"

**Available Settings:**

1. **Theme**: Choose your preferred color scheme
   - Light mode
   - Dark mode
   - System (auto-detects OS preference)

2. **Language**: Select interface language
   - English (en)
   - Français (fr)

3. **OpenWebUI Instance URL**: Configure your OpenWebUI server
   - Enter the full URL (e.g., `https://your-openwebui.com`)
   - Real-time validation with helpful error messages
   - Device-specific (doesn't sync across devices for security)

Settings are automatically saved to:
- `chrome.storage.sync`: Theme and language (syncs across your devices)
- `chrome.storage.local`: Instance URL (device-specific)

### OpenWebUI Base URL

**For End Users:**
1. Right-click extension icon → "Options"
2. Enter your OpenWebUI instance URL in the Connection section
3. Click "Save Changes"

**For Production Builds (CI/CD):**

Set the `DEFAULT_OPENWEBUI_BASE_URL` environment variable before building:

```bash
DEFAULT_OPENWEBUI_BASE_URL=https://your-openwebui.com npm run build
```

This will bake the URL into the extension at build time.

**For Development:**

Create a `.env` file in the project root:

```bash
VITE_OPENWEBUI_BASE_URL=http://localhost:8080
```

**For E2E Testing:**

The test mode automatically uses the mock server - no configuration needed:

```bash
npm run test:e2e  # Automatically uses mock server
```

### Optional: Stabilize Extension ID for Development

By default, Chrome generates a new extension ID each time you load an unpacked extension. For development or testing scenarios where you need a stable ID (e.g., external integrations, consistent debugging URLs), you can provide a fixed public key.

**Generate a Key Pair:**

1. Build the extension first:
   ```bash
   npm run build
   ```

2. Pack the extension to generate a key pair:
   ```bash
   chrome --pack-extension=./dist
   ```
   
   This creates:
   - `dist.pem` - Private key (**never commit this**)
   - `dist.crx` - Packed extension

3. Extract the public key from the `.pem` file:
   ```bash
   openssl rsa -in dist.pem -pubout -outform DER 2>/dev/null | openssl base64 -A
   ```
   
   Copy the output (a long base64 string starting with `MII...`).

**Use the Public Key:**

Set the `EXT_PUBLIC_KEY` environment variable before building:

```bash
export EXT_PUBLIC_KEY="MIIBIjANBgkqhki...your-base64-public-key..."
npm run build
```

The extension will now have a deterministic ID derived from this public key.

**Security & Publishing Notes:**

- ⚠️ **Never commit** the private `.pem` key to version control (already in `.gitignore`)
- The public key is safe to share and can be set in CI/CD environments
- **Remove the key before publishing to Chrome Web Store** - the store assigns its own ID
- This is optional; E2E tests work with or without a fixed key

**When to Use:**
- Need consistent extension URLs for debugging
- External services require hardcoded `chrome-extension://<id>` URLs
- Shared development environments with fixed configurations

**When Not Needed:**
- Default development workflow (Chrome's dynamic ID works fine)
- Publishing to Chrome Web Store (remove the key)
- Most testing scenarios (tests auto-detect the ID)

**For GitHub Actions / CI:**

To use a stable extension ID in CI builds:

1. Generate a key pair locally (steps above)
2. Extract the public key:
   ```bash
   openssl rsa -in dist.pem -pubout -outform DER 2>/dev/null | openssl base64 -A
   ```
3. Add it as a repository secret:
   - Go to GitHub repository → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `EXT_PUBLIC_KEY`
   - Value: Paste the base64 public key
   - Click **Add secret**

The CI workflow will automatically use this secret when building the extension. If the secret is not set, the build works normally with a dynamic ID.

## Authentication Flow

The extension uses OAuth 2.0 flow with Microsoft EntraID:

1. Click "Login" in popup or sidepanel
2. A popup window opens with Microsoft login page
3. Complete authentication with your Microsoft credentials
4. Extension extracts the JWT token from the callback URL
5. Token is validated against OpenWebUI's `/api/v1/auths/` endpoint
6. Auth state is synchronized across all extension contexts

### Token Storage

- **Primary**: `chrome.storage.session` (persists during browser session)
- **Fallback**: `chrome.storage.local` with AES-GCM encryption (persists across sessions)
- Automatic cleanup on logout or token expiration

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open Chrome and navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension from the `dist` directory.

4. Build for production:

```bash
npm run build
```

## Development Environment

### GitHub Codespaces

When opening this project in GitHub Codespaces, you may notice a Vite server automatically starts with `npx vite --port=4000`. This is triggered by Codespaces' auto-detection of web development projects based on the `package.json` file.

**Since this is a browser extension project (not a web app), the Vite dev server is not needed for normal development.**

To disable the automatic Vite server launch:

1. The `.vscode/settings.json` file includes `"task.autoDetect": "off"` to prevent auto-detection
2. If you need to run Vite for development, use `npm run dev` manually
3. You may need to reload the VS Code window after first opening the Codespace for the setting to take effect

**Note:** The extension's development workflow uses `npm run dev` to start the Vite dev server with CRXJS, which then watches for changes and automatically rebuilds the extension. The auto-launched Vite server is redundant and can be safely ignored or disabled.

## Project Structure

```
src/
├── api/               # OpenWebUI API client
│   ├── client.ts      # HTTP client with token injection
│   ├── types.ts       # API request/response types
│   └── index.ts       # Barrel export
├── auth/              # Authentication module
│   ├── service.ts     # AuthService singleton
│   ├── storage.ts     # Token storage with encryption
│   ├── types.ts       # Auth types and interfaces
│   ├── crypto.ts      # Encryption utilities
│   └── retry.ts       # Retry logic with backoff
├── background/        # Service worker
│   └── index.ts       # Background service with message handling
├── components/        # Shared React components
│   └── auth/          # Authentication UI components
│       ├── AuthButton.tsx   # Login/Logout buttons
│       ├── UserProfile.tsx  # User info display
│       └── ErrorDisplay.tsx # Error message display
├── config/            # Configuration management
│   ├── manager.ts     # ConfigManager (delegates to SettingsManager)
│   └── types.ts       # Config types
├── contexts/          # React contexts
│   ├── AuthContext.tsx     # Auth state provider
│   └── SettingsContext.tsx # Settings state provider
├── settings/          # User settings management
│   ├── manager.ts     # SettingsManager singleton
│   ├── types.ts       # Settings types
│   ├── theme.ts       # Theme utilities
│   └── index.ts       # Barrel export
├── popup/             # Extension popup UI
│   ├── App.tsx        # Popup main component
│   ├── main.tsx       # Popup entry point
│   └── index.html     # Popup HTML
├── sidepanel/         # Extension sidepanel UI
│   ├── App.tsx        # Sidepanel main component
│   ├── main.tsx       # Sidepanel entry point
│   └── index.html     # Sidepanel HTML
├── options/           # Extension options page
│   ├── App.tsx        # Settings UI component
│   ├── main.tsx       # Options entry point
│   └── index.html     # Options HTML
├── theme.css          # Global theme CSS variables
│   └── index.html     # Sidepanel HTML
└── content/           # Content scripts (future)
```

## Architecture

### Authentication Module

The authentication system is built as a modular, reusable component:

- **AuthService**: Singleton service managing auth lifecycle
- **TokenStorage**: Secure token persistence with encryption
- **OAuth Flow**: Popup window with URL monitoring for callback detection
- **State Management**: Event-based state changes broadcast to all contexts

### Message Passing

Communication between UI and background service:

```typescript
// From UI to Background
chrome.runtime.sendMessage({ type: 'AUTH_LOGIN' })
chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' })
chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' })
chrome.runtime.sendMessage({ type: 'API_REQUEST', payload: { endpoint, method, body } })

// From Background to UI (broadcast)
chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', payload: authState })
```

### API Integration

The OpenWebUI API client provides typed interfaces:

```typescript
import { createApiClient } from '@/api';

// Create client (retrieves token from storage)
const client = await createApiClient();

// Make API calls
const models = await client.getModels();
const response = await client.chatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Stream responses
for await (const chunk of client.streamChatCompletion(request)) {
  console.log(chunk);
}
```

## Testing

### Unit Tests

Unit tests use Vitest to test isolated business logic and utilities. Unit tests are **fast** (<10s) and focus on pure functions without complex mocking.

**What we unit test:**
- Pure functions (theme resolution, validation, crypto)
- Error handling logic
- Business logic without dependencies

**What we DON'T unit test:**
- React components, contexts (use E2E tests)
- Chrome API integrations (use E2E tests)
- UI flows and rendering (use E2E tests)

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode (for development)
npm run test:unit:watch

# Run tests with coverage report
npm run test:unit:coverage

# Open interactive test UI
npm run test:unit:ui
```

For detailed guidance on when to write unit vs E2E tests, see [Unit Testing Guide](./docs/UNIT_TESTING.md).

### End-to-End Tests

End-to-end tests use Playwright to validate the extension in a real browser environment. The tests cover:
- Extension loading and initialization
- Popup UI functionality
- Sidepanel interaction
- Content script injection
- API mocking and integration
- **Authentication flows with mock OpenWebUI server**
- **Settings persistence and synchronization**
- **Theme switching and validation**

For detailed information about the E2E testing infrastructure, common patterns, and troubleshooting, see [E2E Testing Guide](./docs/E2E_TESTING.md).

#### Running Tests

To run the tests:

```bash
# Run all e2e tests (includes mock server setup)
npm run test:e2e

# Run tests with UI mode
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

#### Authentication E2E Tests

The authentication tests use a mock OpenWebUI server to test OAuth flows without requiring a real backend:

**Test Coverage:**
- **REQ-001: Login Flow** (5 scenarios)
  - Successful OAuth login with token storage
  - OAuth callback with Set-Cookie header
  - Login button states during authentication
  - UI transitions to authenticated state
  - Token persistence in chrome.storage.session

- **REQ-002: Logout Flow** (4 scenarios)
  - Token clearing and UI reset
  - Storage cleanup
  - Logout button states
  - Complete UI state reset

- **REQ-003: Auth Persistence** (4 scenarios)
  - Token persistence across popup sessions
  - Cross-view synchronization (popup ↔ sidepanel)
  - Logout propagation
  - Login propagation

- **REQ-004: Token Synchronization** (3 scenarios)
  - Concurrent login race conditions
  - Storage event propagation
  - Immediate token updates across views

- **REQ-005: Error Handling** (5 scenarios)
  - Network errors during login
  - Invalid token handling (401)
  - Server errors (500)
  - OAuth callback errors
  - Network interruption during logout

- **Token Expiration** (1 scenario)
  - Expired token re-authentication

**Mock Server:**
The mock OpenWebUI server (`test/e2e/utils/mock-server.ts`) provides:
- OAuth login endpoint with auto-redirect HTML
- OAuth callback with Set-Cookie header (correct token flow)
- Token validation endpoint (Bearer + cookie auth)
- Configurable error modes: `none`, `network`, `invalid_token`, `server_error`
- Request logging and inspection
- Dynamic port allocation

**Test Helpers:**
The `AuthTestHelper` class (`test/e2e/utils/auth-helper.ts`) provides:
- `openPopup()` / `openSidepanel()` - Open extension views
- `clickLogin()` / `clickLogout()` - Trigger auth actions
- `waitForAuthComplete()` - Wait for authentication
- `waitForCallbackWithCookie()` - Monitor OAuth callback
- `extractTokenFromCookie()` - Get token from browser cookies
- `getStoredToken()` - Get token from chrome.storage
- `verifyAuthenticatedState()` / `verifyUnauthenticatedState()` - State verification
- `closeExtraWindows()` - Clean up OAuth popups

#### Test Infrastructure

**Headless Chrome with Extension Support:**

The test setup uses `chromium.launchPersistentContext` with `--headless=new` flag to enable extension loading in headless mode. This is critical for CI/CD environments without display servers.

```typescript
// test/e2e/utils/test-utils.ts
const shouldHeadless = Boolean(process.env.CI) || !process.env.DISPLAY;
const headlessArgs = shouldHeadless ? ['--headless=new'] : [];

const context = await chromium.launchPersistentContext(chromeDataDir, {
  headless: shouldHeadless,
  channel: 'chromium',
  ignoreDefaultArgs: [
    '--disable-component-extensions-with-background-pages',
    '--disable-extensions',
  ],
  args: [
    ...headlessArgs,
    '--no-sandbox',
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`,
  ],
});
```

**Extension ID Detection:**

The tests poll for the extension ID from service workers (Manifest V3) or background pages (Manifest V2):

```typescript
const waitForExtensionId = async (timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    // Check service workers (MV3)
    const sw = context.serviceWorkers().find(w => 
      w.url().startsWith('chrome-extension://')
    );
    if (sw) {
      const match = sw.url().match(/^chrome-extension:\/\/([^\/]+)/);
      if (match && match[1]) return match[1];
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return undefined;
};
```

**Test Fixtures:**

Custom fixtures provide `context` (browser) and `extensionId` to all tests:

```typescript
import { test, expect } from './utils/test-utils';

test('my test', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  // ... test code
});
```

#### Writing Tests

Tests are located in `test/e2e/`. Each test file should:
- Import test utilities from `test/e2e/utils/test-utils`
- Use the provided helper classes for common operations
- Follow the existing patterns for consistent test structure

Example test structure:
```typescript
import { test, expect } from './utils/test-utils';
import { AuthTestHelper } from './utils/auth-helper';

test.describe('Feature Tests', () => {
  test('should handle authentication', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const helper = new AuthTestHelper(page, context, extensionId);
    
    await helper.openPopup();
    await helper.clickLogin();
    await helper.waitForAuthComplete();
    await helper.verifyAuthenticatedState();
  });
});
```

#### OAuth Flow Implementation

The extension follows this OAuth flow (corrected from original design):

1. User clicks "Login" → extension opens OAuth URL
2. User authenticates → redirected to `/oauth/microsoft/callback?code=...`
3. **Callback sets `Set-Cookie: token=eyJh...`** (not URL parameter!)
4. Extension extracts token from cookie
5. Extension stores token in `chrome.storage.session`
6. Extension validates token via `/api/v1/auths/` (supports Bearer OR cookie)

**Important:** The token is transmitted via `Set-Cookie` header in the OAuth callback response, NOT as a URL parameter. This matches real OpenWebUI behavior and prevents token exposure in browser history.

## Documentation

- [E2E Testing Guide](./docs/E2E_TESTING.md) - Comprehensive guide to E2E testing infrastructure and patterns
- [Settings Implementation Bugs](./docs/SETTINGS_BUGS.md) - Known issues and fixes for settings feature
- [API Documentation](./docs/API.md) - API client usage and patterns
- [Authentication Hooks](./docs/AUTH_HOOKS.md) - Authentication system documentation
- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Documentation](https://crxjs.dev/vite-plugin)
- [Playwright Documentation](https://playwright.dev/)

## Troubleshooting

### Icon Badge Shows Red Dot

The red badge indicates you're not authenticated or your token is invalid. To resolve:

1. Click the extension icon to open the popup
2. Click "Login" and complete the authentication flow
3. If already logged in, try logging out and back in
4. Verify your OpenWebUI instance URL is configured correctly (right-click icon → Options)

The badge will automatically clear when you successfully authenticate.

### Connection Issues

If you see connection errors:

1. Check the red badge - if present, you need to authenticate
2. Verify your instance URL is correct in Settings (Options page)
3. Ensure the OpenWebUI server is running and accessible
4. Check browser console for detailed error messages

## Chrome Extension Development Notes

- Use `manifest.config.ts` to configure your extension
- The CRXJS plugin automatically handles manifest generation
- Content scripts should be placed in `src/content/`
- Popup UI should be placed in `src/popup/`
