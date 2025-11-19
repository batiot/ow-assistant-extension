# Change: Fix Logout Re-Authentication from Browser Session Cookies

## Why

The current logout implementation **correctly** calls the backend `/api/v1/auths/signout` endpoint (which clears cookies via `Set-Cookie` with `Max-Age=0`) and clears tokens from extension storage. However, **logout appears ineffective** because the extension automatically re-authenticates immediately after logout.

### Root Cause: Cookie Context Isolation

The issue stems from how Chrome extensions interact with browser cookies:

1. **`chrome.identity.launchWebAuthFlow` uses an isolated web view** that doesn't share cookies with the main browser profile
2. **`chrome.cookies.get()` reads from the MAIN browser profile**, not the isolated OAuth flow context
3. **When a user has OpenWebUI open in a regular browser tab**, that session's cookie persists in the main browser profile
4. **After logout**, the extension's `initialize()` method runs and calls `checkSessionAuth()`
5. **`checkSessionAuth()` uses `chrome.cookies.get()`** to read the `token` cookie from the main browser profile
6. **If the cookie exists** (from the open browser tab), the extension automatically re-authenticates using that session
7. **Result**: User clicks logout, but immediately gets logged back in

### Example Scenario

1. User opens `http://localhost:8080` in Chrome tab → Logs in → Cookie set in main browser profile
2. User opens extension popup → Extension calls `checkSessionAuth()` → Reads cookie from main browser → Auto-authenticates
3. User clicks "Logout" in extension → Backend signout called → Extension storage cleared
4. Extension re-initializes → Calls `checkSessionAuth()` → **Still finds cookie from browser tab** → Auto-authenticates again
5. User is confused: "I clicked logout but I'm still logged in!"

### What Currently Works

- ✅ Backend `/api/v1/auths/signout` clears cookies correctly (`Set-Cookie: token=""; Max-Age=0`)
- ✅ Extension storage (`chrome.storage.session` and `chrome.storage.local`) is cleared
- ✅ Auth state is reset to unauthenticated

### What Doesn't Work

- ❌ Extension doesn't clear the cookie from the main browser profile via `chrome.cookies.remove()`
- ❌ On re-initialization, extension detects the browser session cookie and re-authenticates automatically
- ❌ Logout appears to have no effect from the user's perspective

## What Changes

- Modify `AuthService.logout()` to explicitly remove the `token` cookie from the main browser profile using `chrome.cookies.remove()`
- This ensures that even if the user has OpenWebUI open in a browser tab, the extension won't re-authenticate from that session after logout
- The browser tab's session will remain active (as expected), but the extension will be fully logged out

## Impact

- **Affected specs**: `auth` (Server-Side Logout requirement)
- **Affected code**: 
  - `src/auth/service.ts` - Add `chrome.cookies.remove()` call in `logout()` method
  - `test/unit/auth/service-extended.test.ts` - Update logout tests to verify cookie removal
  - `test/e2e/auth.e2e.ts` - Update E2E logout tests to verify no re-authentication occurs
