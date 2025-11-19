## MODIFIED Requirements

### Requirement: Server-Side Logout
The system SHALL invalidate server-side sessions when the user logs out, ensuring complete session termination on both client and server, and SHALL explicitly clear the authentication cookie from the main browser profile to prevent automatic re-authentication.

#### Scenario: Call Server Logout Endpoint
WHEN the user initiates logout from the extension
THEN the system SHALL send a GET request to `/api/v1/auths/signout`
AND the request SHALL include the current authentication token in the `Authorization: Bearer` header
AND the request SHALL be sent before clearing local storage
AND the endpoint call SHALL complete within a reasonable timeout (5 seconds)

#### Scenario: Server Logout Success with Complete Cookie Cleanup
WHEN the server logout endpoint is called
AND the server responds with a success status (200-299)
THEN the system SHALL log the successful server logout
AND proceed to clear local authentication state
AND remove the token from chrome.storage (both session and local)
AND explicitly remove the `token` cookie from the main browser profile using `chrome.cookies.remove()`
AND set auth state to `{ isAuthenticated: false, token: null, user: null }`
AND update UI to show unauthenticated state
AND the login button SHALL be visible
AND the logout button SHALL NOT be visible
AND the user profile SHALL NOT be visible
AND on next extension initialization, SHALL NOT automatically re-authenticate from browser session cookies

#### Scenario: Server Logout Failure Handling with Cookie Cleanup
WHEN the server logout endpoint is called
AND the server responds with an error status (401, 403, 500, etc.)
OR a network error occurs
OR the request times out
THEN the system SHALL log the error for debugging purposes
AND still proceed to clear local authentication state (graceful degradation)
AND remove the token from chrome.storage (both session and local)
AND explicitly remove the `token` cookie from the main browser profile using `chrome.cookies.remove()`
AND set auth state to `{ isAuthenticated: false, token: null, user: null }`
AND update UI to show unauthenticated state
AND the login button SHALL be visible
AND the logout button SHALL NOT be visible
AND the user profile SHALL NOT be visible
AND NOT display error messages to the user (silent failure)
AND on next extension initialization, SHALL NOT automatically re-authenticate from browser session cookies

#### Scenario: Logout Without Valid Token
WHEN logout is initiated
AND no valid token exists in auth state or storage
THEN the system SHALL skip the server logout API call
AND proceed directly to clearing any remaining local state
AND remove any tokens from chrome.storage
AND explicitly remove the `token` cookie from the main browser profile using `chrome.cookies.remove()`
AND set auth state to `{ isAuthenticated: false, token: null, user: null }`
AND update UI to show unauthenticated state
AND the login button SHALL be visible
AND the logout button SHALL NOT be visible
AND the user profile SHALL NOT be visible

#### Scenario: Cookie Removal from Main Browser Profile
WHEN logout is executed
THEN the system SHALL call `chrome.cookies.remove()` with parameters:
- `url`: The configured baseUrl (e.g., `http://localhost:8080`)
- `name`: `'token'`
AND this SHALL remove the cookie from the main browser profile
AND this prevents automatic re-authentication via `checkSessionAuth()` on next initialization
EVEN IF the user has OpenWebUI open in a regular browser tab
BECAUSE `checkSessionAuth()` uses `chrome.cookies.get()` which reads from the main browser profile
AND without explicit removal, the extension would detect the browser session and auto-authenticate

#### Scenario: Browser Tab Session Independence
WHEN the user logs out from the extension
AND the user has OpenWebUI open in a regular Chrome tab
THEN the browser tab's session SHALL remain active (expected behavior)
AND the user can continue using OpenWebUI in that tab
BUT the extension SHALL be fully logged out
AND the extension SHALL NOT automatically re-authenticate from the browser tab's session
BECAUSE the `token` cookie was explicitly removed from the main browser profile
AND subsequent `checkSessionAuth()` calls SHALL return null

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
AND the server SHALL set cookies with `Max-Age=0` to clear them from the browser
AND subsequent API calls with the same token SHALL return 401 Unauthorized
