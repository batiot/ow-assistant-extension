## ADDED Requirements

### Requirement: Backend Configuration Retrieval
The system SHALL fetch backend configuration from the OpenWebUI `/api/config` endpoint to determine available authentication methods and features.

#### Scenario: Fetch Configuration on Extension Initialization
- **WHEN** the extension background service initializes
- **AND** a valid OpenWebUI base URL is configured
- **THEN** the system SHALL send a GET request to `${baseUrl}/api/config`
- **AND** the system SHALL parse the JSON response into a `BackendConfig` structure
- **AND** the system SHALL cache the configuration in memory for the session

#### Scenario: Fetch Configuration on Base URL Change
- **WHEN** the user changes the OpenWebUI instance base URL in settings
- **AND** the new URL is valid and not empty
- **THEN** the system SHALL send a GET request to `${newBaseUrl}/api/config`
- **AND** the system SHALL update the cached configuration
- **AND** the system SHALL trigger authentication service reinitialization with the new config

#### Scenario: Handle Missing Configuration Endpoint
- **WHEN** the `/api/config` endpoint returns 404 Not Found
- **THEN** the system SHALL log a warning
- **AND** the system SHALL use default configuration (auth enabled, Microsoft OAuth provider)
- **AND** the system SHALL continue with standard authentication flow

#### Scenario: Handle Configuration Fetch Error
- **WHEN** the `/api/config` request fails due to network error or invalid response
- **THEN** the system SHALL log the error with context
- **AND** the system SHALL use default configuration (auth enabled, Microsoft OAuth provider)
- **AND** the system SHALL allow the extension to continue functioning

#### Scenario: Parse Backend Configuration Response
- **WHEN** the `/api/config` endpoint returns a successful response
- **THEN** the response SHALL contain an `oauth.providers` object mapping provider names to identifiers
- **AND** the response SHALL contain a `features.auth` boolean flag
- **AND** the response SHALL contain a `features.enable_login_form` boolean flag
- **AND** the system SHALL validate the response structure before use

### Requirement: Backend Configuration API Documentation
The system documentation SHALL clearly describe the OpenWebUI backend API endpoints used for configuration and authentication.

#### Scenario: Document Configuration Endpoint Format
- **WHEN** developers reference the API documentation
- **THEN** the documentation SHALL include the `/api/config` endpoint
- **AND** the documentation SHALL show the expected JSON response format:
```json
{
  "oauth": {
    "providers": {
      "microsoft": "microsoft",
      "google": "google"
    }
  },
  "features": {
    "auth": true,
    "enable_login_form": true
  }
}
```
- **AND** the documentation SHALL explain each field's purpose

#### Scenario: Document Authentication Check Endpoint
- **WHEN** developers reference the API documentation
- **THEN** the documentation SHALL include the `/api/v1/auths/` endpoint
- **AND** the documentation SHALL show the expected response when authenticated:
```json
{
  "id": "16f44d75-3705-4adf-a83e-f5f6fbedf495",
  "email": "user@example.com",
  "name": "User Name",
  "role": "admin",
  "profile_image_url": "/user.png",
  "token": "eyJhbGci...",
  "token_type": "Bearer"
}
```
- **AND** the documentation SHALL note that 401 status indicates unauthenticated state
- **AND** the documentation SHALL note that 200 status with user details indicates authenticated state

## MODIFIED Requirements

### Requirement: OpenWebUI Configuration
The system SHALL allow configuration of the OpenWebUI backend URL and SHALL fetch backend-specific configuration to adapt extension behavior.

#### Scenario: Configure OpenWebUI Base URL
- **WHEN** the extension is first installed
- **THEN** the system SHALL prompt for or detect the OpenWebUI base URL
- **AND** validate the URL format
- **AND** store it securely

#### Scenario: Validate OpenWebUI Connection
- **WHEN** the OpenWebUI base URL is configured
- **THEN** the system SHALL attempt to fetch backend configuration from `/api/config`
- **AND** verify the service is accessible
- **AND** display connection status to the user
- **AND** cache the backend configuration for the session
