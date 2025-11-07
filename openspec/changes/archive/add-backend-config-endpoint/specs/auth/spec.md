## ADDED Requirements

### Requirement: Configuration-Driven Authentication Initialization
The system SHALL determine whether authentication is required based on backend configuration before initializing authentication services.

#### Scenario: Skip Authentication When Disabled
- **WHEN** the backend configuration indicates `features.auth === false`
- **THEN** the system SHALL NOT initialize the authentication service
- **AND** the system SHALL allow API requests without authentication tokens
- **AND** the system SHALL log that authentication is disabled

#### Scenario: Initialize Authentication When Enabled
- **WHEN** the backend configuration indicates `features.auth === true`
- **THEN** the system SHALL initialize the authentication service
- **AND** the system SHALL check current authentication status via `/api/v1/auths/`
- **AND** the system SHALL proceed with authentication flow if not authenticated

### Requirement: Intelligent OAuth Provider Selection
The system SHALL select the appropriate authentication entry point based on available OAuth providers and login form configuration to minimize user friction.

#### Scenario: Direct Single Provider Authentication
- **WHEN** the backend configuration contains exactly one OAuth provider
- **AND** `features.enable_login_form === false`
- **AND** the user is not currently authenticated
- **THEN** the system SHALL directly load the provider-specific OAuth URL `${baseUrl}/oauth/${providerName}/login`
- **AND** the system SHALL attempt silent authentication if possible
- **AND** the system SHALL only show authentication popup if user interaction is required

#### Scenario: Multiple Provider Selection
- **WHEN** the backend configuration contains multiple OAuth providers
- **AND** the user is not currently authenticated
- **THEN** the system SHALL load the base URL `${baseUrl}/` in the authentication popup
- **AND** the system SHALL display the popup to allow user to select their provider
- **AND** the system SHALL wait for the user to complete authentication

#### Scenario: Login Form Available
- **WHEN** the backend configuration indicates `features.enable_login_form === true`
- **AND** the user is not currently authenticated
- **THEN** the system SHALL load the base URL `${baseUrl}/` in the authentication popup
- **AND** the system SHALL display the popup to allow user to choose between form login and OAuth
- **AND** the system SHALL wait for the user to complete authentication

#### Scenario: No Providers Available
- **WHEN** the backend configuration contains no OAuth providers
- **AND** `features.enable_login_form === false`
- **THEN** the system SHALL log an error
- **AND** the system SHALL display an error message to the user
- **AND** the system SHALL NOT attempt authentication

### Requirement: Dynamic Authentication Popup Visibility
The system SHALL determine authentication strategy before creating any popup to prevent unnecessary popup flashing and provide optimal user experience.

#### Scenario: Skip Popup When Authentication Not Required
- **WHEN** the backend configuration indicates `features.auth === false`
- **OR** the user is already authenticated (verified via `/api/v1/auths/`)
- **THEN** the system SHALL NOT create or display any authentication popup
- **AND** the system SHALL proceed with the requested operation

#### Scenario: Attempt Silent Authentication for Single Provider
- **WHEN** using single provider direct authentication
- **AND** `features.enable_login_form === false`
- **AND** the user is not currently authenticated
- **THEN** the system SHALL first attempt silent authentication in background context
- **AND** the system SHALL only create a visible popup if the OAuth provider requires user interaction
- **AND** the system SHALL timeout silent attempt after 2-3 seconds and show popup if not complete

#### Scenario: Show Popup Immediately for User Selection
- **WHEN** multiple OAuth providers are available OR login form is enabled
- **AND** the user is not currently authenticated
- **THEN** the system SHALL immediately create and display the authentication popup
- **AND** the system SHALL load the base URL to allow user selection
- **AND** the system SHALL NOT attempt silent authentication first

## MODIFIED Requirements

### Requirement: Seamless Authentication Process
The system SHALL provide a smooth authentication experience using OpenWebUI's SSO implementation with backend-configured endpoints and providers.

#### Scenario: Authentication Endpoints Configuration
- **WHEN** the extension is initialized with backend configuration
- **THEN** the authentication endpoints SHALL be dynamically determined based on backend config:
  - Single provider: `${OPENWEBUI_BASE_URL}/oauth/${providerName}/login`
  - Multiple providers or form enabled: `${OPENWEBUI_BASE_URL}/`
  - Callback: `${OPENWEBUI_BASE_URL}/oauth/${providerName}/callback`
  - Token validation: `${OPENWEBUI_BASE_URL}/api/v1/auths/`
- **AND** the system SHALL use the provider name from backend configuration

#### Scenario: Initial Authentication Flow
- **WHEN** an unauthenticated user triggers an action requiring authentication
- **AND** backend configuration indicates authentication is enabled
- **THEN** the system SHALL determine the appropriate authentication entry point based on backend config
- **AND** the system SHALL open the appropriate URL (provider-specific or base URL)
- **AND** the system SHALL handle the OAuth redirect properly
- **AND** the system SHALL securely store the received token
