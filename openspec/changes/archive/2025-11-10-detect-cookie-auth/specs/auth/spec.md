# auth Specification Deltas

This file contains modifications to the `auth` specification.

---

## ADDED Requirements

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

## MODIFIED Requirements

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
