# Change: Add OAuth Redirect Interception

## Why
The extension needs to support OAuth providers that require a fixed redirect URI (like Microsoft Entra ID) which points to the backend server. Since the extension cannot change this URI to a chrome-extension:// URL, we need to intercept the callback request to the backend and redirect it to the extension. This allows us to use the native `chrome.identity.launchWebAuthFlow` for a better user experience while still capturing the authorization code.

## What Changes
- **Manifest**: Add `declarativeNetRequest` permission and configuration.
- **Network Interception**: Add a static rule to intercept requests to `*/oauth/*/callback*` and redirect them to `chrome-extension://<id>/src/pages/oauth-callback.html`.
- **Auth Flow**: Replace the custom popup window (`chrome.windows.create`) with `chrome.identity.launchWebAuthFlow`.
- **Token Exchange**: Since the backend callback is intercepted, the session cookie will not be set. The extension MUST manually exchange the captured authorization code for a session token by calling the backend API.

## Impact
- **Affected specs**: `auth`
- **Affected code**: `manifest.config.ts`, `src/auth/service.ts`, `public/rules.json`, new files in `src/pages/`
- **Affected tests**:
  - Unit tests for `AuthService` must mock `chrome.identity.launchWebAuthFlow` instead of `chrome.windows.create`.
  - E2E tests need to handle the new flow. Since `launchWebAuthFlow` is difficult to automate in headless environments, we may need to mock the identity API or use a specific test extension build that bypasses it for E2E.
