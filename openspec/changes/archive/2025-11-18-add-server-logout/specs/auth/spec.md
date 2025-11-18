# auth Spec Delta

## ADDED Requirements

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
