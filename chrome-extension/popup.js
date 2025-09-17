

// OIDC authentication logic using oidc-client-ts
import { UserManager } from "oidc-client-ts";

const oidcConfig = {
  authority: "https://login.microsoftonline.com/common/v2.0",
  client_id: "YOUR_CLIENT_ID_HERE", // Replace with your Azure AD app client ID
  redirect_uri: chrome.identity.getRedirectURL(),
  response_type: "token id_token",
  scope: "openid profile email",
};

const userManager = new UserManager(oidcConfig);
let accessToken = null;

// Automatically authenticate on extension load
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('status').innerText = 'Authenticating...';
  try {
    const user = await userManager.signinSilent();
    accessToken = user.access_token;
    document.getElementById('status').innerText = 'Authenticated!';
    chrome.storage.local.set({ accessToken });
    // Set icon to normal (authenticated)
    chrome.action.setIcon({ path: {
      "16": "icons/icon-normal.png",
      "32": "icons/icon-normal.png",
      "48": "icons/icon-normal.png",
      "128": "icons/icon-normal.png"
    }});
  } catch (e) {
    document.getElementById('status').innerText = 'Not authenticated.';
    // Set icon to not authenticated
    chrome.action.setIcon({ path: {
      "16": "icons/icon-not-auth.png",
      "32": "icons/icon-not-auth.png",
      "48": "icons/icon-not-auth.png",
      "128": "icons/icon-not-auth.png"
    }});
  }
});

// Documentation: This extension uses OIDC authentication with EntraID (Azure AD).
// The access token is stored in chrome.storage.local and used for API calls.
// The icon reflects authentication state: normal (authenticated), not authenticated, waiting (API call in progress).
