# Authentication UI Integration Design

## Architecture Overview

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Extension UI Layer                      │
│  ┌────────────────┐              ┌────────────────┐         │
│  │     Popup      │              │   Sidepanel    │         │
│  │                │              │                │         │
│  │  ┌──────────┐  │              │  ┌──────────┐  │         │
│  │  │AuthProvider              │  │AuthProvider  │         │
│  │  │          │  │              │  │          │  │         │
│  │  │ useAuth()│  │              │  │ useAuth()│  │         │
│  │  └────┬─────┘  │              │  └────┬─────┘  │         │
│  └───────┼────────┘              └───────┼────────┘         │
│          │                               │                   │
│          └───────────┬───────────────────┘                   │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Background Service Worker                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    AuthService                       │   │
│  │  - initialize()                                      │   │
│  │  - login()                                           │   │
│  │  - logout()                                          │   │
│  │  - getState()                                        │   │
│  │  - onAuthStateChanged()                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  API Client                          │   │
│  │  - Automatic token injection                         │   │
│  │  - Request/response interceptors                     │   │
│  │  - Error handling & retry                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  OpenWebUI  │
                    │   Backend   │
                    └─────────────┘
```

## Communication Patterns

### UI to Background Messages

```typescript
// Login request
{
  type: 'AUTH_LOGIN',
  payload: {}
}

// Logout request
{
  type: 'AUTH_LOGOUT',
  payload: {}
}

// Get current state
{
  type: 'AUTH_GET_STATE',
  payload: {}
}

// API request
{
  type: 'API_REQUEST',
  payload: {
    endpoint: string,
    method: string,
    body?: any
  }
}
```

### Background to UI Messages

```typescript
// Auth state changed
{
  type: 'AUTH_STATE_CHANGED',
  payload: {
    isAuthenticated: boolean,
    user: UserInfo | null,
    error?: AuthError
  }
}

// API response
{
  type: 'API_RESPONSE',
  payload: {
    data: any,
    error?: Error
  }
}
```

## OAuth Window Implementation

### Window Type Selection

The Microsoft OAuth flow requires displaying full HTML pages (login forms, consent screens, etc.), which necessitates one of these approaches:

**Option 1: Popup Window (Recommended)**
- Use `chrome.windows.create()` with `type: 'popup'`
- Fully functional browser window that can display Microsoft's HTML pages
- Handles automatic redirects when user is already logged into Microsoft
- Shows interactive login forms when authentication is needed
- Can display consent screens and multi-factor authentication prompts

**Option 2: WebView (Alternative)**
- Use `<webview>` tag in extension page
- More contained within extension UI
- Requires `webview` permission
- May have limitations with certain authentication flows

**Implementation Choice**: Use popup window as it provides the most reliable experience for the Microsoft OAuth flow, which includes:
- Full HTML page rendering (login forms, error pages)
- Automatic redirects when user is already authenticated
- Interactive elements (password fields, MFA prompts)
- Consent screens and terms acceptance
- Error displays from Microsoft's authentication service

### OAuth Flow Handling

```
User clicks Login
    ↓
Background creates popup window
    ↓
Loads: ${OPENWEBUI_BASE_URL}/oauth/microsoft/login
    ↓
Redirects to: https://login.microsoftonline.com/...
    ↓
Microsoft displays:
  - Login form (if not authenticated)
  - OR auto-redirects (if already logged in)
    ↓
User interacts with Microsoft's HTML page
    ↓
Microsoft redirects to: ${OPENWEBUI_BASE_URL}/oauth/microsoft/callback
    ↓
OpenWebUI sets token cookie
    ↓
Extension detects callback URL
    ↓
Extracts token from cookie
    ↓
Closes popup window
    ↓
Updates auth state
```

## State Management

### Auth State Flow

1. **Extension Startup**
   - Background worker initializes AuthService
   - Attempts to restore session from storage
   - Broadcasts initial auth state to all connected UIs

2. **User Login**
   - UI sends AUTH_LOGIN message to background
   - Background creates popup window with OAuth URL
   - Popup displays full Microsoft login pages (HTML forms)
   - Microsoft handles authentication (login form or auto-redirect)
   - Extension monitors popup for callback URL
   - On success, extracts token and closes popup
   - Updates state and broadcasts to UIs
   - UIs re-render with authenticated state

3. **Token Validation**
   - Before each API call, validate token expiration
   - If expired, attempt silent refresh
   - If refresh fails, broadcast unauthenticated state

4. **User Logout**
   - UI sends AUTH_LOGOUT message
   - Background clears all auth data
   - Broadcasts unauthenticated state
   - UIs re-render with login prompt

### React State Management

```typescript
// AuthContext provides:
interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserInfo | null;
  isLoading: boolean;
  error: AuthError | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
}

// Components use:
const { isAuthenticated, user, login, logout } = useAuth();
```

## API Client Design

### Request Flow

```
User Action
    ↓
Component calls API
    ↓
Message to Background
    ↓
API Client checks token
    ↓
Add Authorization header
    ↓
Send HTTP request
    ↓
Handle response/error
    ↓
Return to UI
```

### Error Handling

- **401 Unauthorized**: Clear auth state, prompt re-login
- **403 Forbidden**: Show permission error
- **429 Rate Limited**: Show rate limit message, retry with backoff
- **500 Server Error**: Show error, offer retry
- **Network Error**: Show connectivity error, offer retry

## Security Considerations

### Token Handling

- Tokens never exposed to UI layer
- All API calls proxied through background worker
- Automatic token expiration checking
- Tokens cleared on logout or error

### Message Validation

- Validate message types and payloads
- Rate limit message frequency
- Timeout for long-running operations

### XSS Protection

- Sanitize user-provided content
- Use React's built-in XSS protection
- Validate API responses before rendering

## UI/UX Patterns

### Loading States

- Show spinner during login flow
- Disable buttons during operations
- Display progress for long operations

### Error Display

- Non-blocking notifications for recoverable errors
- Modal dialogs for critical auth failures
- Inline error messages for form validation
- Retry buttons where appropriate

### State Persistence

- Auth state survives popup close/reopen
- Consistent state across popup and sidepanel
- Graceful handling of concurrent auth operations

## Performance Considerations

### Optimization Strategies

- Cache auth state in memory
- Debounce frequent auth checks
- Lazy load API client modules
- Minimize message passing overhead

### Memory Management

- Clean up event listeners on unmount
- Unsubscribe from auth state changes
- Clear cached data on logout

## Testing Strategy

### Unit Tests

- Auth hooks behavior
- API client request/response handling
- Message passing utilities
- Error handling logic

### Integration Tests

- Complete login/logout flows
- Token refresh scenarios
- API call with authentication
- Error recovery paths

### E2E Tests

- User can log in via popup
- User can log in via sidepanel
- Auth state persists across reopens
- Logout clears all data
- API calls work when authenticated
