# auth Spec Delta

## MODIFIED Requirements

### Requirement: Extension Context Cookie Handling
The system SHALL read HttpOnly cookies using the chrome.cookies API and explicitly include them in requests, because extension fetch requests do not share the browser's cookie jar with web pages.

#### Scenario: Read Token Cookie for Session Check
WHEN the system needs to check for an existing session via `/api/v1/auths/`
THEN the system SHALL first call `chrome.cookies.get()` with the backend URL and cookie name "token"
AND if the cookie exists, SHALL extract the token value
AND SHALL include the token in the request's `Cookie` header as `token=${tokenValue}`
BECAUSE `credentials: 'include'` does NOT automatically send cookies in extension context
AND the extension's fetch does not share the browser's cookie jar with web pages

#### Scenario: Session Check with Explicit Cookie Header
WHEN calling `/api/v1/auths/` to check for existing session
AND a token cookie was successfully retrieved via `chrome.cookies.get()`
THEN the system SHALL send the request with headers:
- `Content-Type: application/json`
- `Cookie: token=${tokenValue}`
AND SHALL NOT rely on `credentials: 'include'` to send cookies
AND the backend SHALL process the cookie from the Cookie header
AND return the user info and token if the cookie is valid

#### Scenario: Handle Missing Cookie During Session Check
WHEN checking for existing session
AND `chrome.cookies.get()` returns null (no token cookie found)
THEN the system SHALL log that no token cookie was found
AND SHALL return null (no session exists)
AND SHALL NOT make a request to `/api/v1/auths/`
BECAUSE there is no cookie to send

### Requirement: Cookie-Based Token Extraction
The system SHALL extract authentication tokens from HttpOnly cookies using the chrome.cookies API, which provides privileged access regardless of cookie security flags.

#### Scenario: Extract Token from HttpOnly Cookie After OAuth Callback
WHEN the OAuth callback completes successfully
AND the backend has set a token cookie (which may be HttpOnly, Secure, and SameSite=Strict)
THEN the system SHALL call `chrome.cookies.get()` with the backend URL and cookie name "token"
AND if the cookie exists, SHALL extract the token value from the cookie
AND calculate the expiration time from the cookie's expirationDate (or default to 24 hours if session-based)
AND return an AuthToken object with the token value and expiration time

#### Scenario: Handle Missing Token Cookie
WHEN the OAuth callback completes
AND the system attempts to extract the token cookie
AND `chrome.cookies.get()` returns null (cookie not found)
THEN the system SHALL throw an AuthError with type AUTHENTICATION_FAILED
AND the error message SHALL clearly indicate "No authentication token found in cookies"
AND the error SHALL be logged for debugging purposes

#### Scenario: Chrome Cookies API Privileged Access
WHEN the system uses `chrome.cookies.get()` to retrieve the token cookie
THEN the API SHALL successfully return the cookie value
AND this SHALL work regardless of whether the cookie has HttpOnly flag set
AND this SHALL work regardless of whether the cookie has Secure flag set
AND this SHALL work regardless of whether the cookie has SameSite=Strict flag set
BECAUSE the chrome.cookies API operates at a privileged browser level

#### Scenario: Support Localhost Development
WHEN the backend URL is `http://localhost:8080`
AND the token cookie is marked as Secure
THEN the chrome.cookies API SHALL still be able to access the cookie
BECAUSE localhost is treated as a secure context by browsers
AND the cookie extraction SHALL complete successfully

#### Scenario: Proper Cookie URL Matching
WHEN calling `chrome.cookies.get()`
THEN the system SHALL pass the exact backend base URL (e.g., "http://localhost:8080")
AND the cookie name SHALL be "token"
AND the URL SHALL match the domain where the cookie was set
AND this SHALL ensure the correct cookie is retrieved even if multiple domains have cookies with the same name

### Requirement: Shared Cookie Helper Function
The system SHALL provide a reusable helper function for reading the token cookie to avoid code duplication.

#### Scenario: Reusable getTokenCookie Helper
WHEN any part of the auth system needs to read the token cookie
THEN a shared `getTokenCookie()` method SHALL be available
AND it SHALL accept the backend base URL as a parameter
AND it SHALL return the cookie value as a string if found, or null if not found
AND it SHALL handle errors gracefully by logging and returning null
AND it SHALL be used by both `checkSessionAuth()` and `extractTokenFromCallback()`
