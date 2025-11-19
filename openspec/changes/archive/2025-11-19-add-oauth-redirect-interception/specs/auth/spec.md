## ADDED Requirements

### Requirement: User Authentication
The system SHALL allow users to authenticate with the OpenWebUI backend using OAuth providers or existing session cookies.

#### Scenario: OAuth Login Flow with Interception
- **WHEN** the user initiates login
- **THEN** the extension starts `chrome.identity.launchWebAuthFlow` with the backend OAuth URL
- **AND** when the provider redirects to the backend callback URL, the extension intercepts the request
- **AND** redirects it to `chrome-extension://<id>/src/pages/oauth-callback.html` preserving query parameters
- **AND** `launchWebAuthFlow` returns the redirected URL containing the authorization code
- **AND** the extension manually exchanges the code for a session token via the backend API
