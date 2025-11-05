# Integrate Authentication with UI and OpenWebUI Flow

## Why

The authentication module has been implemented but is not connected to the UI or integrated with OpenWebUI API calls. Users cannot authenticate, and the extension cannot make authenticated requests to OpenWebUI services. This change bridges the gap between the auth infrastructure and the user-facing components.

## What Changes

### UI Components
- **ADDED** Authentication status display in popup and sidepanel
- **ADDED** Login/logout buttons with appropriate state management
- **ADDED** User profile display when authenticated
- **ADDED** Error messaging for authentication failures
- **ADDED** Loading states during authentication flows

### Background Service Integration
- **ADDED** Auth service initialization on extension startup
- **ADDED** Token validation and refresh logic in background worker
- **ADDED** Message passing between UI and background for auth state
- **ADDED** Configuration management for OpenWebUI base URL

### OpenWebUI API Integration
- **ADDED** HTTP client with automatic token injection
- **ADDED** API request interceptors for authentication
- **ADDED** Automatic token refresh on API errors
- **ADDED** API endpoints for OpenWebUI completion services

### State Management
- **ADDED** React hooks for authentication state
- **ADDED** Auth context provider for UI components
- **ADDED** Persistent auth state across popup/sidepanel

## Impact

### Affected Specs
- `auth` - Uses existing authentication infrastructure
- `ui` - New capability for user interface components
- `openwebui-integration` - New capability for API integration

### Affected Code
- `src/popup/` - Add authentication UI
- `src/sidepanel/` - Add authentication UI
- `src/background/` - Initialize and manage auth service
- New: `src/api/` - OpenWebUI API client
- New: `src/hooks/` - React hooks for auth state
- New: `src/contexts/` - Auth context provider

### Breaking Changes
None - this is additive functionality

## Non-Goals

- Custom LLM model selection UI (future work)
- Advanced OpenWebUI features (chat history, model management)
- Multi-account support
- Offline mode

## OpenWebUI API Integration Details

### User Profile Endpoint

The `/api/v1/auths/` endpoint provides user profile information including:
- User ID
- Email address
- Display name
- **Profile picture URL** - Can be used to display user avatar in the UI

This endpoint is used both for token validation and retrieving complete user profile data, including the profile picture URL that can be displayed in the authentication UI components.
