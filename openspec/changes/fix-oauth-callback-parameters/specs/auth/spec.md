# Auth Capability Spec Delta

## MODIFIED Requirements

### Requirement: User Authentication

The system SHALL allow users to authenticate with the OpenWebUI backend using OAuth providers or existing session cookies.

#### Scenario: OAuth Login Flow with Query Parameter Preservation

**WHEN** the user initiates login
**THEN** the extension starts `chrome.identity.launchWebAuthFlow` with the backend OAuth URL
**AND** when the provider redirects to the backend callback URL (e.g., `/oauth/microsoft/callback?code=...&state=...`)
**THEN** the extension's `declarativeNetRequest` rule intercepts the request
**AND** uses a `regexFilter` to capture the provider name and all query parameters
**AND** redirects to `chrome-extension://<id>/src/pages/oauth-callback.html?provider=<captured-provider>&code=<code>&state=<state>&session_state=<session_state>`
**AND** all query parameters from the original callback URL are preserved
**AND** `launchWebAuthFlow` returns the complete redirected URL including all parameters
**AND** the extension extracts the `code`, `state`, and `provider` parameters from the returned URL
**AND** the extension uses the `provider` parameter to construct the correct token exchange endpoint
**AND** the extension successfully exchanges the authorization code for a session token

#### Scenario: OAuth Callback Page Parameter Validation

**WHEN** the OAuth callback page (`oauth-callback.html`) loads
**THEN** the page SHALL parse the URL query parameters
**AND** validate that the `code` parameter is present
**AND** if the `code` parameter is present, display a success message
**AND** if an `error` parameter is present, display the error description to the user
**AND** if the `code` parameter is missing and no `error` is present, display an error message indicating missing authorization code
**AND** provide appropriate user feedback about the authentication status

#### Scenario: DeclarativeNetRequest Rule Configuration

**WHEN** the extension is loaded
**THEN** the `declarativeNetRequest` rule SHALL use a `regexFilter` pattern: `^(https?://[^/]+)/oauth/([^/]+)/callback(.*)$`
**AND** the rule SHALL use `regexSubstitution` to construct the extension callback URL
**AND** the substitution SHALL include the provider name as a query parameter using capture group 2
**AND** the substitution SHALL preserve all original query parameters using capture group 3
**AND** the rule SHALL only apply to `main_frame` resource types
**AND** the extension callback URL SHALL be in the format: `chrome-extension://<id>/src/pages/oauth-callback.html?provider=\2\3`

#### Scenario: Provider Name Extraction

**WHEN** `launchWebAuthFlow` returns the callback URL
**THEN** the auth service SHALL extract the `provider` query parameter from the URL
**AND** use the provider value to construct the token exchange endpoint as `${baseUrl}/oauth/${provider}/callback`
**AND** include the authorization code and state in the token exchange request
**AND** NOT rely on hardcoded or guessed provider names
**AND** handle missing provider parameter as an authentication error

#### Scenario: Multi-Provider Support

**WHEN** the OpenWebUI backend supports multiple OAuth providers (e.g., microsoft, google)
**THEN** the redirect rule SHALL correctly capture any provider name from the path
**AND** the provider name SHALL be passed through to the auth service
**AND** the auth service SHALL use the correct provider-specific callback endpoint
**AND** authentication SHALL succeed regardless of which provider was used

## REMOVED Requirements

None - This change fixes existing broken functionality rather than removing features.

## ADDED Requirements

### Requirement: Callback Page User Experience

The OAuth callback page SHALL provide clear visual feedback to users during the authentication process.

#### Scenario: Successful Authentication Feedback

**WHEN** the callback page loads with a valid `code` parameter
**THEN** the page SHALL display "Authentication Successful" heading
**AND** show a message "Completing sign-in..."
**AND** indicate that the window will close automatically
**AND** log the authentication status to the console for debugging

#### Scenario: Error State Display

**WHEN** the callback page loads with an `error` parameter
**THEN** the page SHALL display "Authentication Failed" heading  
**AND** show the error description from the `error_description` parameter or the `error` value
**AND** provide a hint that the user can close the window
**AND** NOT attempt to auto-close the window (allow user to read error)

#### Scenario: Missing Code Error Display

**WHEN** the callback page loads without a `code` parameter and without an `error` parameter
**THEN** the page SHALL display "Authentication Error" heading
**AND** show a message "No authorization code received"
**AND** suggest that the user try again
**AND** indicate the window can be closed manually
