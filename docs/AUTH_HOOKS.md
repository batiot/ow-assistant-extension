# Authentication Hooks Documentation

## Overview

The authentication hooks provide a React-based interface to the authentication system. They handle state management, message passing with the background service, and provide easy-to-use APIs for authentication operations.

## AuthProvider

The `AuthProvider` component wraps your application and provides authentication context to all child components.

### Usage

```tsx
import { AuthProvider } from '@/contexts/AuthContext';
import App from './App';

function Main() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
```

The provider should be added at the root of your popup or sidepanel:

```tsx
// src/popup/main.tsx or src/sidepanel/main.tsx
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/contexts/AuthContext';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
```

## useAuth Hook

The primary hook for accessing authentication state and operations.

### Import

```typescript
import { useAuth } from '@/contexts/AuthContext';
```

### Return Value

```typescript
interface AuthContextValue {
  isAuthenticated: boolean;      // True if user is logged in
  user: UserInfo | null;          // Current user information
  isLoading: boolean;             // True during initial state fetch
  error: AuthError | null;        // Current error if any
  login: () => Promise<void>;     // Trigger login flow
  logout: () => Promise<void>;    // Trigger logout
  retry: () => Promise<void>;     // Retry failed operation
}
```

### UserInfo Type

```typescript
interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  profile_image_url?: string;
}
```

### AuthError Type

```typescript
interface AuthError {
  message: string;
  code?: string;
  retryable?: boolean;
}
```

## Examples

### Basic Authentication UI

```tsx
import { useAuth } from '@/contexts/AuthContext';

function AuthButton() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <button disabled>Loading...</button>;
  }

  if (isAuthenticated) {
    return <button onClick={logout}>Logout</button>;
  }

  return <button onClick={login}>Login</button>;
}
```

### User Profile Display

```tsx
import { useAuth } from '@/contexts/AuthContext';

function UserProfile() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="avatar">
        {user.name?.charAt(0).toUpperCase()}
      </div>
      <div className="info">
        <div className="name">{user.name}</div>
        <div className="email">{user.email}</div>
      </div>
    </div>
  );
}
```

### Error Handling

```tsx
import { useAuth } from '@/contexts/AuthContext';

function AuthErrorDisplay() {
  const { error, retry } = useAuth();

  if (!error) {
    return null;
  }

  return (
    <div className="error">
      <p>{error.message}</p>
      {error.retryable && (
        <button onClick={retry}>Try Again</button>
      )}
    </div>
  );
}
```

### Complete Authentication Flow

```tsx
import { useAuth } from '@/contexts/AuthContext';

function App() {
  const { isAuthenticated, user, isLoading, error, login, logout, retry } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="loading">
        <Spinner />
        <p>Loading...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error">
        <h2>Authentication Error</h2>
        <p>{error.message}</p>
        {error.retryable && (
          <button onClick={retry}>Try Again</button>
        )}
      </div>
    );
  }

  // Authenticated state
  if (isAuthenticated && user) {
    return (
      <div className="authenticated">
        <header>
          <h1>Welcome, {user.name}!</h1>
          <button onClick={logout}>Logout</button>
        </header>
        <main>
          {/* Your app content */}
        </main>
      </div>
    );
  }

  // Unauthenticated state
  return (
    <div className="unauthenticated">
      <h1>Please Sign In</h1>
      <button onClick={login}>Login with Microsoft</button>
    </div>
  );
}
```

### Conditional Rendering Based on Auth

```tsx
import { useAuth } from '@/contexts/AuthContext';

function ProtectedContent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <h1>Protected Content</h1>
      <p>Only visible to authenticated users</p>
      <p>User: {user?.name}</p>
    </div>
  );
}
```

### Using with API Calls

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { createApiClient } from '@/api';
import { useEffect, useState } from 'react';

function ModelList() {
  const { isAuthenticated } = useAuth();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    async function fetchModels() {
      try {
        const client = await createApiClient();
        const response = await client.getModels();
        setModels(response.data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <p>Please log in to view models</p>;
  }

  if (loading) {
    return <p>Loading models...</p>;
  }

  return (
    <ul>
      {models.map(model => (
        <li key={model.id}>{model.name}</li>
      ))}
    </ul>
  );
}
```

## How It Works

### State Synchronization

The auth context automatically synchronizes state across all extension contexts:

1. **Initial State**: On mount, fetches current auth state from background service
2. **State Changes**: Listens for `AUTH_STATE_CHANGED` messages from background
3. **Real-time Updates**: When auth state changes in one context (popup/sidepanel), all contexts are updated immediately

```tsx
// In AuthContext implementation
useEffect(() => {
  const handleMessage = (message: any) => {
    if (message.type === 'AUTH_STATE_CHANGED') {
      setAuthState(message.payload);
      setError(null);
    }
  };

  chrome.runtime.onMessage.addListener(handleMessage);
  return () => chrome.runtime.onMessage.removeListener(handleMessage);
}, []);
```

### Login Flow

When you call `login()`:

1. Sends `AUTH_LOGIN` message to background service
2. Background service opens OAuth popup window
3. User authenticates with Microsoft
4. Background extracts token from callback URL
5. Token is validated and stored
6. Auth state is broadcast to all contexts
7. Your UI automatically updates with new auth state

### Logout Flow

When you call `logout()`:

1. Sends `AUTH_LOGOUT` message to background service
2. Background service clears stored token
3. Auth state is reset and broadcast to all contexts
4. Your UI automatically updates to unauthenticated state

## Best Practices

1. **Always wrap with AuthProvider**: Ensure your app root is wrapped with `AuthProvider`
2. **Handle loading state**: Check `isLoading` before rendering auth-dependent UI
3. **Display errors**: Show error messages to users and provide retry option when `error.retryable` is true
4. **Use conditional rendering**: Check `isAuthenticated` before showing protected content
5. **Avoid multiple auth operations**: Don't call `login()` or `logout()` while `isLoading` is true
6. **Clean error state**: Display errors but allow users to dismiss them naturally

## Testing

### Mocking the Auth Context

For unit tests, create a mock provider:

```tsx
import { AuthContext } from '@/contexts/AuthContext';

const mockAuthContext = {
  isAuthenticated: true,
  user: {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  },
  isLoading: false,
  error: null,
  login: jest.fn(),
  logout: jest.fn(),
  retry: jest.fn(),
};

function MockAuthProvider({ children }) {
  return (
    <AuthContext.Provider value={mockAuthContext}>
      {children}
    </AuthContext.Provider>
  );
}

// In your test
test('renders user name', () => {
  render(
    <MockAuthProvider>
      <UserProfile />
    </MockAuthProvider>
  );
  
  expect(screen.getByText('Test User')).toBeInTheDocument();
});
```

## Troubleshooting

### "Cannot read property 'useContext' of undefined"

**Cause**: Component is not wrapped with `AuthProvider`.

**Solution**: Ensure your app root has `AuthProvider`:

```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

### Auth state not updating

**Cause**: Message listener not properly registered or background service not running.

**Solution**: 
1. Check that background service is active in `chrome://extensions`
2. Verify no errors in background service console
3. Reload extension if needed

### Login button does nothing

**Cause**: OAuth popup may be blocked by popup blocker or base URL not configured.

**Solution**:
1. Check browser console for errors
2. Ensure OpenWebUI base URL is configured
3. Check that popup blocker is not interfering
4. Verify background service is initialized

### User data is null after login

**Cause**: Token validation may have failed or user info not properly parsed.

**Solution**:
1. Check network tab for `/api/v1/auths/` request
2. Verify response includes user information
3. Check background service console for validation errors
