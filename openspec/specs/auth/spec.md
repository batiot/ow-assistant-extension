# auth Specification

## Purpose
TBD - created by archiving change 2025-11-03-implement-authentication. Update Purpose after archive.
## Requirements
### Requirement: Secure Token Storage
The system SHALL store authentication tokens securely using the most appropriate storage mechanism available.

#### Scenario: Store Token with chrome.storage.session
WHEN a new authentication token is received
THEN the token SHALL be stored in chrome.storage.session
AND the token SHALL be encrypted if chrome.storage.local is used as fallback
AND the token expiration time SHALL be stored

#### Scenario: Token Cleanup
WHEN the token expires or the user logs out
THEN the token SHALL be immediately removed from storage
AND any cached authentication state SHALL be cleared

### Requirement: Seamless Authentication Process
The system SHALL provide a smooth authentication experience using OpenWebUI's SSO implementation, checking for existing browser sessions before initiating new OAuth flows.

#### Scenario: Initial Authentication Flow
WHEN an unauthenticated user triggers an action requiring authentication
THEN the system SHALL first test for existing browser session via `/api/v1/auths/` without Authorization header
AND only if no valid session exists (non-200 response), SHALL open the OpenWebUI login page
AND handle the OAuth redirect properly
AND securely store the received token

#### Scenario: Silent Authentication Success with Existing Session
WHEN silent authentication is attempted
AND the user has an existing browser session with valid HTTP-only cookie
THEN calling `/api/v1/auths/` SHALL return 200 OK with token in response
AND the silent authentication SHALL complete successfully without timeout
AND no visible popup window SHALL be displayed
AND the authentication state SHALL update immediately with token from API response
AND the user SHALL be able to use the extension without additional login steps

### Requirement: Robust Error Management
The system SHALL handle authentication errors gracefully and provide clear feedback to users.

#### Scenario: Authentication Failure Handling
WHEN the authentication process fails
THEN the system SHALL:
- Display clear error feedback to the user
- Provide retry options when appropriate
- Maintain the application in a usable state

#### Scenario: Token Renewal Process
WHEN a token expires
THEN the system SHALL attempt automatic renewal
AND maintain session continuity if successful
AND prompt for re-authentication only if necessary

### Requirement: Storage-Driven Initialization
The background service worker SHALL reactively initialize authentication services in response to configuration changes.

#### Scenario: Listen for Local Storage Changes
WHEN the extension is running
THEN the background worker SHALL have a `chrome.storage.onChanged` listener registered
AND the listener SHALL filter for changes to the `local` storage area
AND the listener SHALL specifically monitor the `user_settings_local` key

#### Scenario: Reinitialize on URL Configuration
WHEN the storage listener detects a new or changed instance URL
AND the URL is valid (not empty or undefined)
THEN the background worker SHALL:
1. Log the URL change for debugging
2. Call `AuthService.resetInstance()` to clear the singleton
3. Create a new instance with `AuthService.getInstance({ baseUrl: newUrl })`
4. Call `initialize()` on the new instance
5. Re-establish the `onAuthStateChanged` listener
6. Log successful reinitialization

#### Scenario: Handle Reinitialization Errors
WHEN reinitialization fails due to an error
THEN the background worker SHALL catch the error
AND log the error with context information
AND allow the extension to continue running
AND the auth service SHALL remain unavailable until the issue is resolved

### Requirement: Session-Based Authentication Detection
The system SHALL check for existing browser sessions by testing the authentication endpoint without credentials, enabling seamless integration with OpenWebUI HTTP-only cookie sessions.

#### Scenario: Check Session on Initialization
WHEN the AuthService initializes
AND no valid token exists in extension storage (or stored token is invalid)
THEN the system SHALL call `GET ${baseUrl}/api/v1/auths/` without Authorization header
AND if the response is successful (200 OK), SHALL extract the token from response JSON
AND store the token in extension storage
AND update authentication state with user info from response

#### Scenario: Check Session Before OAuth Flow
WHEN the user triggers login action
AND no valid token exists in current auth state
THEN the system SHALL call `GET ${baseUrl}/api/v1/auths/` without Authorization header
AND if a valid session exists (200 OK response)
THEN the system SHALL extract token and user info from response
AND authenticate without opening OAuth popup
AND update state to authenticated
AND return immediately without entering OAuth flow

#### Scenario: Session API Response Handling
WHEN `/api/v1/auths/` is called without Authorization header
AND a valid HTTP-only session cookie exists
THEN the API SHALL return status 200 with JSON containing:
- `id` (string): User unique identifier
- `email` (string): User email address
- `name` (string): User display name
- `role` (string): User role (e.g., "admin", "user")
- `token` (string): JWT token value to extract and store
- `token_type` (string): Authentication type, always "Bearer"
- `expires_at` (null | string): Token expiration, null means session-based
- `profile_image_url` (optional string): User avatar URL
- `permissions` (optional object): User permissions structure
AND the system SHALL extract the `token` field from the response
AND create an AuthToken with the extracted token value
AND set expiration to session-based (no expiry validation) since `expires_at` is null
AND store user info (`id`, `email`, `name`, `role`) for display purposes

#### Scenario: Session Detection Failure Fallback
WHEN session detection is attempted via `/api/v1/auths/`
AND the API returns 401 Unauthorized or 403 Forbidden
OR a network error occurs
THEN the system SHALL log the failure for debugging
AND proceed with standard OAuth authentication flow
AND not block the user from authenticating via OAuth

#### Scenario: HTTP-Only Cookie Limitation
WHEN the system attempts to check for authentication
THEN the system SHALL NOT use `chrome.cookies.getAll()` to read the token cookie
BECAUSE the cookie is HTTP-only and cannot be accessed via JavaScript
AND instead SHALL call `GET ${baseUrl}/api/v1/auths/` without Authorization header
AND rely on the browser to automatically send the HTTP-only cookie with the request
AND rely on the API response to provide the token value in the `token` field
AND the response SHALL include `token_type: "Bearer"` and `expires_at: null` for session-based tokens

#### Scenario: Unauthenticated Session Response
WHEN `/api/v1/auths/` is called without Authorization header
AND no valid HTTP-only session cookie exists
OR the session cookie has expired
THEN the API SHALL return status 401 Unauthorized
AND the response body SHALL contain `{ "detail": "Unauthorized" }`
AND the system SHALL treat this as no existing session
AND proceed with OAuth authentication flow

---

