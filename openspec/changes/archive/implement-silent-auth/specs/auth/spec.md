## ADDED Requirements

### Requirement: Silent Authentication Optimization
The system SHALL attempt silent authentication before showing popup windows when backend configuration indicates it is likely to succeed, providing seamless re-authentication for users with existing OAuth sessions.

#### Scenario: Determine Silent Auth Eligibility
- **WHEN** the authentication service prepares to authenticate a user
- **AND** backend configuration contains exactly one OAuth provider
- **AND** `features.enable_login_form === false`
- **AND** the user does not have a valid token in storage
- **THEN** the system SHALL mark this authentication attempt as eligible for silent authentication
- **AND** the system SHALL log the decision to attempt silent authentication

#### Scenario: Determine Visible Popup Required
- **WHEN** the authentication service prepares to authenticate a user
- **AND** (backend configuration contains multiple OAuth providers OR `features.enable_login_form === true`)
- **THEN** the system SHALL skip silent authentication attempt
- **AND** the system SHALL immediately create a visible authentication popup
- **AND** the system SHALL log that immediate popup is required

#### Scenario: Successful Silent Authentication
- **WHEN** silent authentication is attempted
- **AND** the user has an existing valid OAuth session with the provider
- **AND** the OAuth provider redirects to the callback URL without user interaction
- **AND** the authentication completes within the timeout period (2.5 seconds)
- **THEN** the system SHALL extract the authentication token from cookies
- **AND** the system SHALL validate the token against the backend
- **AND** the system SHALL store the validated token
- **AND** the system SHALL update authentication state to authenticated
- **AND** the system SHALL close the hidden authentication tab/context
- **AND** the system SHALL NOT create or show any visible popup
- **AND** the system SHALL log successful silent authentication
- **AND** the `login()` method SHALL complete without showing UI

#### Scenario: Silent Authentication Timeout
- **WHEN** silent authentication is attempted
- **AND** the OAuth provider does not redirect to callback URL within the timeout period (2.5 seconds)
- **THEN** the system SHALL cancel the silent authentication attempt
- **AND** the system SHALL close the hidden authentication tab/context
- **AND** the system SHALL log that silent authentication timed out
- **AND** the system SHALL immediately create a visible authentication popup with the same auth URL
- **AND** the system SHALL proceed with standard popup-based authentication flow

#### Scenario: Silent Authentication Network Error
- **WHEN** silent authentication is attempted
- **AND** a network error or other exception occurs during the attempt
- **THEN** the system SHALL log the error with context
- **AND** the system SHALL close the hidden authentication tab/context if it was created
- **AND** the system SHALL fall back to creating a visible authentication popup
- **AND** the system SHALL proceed with standard popup-based authentication flow

#### Scenario: Silent Authentication Context Creation
- **WHEN** the system attempts silent authentication
- **THEN** the system SHALL create a hidden Chrome tab with `active: false`
- **AND** the system SHALL load the OAuth provider login URL in the hidden tab
- **AND** the system SHALL monitor the tab's URL for navigation to the callback URL
- **AND** the system SHALL ensure the hidden tab is not visible to the user
- **AND** the system SHALL guarantee cleanup of the hidden tab regardless of outcome

### Requirement: Silent Authentication Timeout Management
The system SHALL enforce a strict timeout for silent authentication attempts to prevent indefinite waiting and ensure responsive user experience.

#### Scenario: Configure Silent Auth Timeout
- **WHEN** the authentication service is initialized
- **THEN** the silent authentication timeout SHALL be set to 2500 milliseconds (2.5 seconds)
- **AND** this timeout SHALL apply to all silent authentication attempts
- **AND** the timeout value SHALL be logged at debug level

#### Scenario: Timeout Race Condition
- **WHEN** silent authentication is attempted
- **THEN** the system SHALL create a Promise race between:
  - Authentication callback completion
  - Timeout promise that resolves to null after 2.5 seconds
- **AND** whichever promise settles first SHALL determine the outcome
- **AND** the losing promise SHALL be ignored
- **AND** cleanup SHALL occur regardless of which promise wins

#### Scenario: Timeout Triggers Visible Popup
- **WHEN** the timeout promise wins the race (silent auth exceeded 2.5 seconds)
- **THEN** the system SHALL immediately proceed to visible popup creation
- **AND** the system SHALL use the same authentication URL determined earlier
- **AND** the user SHALL see no evidence that silent auth was attempted
- **AND** the standard popup authentication flow SHALL proceed normally

### Requirement: Silent Authentication Observability
The system SHALL provide detailed logging for silent authentication attempts to enable debugging and monitoring of this invisible optimization.

#### Scenario: Log Silent Auth Decision
- **WHEN** the authentication service determines whether to attempt silent auth
- **THEN** the system SHALL log the decision with provider information
- **AND** the log SHALL include whether silent auth will be attempted
- **AND** the log SHALL include the reasoning (single provider, no form, etc.)

#### Scenario: Log Silent Auth Outcome
- **WHEN** silent authentication attempt completes (success or timeout)
- **THEN** the system SHALL log the outcome with context:
  - Success: "Silent authentication succeeded"
  - Timeout: "Silent authentication timed out, showing popup"
  - Error: "Silent auth error: <error details>"
- **AND** logs SHALL include timing information when available
- **AND** logs SHALL use consistent "[Auth]" prefix for filtering

#### Scenario: Log Fallback to Popup
- **WHEN** silent authentication fails and the system falls back to visible popup
- **THEN** the system SHALL log that fallback is occurring
- **AND** the log SHALL indicate why fallback was necessary (timeout, error, etc.)
- **AND** the log SHALL confirm that the visible popup is being created

## MODIFIED Requirements

### Requirement: Seamless Authentication Process
The system SHALL provide a smooth authentication experience using OpenWebUI's SSO implementation, attempting silent authentication when appropriate before falling back to visible popup windows.

#### Scenario: Initial Authentication Flow
- **WHEN** an unauthenticated user triggers an action requiring authentication
- **AND** backend configuration indicates authentication is enabled
- **THEN** the system SHALL first check if the user already has a valid token
- **AND** if no valid token exists, the system SHALL determine if silent authentication should be attempted
- **AND** if silent auth is appropriate, the system SHALL attempt it before creating any visible UI
- **AND** if silent auth is not appropriate or fails, the system SHALL create a visible popup
- **AND** the system SHALL handle the OAuth redirect properly in either case
- **AND** the system SHALL securely store the received token

#### Scenario: Authentication State Check Before UI
- **WHEN** the `login()` method is called
- **THEN** the system SHALL first verify if a valid authentication token already exists
- **AND** if a valid token exists, the system SHALL NOT create any popup or hidden tab
- **AND** the method SHALL complete immediately without showing UI
- **AND** this check SHALL occur before any silent auth or popup logic
