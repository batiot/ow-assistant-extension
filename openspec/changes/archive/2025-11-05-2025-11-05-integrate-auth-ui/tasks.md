# Tasks

1. **Setup Configuration Management**
   - [x] Create environment configuration module
   - [x] Add OpenWebUI base URL configuration
   - [x] Implement configuration validation
   - [ ] Add configuration UI in extension options

2. **Implement Background Service Integration**
   - [x] Initialize AuthService on extension startup
   - [x] Implement message passing for auth operations
   - [x] Add token validation on startup
   - [x] Handle extension lifecycle events
   - [x] Implement popup window creation for OAuth flow
   - [x] Add URL monitoring to detect callback from Microsoft OAuth

3. **Create Auth Context and Hooks**
   - [x] Implement AuthContext with React Context API
   - [x] Create useAuth hook for components
   - [x] Add useAuthState hook for state subscription
   - [x] Implement message passing between UI and background

4. **Build Authentication UI Components**
   - [x] Create LoginButton component
   - [x] Create UserProfile component
   - [x] Create AuthStatus component with loading states
   - [x] Create ErrorDisplay component for auth errors
   - [x] Add logout functionality

5. **Integrate Auth UI into Popup**
   - [x] Replace placeholder content with auth UI
   - [x] Add AuthProvider wrapper
   - [x] Implement conditional rendering based on auth state
   - [x] Add error boundaries

6. **Integrate Auth UI into Sidepanel**
   - [x] Replace placeholder content with auth UI
   - [x] Add AuthProvider wrapper
   - [x] Implement conditional rendering based on auth state
   - [x] Ensure state sync with popup

7. **Create OpenWebUI API Client**
   - [x] Implement base HTTP client with fetch
   - [x] Add automatic token injection interceptor
   - [x] Implement request/response error handling
   - [ ] Add retry logic for failed requests
   - [x] Create typed API endpoints

8. **Implement API Integration**
   - [x] Add completion API endpoint
   - [x] Add user info retrieval
   - [x] Implement token refresh on 401 errors
   - [x] Add request queuing during auth

9. **Testing**
   - [ ] Unit tests for auth hooks
   - [ ] Unit tests for API client
   - [ ] Integration tests for auth flow
   - [ ] E2E tests for login/logout workflow
   - [ ] Test error scenarios

10. **Documentation**
    - [x] Update README with setup instructions
    - [x] Document configuration options
    - [x] Add API client usage examples
    - [x] Document auth hooks API

## Dependencies

- Task 1 must complete before Task 2
- Task 2 must complete before Tasks 3-4
- Task 3 must complete before Tasks 5-6
- Task 7 must complete before Task 8
- Tasks 5-6 can be done in parallel
- Task 9 depends on Tasks 1-8
- Task 10 can be done in parallel with Task 9

## Validation Criteria

- [x] Users can log in via popup or sidepanel
- [x] Auth state persists across popup reopens
- [x] Logout clears all auth data
- [x] Error messages display clearly
- [x] Loading states show during auth operations
- [x] API calls include authentication tokens
- [x] 401 errors trigger re-authentication
- [ ] All tests pass
- [x] Documentation is complete
