# auth Spec Delta

## MODIFIED Requirements

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

## REMOVED Requirements

### ~~Requirement: Cookie Header Authentication~~
**REMOVED**: The previous requirement specified sending tokens in the Cookie header, but the actual OpenWebUI backend only accepts Authorization Bearer header. Cookie header approach was based on incorrect assumptions about backend behavior.

**Previous Scenarios Removed**:
- "Send the cookie explicitly in the Cookie header" - backend ignores Cookie header
- "Cookie header format `Cookie: token=${value}`" - not used by backend API
