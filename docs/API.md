# OpenWebUI API Client Documentation

## Overview

The API client provides a typed interface to interact with the OpenWebUI backend. It automatically handles authentication token injection, error handling, and streaming responses.

## Backend Configuration

### Get Backend Configuration

Fetch backend configuration to determine available authentication methods and features. This endpoint is public and doesn't require authentication.

```typescript
import { getBackendConfig } from '@/api';

const baseUrl = 'https://your-openwebui.com';
const config = await getBackendConfig(baseUrl);

if (config) {
  console.log('Auth enabled:', config.features.auth);
  console.log('Providers:', Object.keys(config.oauth.providers));
  console.log('Login form:', config.features.enable_login_form);
}
```

**Endpoint**: `GET /api/config`

**Response Format**:
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

**Field Descriptions**:
- `oauth.providers`: Map of available OAuth providers (provider name → provider identifier)
- `features.auth`: Whether authentication is required for this backend
- `features.enable_login_form`: Whether username/password login form is available

**Error Handling**:
- Returns `null` if endpoint not found (404) or on network error
- Logs warnings to console for debugging
- Extension should use sensible defaults when config unavailable

### Authentication Check

Check if a user is currently authenticated and retrieve user information. This endpoint can be used in two ways:

#### 1. Token Validation (with Authorization header)
Validate an existing token and get user information:

```typescript
import { createApiClient } from '@/api';

try {
  const client = await createApiClient();
  const user = await client.validateToken();
  console.log('Authenticated as:', user.name, user.email);
} catch (error) {
  console.log('Not authenticated or token invalid');
}
```

**Headers Required**:
```
Authorization: Bearer <token>
```

#### 2. Session Detection (without Authorization header)
Check for existing browser session and extract token. The browser automatically sends HTTP-only cookies:

```typescript
const response = await fetch(`${baseUrl}/api/v1/auths/`, {
  method: 'GET',
  credentials: 'include', // Includes HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

if (response.ok) {
  const data = await response.json();
  const token = data.token; // Extract token from response
  console.log('Session exists, token:', token);
}
```

**Use Case**: Extensions cannot read HTTP-only cookies directly via `chrome.cookies.getAll()`. This endpoint allows the extension to detect existing browser sessions by calling the API without authentication headers. If a valid session cookie exists, the server returns the token in the response body.

**Endpoint**: `GET /api/v1/auths/`

**Success Response** (200 OK):
```json
{
  "id": "16f44d75-3705-4adf-a83e-f5f6fbedf495",
  "email": "user@example.com",
  "name": "User Name",
  "role": "admin",
  "profile_image_url": "/user.png",
  "token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_at": null,
  "permissions": {},
  "bio": null,
  "gender": null,
  "date_of_birth": null
}
```

**Field Descriptions**:
- `id`: Unique user identifier (UUID)
- `email`: User's email address
- `name`: User's display name
- `role`: User's role (e.g., "admin", "user")
- `profile_image_url`: Path to user's profile image or base64-encoded image
- `token`: JWT token (returned even without Authorization header if session exists)
- `token_type`: Token type, always "Bearer"
- `expires_at`: Token expiration (null = session-based, backend validates)
- `permissions`: User permission map (optional)
- `bio`: User biography (optional)
- `gender`: User gender (optional)
- `date_of_birth`: User date of birth (optional)

**Error Response** (401 Unauthorized):
User is not authenticated or token is invalid/expired.

## Installation

The API client is available through the `@/api` module:

```typescript
import { createApiClient, OpenWebUIClient } from '@/api';
import type { ChatCompletionRequest, ChatMessage } from '@/api';
```

## Creating a Client

### Factory Function (Recommended)

The factory function automatically retrieves configuration and token from storage:

```typescript
import { createApiClient } from '@/api';

try {
  const client = await createApiClient();
  // Client is ready to use
} catch (error) {
  if (error.message === 'OpenWebUI base URL not configured') {
    // Prompt user to configure base URL
  } else if (error.message === 'Not authenticated') {
    // Prompt user to log in
  }
}
```

### Manual Construction

If you need more control, create the client directly:

```typescript
import { OpenWebUIClient } from '@/api';

const baseUrl = 'https://your-openwebui.com';
const token = 'your-jwt-token';

const client = new OpenWebUIClient(baseUrl, token);
```

## API Methods

### Token Validation

Validates the current token and retrieves user information:

```typescript
const userInfo = await client.validateToken();

console.log(userInfo);
// {
//   id: "user-123",
//   email: "user@example.com",
//   name: "John Doe",
//   role: "user",
//   profile_image_url: "https://..."
// }
```

### Get Available Models

Retrieves the list of available AI models:

```typescript
const modelsResponse = await client.getModels();

console.log(modelsResponse);
// {
//   data: [
//     { id: "gpt-4", name: "GPT-4", ... },
//     { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", ... }
//   ]
// }
```

### Chat Completion

Send a chat completion request:

```typescript
const request: ChatCompletionRequest = {
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  stream: false
};

const response = await client.chatCompletion(request);

console.log(response);
// {
//   id: "chatcmpl-123",
//   choices: [
//     {
//       index: 0,
//       message: { role: "assistant", content: "The capital of France is Paris." },
//       finish_reason: "stop"
//     }
//   ],
//   ...
// }
```

### Streaming Chat Completion

For real-time streaming responses:

```typescript
const request: ChatCompletionRequest = {
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ],
  stream: true
};

try {
  for await (const chunk of client.streamChatCompletion(request)) {
    // Parse the SSE data
    const data = JSON.parse(chunk);
    
    // Extract the delta content
    const content = data.choices[0]?.delta?.content;
    if (content) {
      console.log(content); // Print token by token
    }
  }
} catch (error) {
  console.error('Streaming error:', error);
}
```

## Error Handling

The API client throws `ApiError` for HTTP errors:

```typescript
import { createApiClient } from '@/api';

try {
  const client = await createApiClient();
  const response = await client.chatCompletion(request);
} catch (error) {
  if (error.name === 'ApiError') {
    console.error(`API Error ${error.statusCode}: ${error.message}`);
    console.error('Response:', error.response);
    
    if (error.statusCode === 401) {
      // Handle authentication error
    } else if (error.statusCode === 429) {
      // Handle rate limiting
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Using in Background Service

The background service handles API requests from UI contexts:

```typescript
// From UI (popup/sidepanel)
const response = await chrome.runtime.sendMessage({
  type: 'API_REQUEST',
  payload: {
    endpoint: '/api/models',
    method: 'GET'
  }
});

console.log(response); // Model list
```

For chat completions:

```typescript
const response = await chrome.runtime.sendMessage({
  type: 'API_REQUEST',
  payload: {
    endpoint: '/api/chat/completions',
    method: 'POST',
    body: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    }
  }
});
```

## Type Definitions

### ChatMessage

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

### ChatCompletionRequest

```typescript
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}
```

### ChatCompletionResponse

```typescript
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
}
```

### Model

```typescript
interface Model {
  id: string;
  name: string;
  object: string;
  created: number;
  owned_by: string;
}
```

### UserValidationResponse

```typescript
interface UserValidationResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  profile_image_url?: string;
}
```

### ApiError

```typescript
class ApiError extends Error {
  statusCode: number;
  response?: any;
}
```

## Best Practices

1. **Always use createApiClient()**: Let the factory handle configuration and token retrieval
2. **Handle errors gracefully**: Check for authentication and configuration errors
3. **Use streaming for long responses**: Better UX with real-time output
4. **Validate tokens**: Call `validateToken()` after creating the client to ensure token is still valid
5. **Type safety**: Import and use the provided TypeScript types

## Example: Complete Chat Flow

```typescript
import { createApiClient } from '@/api';
import type { ChatMessage } from '@/api';

async function sendChatMessage(userMessage: string) {
  try {
    // Create client
    const client = await createApiClient();
    
    // Validate token
    const user = await client.validateToken();
    console.log(`Logged in as ${user.name}`);
    
    // Get available models
    const models = await client.getModels();
    const model = models.data[0]?.id || 'gpt-4';
    
    // Build message history
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: userMessage }
    ];
    
    // Stream response
    console.log('Assistant: ');
    for await (const chunk of client.streamChatCompletion({ model, messages })) {
      const data = JSON.parse(chunk);
      const content = data.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log('\n');
    
  } catch (error) {
    if (error.message === 'Not authenticated') {
      console.error('Please log in first');
    } else if (error.name === 'ApiError') {
      console.error(`API Error: ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Usage
sendChatMessage('What is TypeScript?');
```
