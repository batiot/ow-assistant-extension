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
The background service worker SHALL reactively initialize authentication services in response to configuration changes **AND SHALL initialize on startup when a valid instance URL is present (from storage or defaults)**.

#### Scenario: Initialize on Startup with Default URL
**WHEN** the extension starts for the first time (fresh install)
**AND** no instance URL exists in storage
**AND** the settings manager returns the compile-time default URL (e.g., `http://localhost:8080`)
**AND** the default URL is not empty
**THEN** the background worker SHALL:
1. Retrieve the instance URL from `configManager.getOpenWebUIBaseUrl()`
2. Recognize the default URL as a valid configuration
3. Initialize the authentication service with `AuthService.getInstance({ baseUrl })`
4. Call `initialize()` on the auth service instance
5. Establish the `onAuthStateChanged` listener
6. Log the initialization with the default URL for debugging

#### Scenario: Distinguish Default URL from Explicitly Cleared URL
**WHEN** determining whether to initialize the auth service
**THEN** the system SHALL treat an empty string or undefined URL as "not configured"
**AND** SHALL treat any non-empty URL (including compile-time defaults) as "configured"
**AND** SHALL NOT initialize auth service when URL is explicitly empty
**AND** SHALL initialize auth service when URL contains the default value from code

#### Scenario: Reinitialize on URL Configuration (No Change)
**WHEN** the storage listener detects a new or changed instance URL
**AND** the URL is valid (not empty or undefined)
**THEN** the background worker SHALL:
1. Log the URL change for debugging
2. Call `AuthService.resetInstance()` to clear the singleton
3. Create a new instance with `AuthService.getInstance({ baseUrl: newUrl })`
4. Call `initialize()` on the new instance
5. Re-establish the `onAuthStateChanged` listener
6. Log successful reinitialization

*Note: This scenario is unchanged from the original spec but included for completeness.*

### Requirement: Session-Based Authentication Detection
The system SHALL check for existing browser sessions by reading the token cookie using chrome.cookies API and sending it as a Bearer token in the Authorization header, because the OpenWebUI `/api/v1/auths/` endpoint only validates tokens from the Authorization header.

#### Scenario: Check Session on Initialization
WHEN the AuthService initializes
AND no valid token exists in extension storage (or stored token is invalid)
THEN the system SHALL call `chrome.cookies.get()` to read the token cookie
AND if a token cookie exists, SHALL use its value in the Authorization header as `Bearer ${tokenValue}` when calling `/api/v1/auths/`
AND if the response is successful (200 OK), SHALL extract the token from response JSON
AND store the token in extension storage
AND update authentication state with user info from response

#### Scenario: Check Session Before OAuth Flow
WHEN the user triggers login action
AND no valid token exists in current auth state
THEN the system SHALL call `chrome.cookies.get()` to read the token cookie
AND if a token cookie exists, SHALL use its value in the Authorization header as `Bearer ${tokenValue}` when calling `/api/v1/auths/`
AND if a valid session exists (200 OK response)
THEN the system SHALL extract token and user info from response
AND authenticate without opening OAuth popup
AND update state to authenticated
AND return immediately without entering OAuth flow

#### Scenario: Session API Request Format
WHEN `/api/v1/auths/` is called to check for existing session
AND a token cookie value was successfully retrieved via `chrome.cookies.get()`
THEN the system SHALL send the request with headers:
- `Authorization: Bearer ${tokenValue}` (REQUIRED - backend only validates this header)
AND SHALL NOT send the token in the Cookie header
BECAUSE the OpenWebUI backend only validates tokens from the Authorization header
AND ignores Cookie header values for authentication purposes

#### Scenario: Session API Response Handling
WHEN `/api/v1/auths/` is called with `Authorization: Bearer` header
AND the token is valid
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

#### Scenario: Backend Cookie Re-Setting Behavior
WHEN `/api/v1/auths/` is called with a valid `Authorization: Bearer` token
THEN the OpenWebUI backend MAY re-set the auth cookie with the same token value
AND this is expected backend behavior
AND the extension SHALL not rely on or be affected by this cookie re-setting
BECAUSE the extension reads the cookie via chrome.cookies API independently

#### Scenario: Session Detection Failure Fallback
WHEN session detection is attempted via `/api/v1/auths/`
AND the API returns 401 Unauthorized or 403 Forbidden
OR a network error occurs
THEN the system SHALL log the failure for debugging
AND proceed with standard OAuth authentication flow
AND not block the user from authenticating via OAuth

#### Scenario: Extension Context Cookie Access
WHEN the system needs to check for authentication in an extension context
THEN the system SHALL use `chrome.cookies.get()` to explicitly read the token cookie
BECAUSE extension fetch requests don't share the browser's cookie jar with web pages
AND `credentials: 'include'` does NOT automatically send HttpOnly cookies in extensions
AND the cookie value SHALL be used in the Authorization header as `Authorization: Bearer ${value}`
WHEN calling `/api/v1/auths/`
AND this approach works regardless of HttpOnly, Secure, and SameSite=Strict flags
BECAUSE chrome.cookies API has privileged browser-level access

#### Scenario: Unauthenticated Session Response
WHEN `/api/v1/auths/` is called with an Authorization header
AND the Bearer token is invalid or expired
OR no valid authentication exists
THEN the API SHALL return status 401 Unauthorized
AND the response body SHALL contain `{ "detail": "Unauthorized" }` or similar error message
AND the system SHALL treat this as no existing session
AND proceed with OAuth authentication flow

### Requirement: Server-Side Logout
The system SHALL invalidate server-side sessions when the user logs out, ensuring complete session termination on both client and server.

#### Scenario: Call Server Logout Endpoint
WHEN the user initiates logout from the extension
THEN the system SHALL send a GET request to `/api/v1/auths/signout`
AND the request SHALL include the current authentication token in the `Authorization: Bearer` header
AND the request SHALL be sent before clearing local storage
AND the endpoint call SHALL complete within a reasonable timeout (5 seconds)

#### Scenario: Server Logout Success
WHEN the server logout endpoint is called
AND the server responds with a success status (200-299)
THEN the system SHALL log the successful server logout
AND proceed to clear local authentication state
AND remove the token from chrome.storage
AND set auth state to `{ isAuthenticated: false, token: null, user: null }`
AND update UI to show unauthenticated state
AND the login button SHALL be visible
AND the logout button SHALL NOT be visible
AND the user profile SHALL NOT be visible

#### Scenario: Server Logout Failure Handling
WHEN the server logout endpoint is called
AND the server responds with an error status (401, 403, 500, etc.)
OR a network error occurs
OR the request times out
THEN the system SHALL log the error for debugging purposes
AND still proceed to clear local authentication state (graceful degradation)
AND remove the token from chrome.storage
AND set auth state to `{ isAuthenticated: false, token: null, user: null }`
AND update UI to show unauthenticated state
AND the login button SHALL be visible
AND the logout button SHALL NOT be visible
AND the user profile SHALL NOT be visible
AND NOT display error messages to the user (silent failure)

#### Scenario: Logout Without Valid Token
WHEN logout is initiated
AND no valid token exists in auth state or storage
THEN the system SHALL skip the server logout API call
AND proceed directly to clearing any remaining local state
AND set auth state to `{ isAuthenticated: false, token: null, user: null }`
AND update UI to show unauthenticated state
AND the login button SHALL be visible
AND the logout button SHALL NOT be visible
AND the user profile SHALL NOT be visible

#### Scenario: Server Logout API Contract
WHEN `/api/v1/auths/signout` endpoint is called
THEN the request format SHALL be:
- Method: GET
- URL: `${baseUrl}/api/v1/auths/signout`
- Headers: `Authorization: Bearer ${token}`
AND the expected successful response SHALL be:
- Status: 200 OK or 204 No Content
- Body: Optional (implementation may return empty response)
AND the server SHALL invalidate the session associated with the provided token
AND subsequent API calls with the same token SHALL return 401 Unauthorized

#### Scenario: Auth Status Verification After Logout
WHEN logout completes successfully
THEN the system MAY optionally verify logout by calling `/api/v1/auths/`
AND if verification is performed, the response SHALL be 401 Unauthorized
AND verification is for testing/debugging purposes only
AND SHALL NOT block or affect the logout flow
AND SHALL NOT be displayed to the user

