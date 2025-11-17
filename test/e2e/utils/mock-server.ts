/**
 * Mock OpenWebUI Server for E2E Testing
 * 
 * Simulates OpenWebUI authentication endpoints for testing without a real backend.
 * Supports OAuth flow with Set-Cookie headers and token validation.
 * 
 * ## Test Customization via HTTP Endpoints
 * 
 * The mock server provides HTTP endpoints for test customization, following
 * Playwright's distributed architecture where test workers run in separate
 * processes from the global mock server.
 * 
 * ### Available Test Endpoints:
 * 
 * 1. **Error Mode Control**: `POST /test/error-mode`
 *    - Set error scenarios: 'none', 'network', 'invalid_token', 'server_error'
 *    - Example: `{ "mode": "network" }`
 * 
 * 2. **OAuth Delay Control**: `POST /test/oauth-delay`
 *    - Set OAuth redirect delay in milliseconds for testing timeouts
 *    - Example: `{ "delay": 3000 }` for timeout tests, `{ "delay": 100 }` for fast/silent auth
 * 
 * 3. **Auth Scenario Control**: `POST /test/auth-scenario`
 *    - Customize authentication endpoint behavior
 *    - Scenarios:
 *      - 'default': Accept token from Bearer header or Cookie (normal behavior)
 *      - 'require-cookie-header': Only validate token from Cookie header (HttpOnly cookie tests)
 *      - 'require-bearer-token': Only validate token from Authorization Bearer header
 *      - 'missing-token': Always return 401 (simulate unauthenticated state)
 *      - 'custom-user': Return different user data (admin role with full permissions)
 *    - Example: `{ "scenario": "require-cookie-header" }`
 * 
 * ### Usage in E2E Tests:
 * 
 * ```typescript
 * // Set auth scenario via HTTP
 * await fetch(`${mockServerUrl}/test/auth-scenario`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ scenario: 'require-cookie-header' }),
 * });
 * 
 * // Reset to default after test
 * await fetch(`${mockServerUrl}/test/auth-scenario`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ scenario: 'default' }),
 * });
 * ```
 * 
 * ### Why HTTP Endpoints vs Direct Method Calls:
 * 
 * Playwright's global setup runs in a separate process from test workers.
 * The mock server instance created in global-setup.ts is not directly
 * accessible from test files due to process isolation. HTTP endpoints
 * allow tests to configure the mock server across process boundaries.
 * 
 * Methods like `setRouteHandler()` are available for unit/integration tests
 * that create their own mock server instance, but E2E tests should use
 * HTTP endpoints for configuration.
 */

import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

export type ErrorMode = 'none' | 'network' | 'invalid_token' | 'server_error';

/**
 * Predefined test scenarios for /api/v1/auths/ endpoint
 * 
 * These scenarios allow E2E tests to customize authentication behavior
 * via the /test/auth-scenario HTTP endpoint.
 * 
 * Note: The mock server now matches real OpenWebUI backend behavior,
 * which only accepts tokens via Authorization: Bearer header.
 * 
 * @example
 * POST /test/auth-scenario
 * { "scenario": "require-bearer-token" }
 */
export type AuthTestScenario = 
  | 'require-bearer-token'       // Only accept token from Authorization Bearer header (default, matches real backend)
  | 'missing-token'              // Return 401 as if no token present
  | 'custom-user';               // Return a different test user (admin with full permissions)

interface RequestLog {
  timestamp: number;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

export class MockOpenWebUIServer {
  private app: Express;
  private server: Server | null = null;
  private port: number = 0;
  private errorMode: ErrorMode = 'none';
  private requestLogs: RequestLog[] = [];
  private oauthDelay: number = 100; // Default fast redirect for silent auth
  private customRouteHandlers: Map<string, (req: Request, res: Response) => void> = new Map();
  private authTestScenario: AuthTestScenario = 'require-bearer-token';

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Parse cookies
    this.app.use(cookieParser());
    
    // Log all requests
    this.app.use((req, _res, next) => {
      this.requestLogs.push({
        timestamp: Date.now(),
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', mode: this.errorMode });
    });

    // OAuth Microsoft login endpoint
    this.app.get('/oauth/microsoft/login', (req, res) => {
      // Support optional delay parameter in URL query, otherwise use configured delay
      const delay = req.query.delay ? parseInt(req.query.delay as string, 10) : this.oauthDelay;
      this.handleOAuthLogin(res, delay);
    });

    // OAuth callback endpoint
    this.app.get('/oauth/microsoft/callback', (req, res) => {
      this.handleOAuthCallback(req, res);
    });

    // Token validation endpoint
    this.app.get('/api/v1/auths/', (req, res) => {
      // Check if there's a custom handler for this route
      const customHandler = this.customRouteHandlers.get('/api/v1/auths/');
      if (customHandler) {
        customHandler(req, res);
      } else {
        this.handleTokenValidation(req, res);
      }
    });

    // Test endpoint to set error mode
    this.app.post('/test/error-mode', express.json(), (req, res) => {
      const { mode } = req.body;
      if (mode && ['none', 'network', 'invalid_token', 'server_error'].includes(mode)) {
        this.setErrorMode(mode as 'none' | 'network' | 'invalid_token' | 'server_error');
        res.json({ success: true, mode: this.errorMode });
      } else {
        res.status(400).json({ error: 'Invalid error mode' });
      }
    });

    // Test endpoint to set OAuth delay
    this.app.post('/test/oauth-delay', express.json(), (req, res) => {
      const { delay } = req.body;
      if (typeof delay === 'number' && delay >= 0) {
        this.setOAuthDelay(delay);
        res.json({ success: true, delay: this.oauthDelay });
      } else {
        res.status(400).json({ error: 'Invalid delay value' });
      }
    });

    // Test endpoint to set auth test scenario
    this.app.post('/test/auth-scenario', express.json(), (req, res) => {
      const { scenario } = req.body;
      const validScenarios: AuthTestScenario[] = [
        'require-bearer-token',
        'missing-token',
        'custom-user'
      ];
      
      if (scenario && validScenarios.includes(scenario)) {
        this.authTestScenario = scenario as AuthTestScenario;
        res.json({ success: true, scenario: this.authTestScenario });
      } else {
        res.status(400).json({ 
          error: 'Invalid auth scenario',
          validScenarios,
          received: scenario
        });
      }
    });
  }

  /**
   * Handle OAuth login - returns HTML that auto-redirects
   * Supports configurable delay parameter for testing timeouts
   */
  private handleOAuthLogin(res: Response, delay: number): void {
    const baseUrl = `http://localhost:${this.port}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mock Microsoft Login</title>
        </head>
        <body>
          <h1>Mock Microsoft Login</h1>
          <p>Redirecting to authentication...</p>
          <script>
            // Auto-redirect after ${delay}ms to simulate OAuth flow
            setTimeout(function() {
              window.location.href = '${baseUrl}/oauth/microsoft/callback?code=mock-auth-code-${Date.now()}';
            }, ${delay});
          </script>
        </body>
      </html>
    `;
    res.send(html);
  }

  /**
   * Handle OAuth callback - sets cookie with token
   */
  private handleOAuthCallback(req: Request, res: Response): void {
    const code = req.query.code as string;

    if (!code) {
      res.status(400).send('Missing authorization code');
      return;
    }

    // Generate test token with JWT-like format
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-${Date.now()}.signature`;

    // Set cookie with token
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to false for localhost testing
      sameSite: 'lax',
      path: '/',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
        </head>
        <body>
          <h1>Authentication Successful</h1>
          <p>You can close this window.</p>
          <script>
            // Give extension time to read the cookie, then close
            setTimeout(function() {
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `;
    res.send(html);
  }

  /**
   * Handle token validation - Bearer token only (matches real OpenWebUI backend)
   * 
   * The real OpenWebUI backend only validates tokens from the Authorization: Bearer header.
   * Cookie headers are completely ignored. This mock server now matches that behavior.
   * 
   * Behavior can be customized via auth test scenarios for error testing.
   * 
   * @see AuthTestScenario for available test scenarios
   */
  private handleTokenValidation(req: Request, res: Response): void {
    // Check for network error mode
    if (this.errorMode === 'network') {
      res.status(503).json({ error: 'Service unavailable' });
      return;
    }

    // Check for server error mode
    if (this.errorMode === 'server_error') {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Handle test scenarios
    if (this.authTestScenario === 'missing-token') {
      res.status(401).json({ detail: 'Not authenticated' });
      return;
    }

    // Extract token from Bearer header ONLY (matching real backend)
    const token = req.headers.authorization?.replace('Bearer ', '');

    // Check for invalid token mode or missing token
    if (this.errorMode === 'invalid_token' || !token) {
      res.status(401).json({ detail: 'Not authenticated' });
      return;
    }

    // Validate token format (should contain 'test-' or be a valid JWT-like structure)
    if (!token.includes('test-') && !token.startsWith('eyJ')) {
      res.status(401).json({ detail: 'Not authenticated' });
      return;
    }

    // Return different user data based on scenario
    const response = this.authTestScenario === 'custom-user' 
      ? this.getCustomUserResponse(token)
      : this.getDefaultUserResponse(token);

    res.json(response);
  }

  /**
   * Get default user response
   * 
   * Returns a standard test user with basic permissions.
   * This matches the real OpenWebUI API contract.
   */
  private getDefaultUserResponse(token: string) {
    return {
      id: '16f44d75-3705-4adf-a83e-f5f6fbedf495',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
      profile_image_url: '/user.png',
      token: token,
      token_type: 'Bearer',
      expires_at: null,
      permissions: {
        workspace: {
          models: false,
          knowledge: false,
          prompts: false,
          tools: false,
        },
        sharing: {
          public_models: false,
          public_knowledge: false,
          public_prompts: false,
          public_tools: false,
          public_notes: false,
        },
        chat: {
          controls: true,
          valves: true,
          system_prompt: true,
          params: true,
          file_upload: true,
          delete: true,
          delete_message: true,
          continue_response: true,
          regenerate_response: true,
          rate_response: true,
          edit: true,
          share: true,
          export: true,
          stt: true,
          tts: true,
          call: true,
          multiple_models: true,
          temporary: true,
          temporary_enforced: false,
        },
        features: {
          direct_tool_servers: false,
          web_search: true,
          image_generation: true,
          code_interpreter: true,
          notes: true,
        },
      },
      bio: null,
      gender: null,
      date_of_birth: null,
    };
  }

  /**
   * Get custom user response for testing
   * 
   * Returns a test user with admin role and full permissions.
   * Used to test permission-based features and admin functionality.
   */
  private getCustomUserResponse(token: string) {
    return {
      id: 'custom-test-user-123',
      email: 'custom@example.com',
      name: 'Custom Test User',
      role: 'admin',
      profile_image_url: '/custom-user.png',
      token: token,
      token_type: 'Bearer',
      expires_at: null,
      permissions: {
        workspace: {
          models: true,
          knowledge: true,
          prompts: true,
          tools: true,
        },
        sharing: {
          public_models: true,
          public_knowledge: true,
          public_prompts: true,
          public_tools: true,
          public_notes: true,
        },
        chat: {
          controls: true,
          valves: true,
          system_prompt: true,
          params: true,
          file_upload: true,
          delete: true,
          delete_message: true,
          continue_response: true,
          regenerate_response: true,
          rate_response: true,
          edit: true,
          share: true,
          export: true,
          stt: true,
          tts: true,
          call: true,
          multiple_models: true,
          temporary: true,
          temporary_enforced: false,
        },
        features: {
          direct_tool_servers: true,
          web_search: true,
          image_generation: true,
          code_interpreter: true,
          notes: true,
        },
      },
      bio: 'Custom test user for E2E testing',
      gender: null,
      date_of_birth: null,
    };
  }

  /**
   * Start the mock server on a random available port
   */
  async start(port?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const targetPort = port || 0; // 0 = random available port
        this.server = this.app.listen(targetPort, () => {
          const address = this.server!.address();
          if (address && typeof address === 'object') {
            this.port = address.port;
            console.log(`Mock OpenWebUI server started on port ${this.port}`);
            resolve();
          } else {
            reject(new Error('Failed to get server address'));
          }
        });

        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Mock OpenWebUI server stopped');
          this.server = null;
          this.port = 0;
          resolve();
        }
      });
    });
  }

  /**
   * Get the base URL of the mock server
   */
  getBaseUrl(): string {
    if (!this.server || this.port === 0) {
      throw new Error('Server is not running');
    }
    return `http://localhost:${this.port}`;
  }

  /**
   * Get the port the server is running on
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Set error mode for testing error scenarios
   */
  setErrorMode(mode: ErrorMode): void {
    this.errorMode = mode;
  }

  /**
   * Get current error mode
   */
  getErrorMode(): ErrorMode {
    return this.errorMode;
  }

  /**
   * Set OAuth redirect delay for testing silent auth timeout scenarios
   * @param delayMs Delay in milliseconds (100ms = fast/silent auth, 3000ms = timeout)
   */
  setOAuthDelay(delayMs: number): void {
    this.oauthDelay = delayMs;
  }

  /**
   * Get current OAuth redirect delay
   */
  getOAuthDelay(): number {
    return this.oauthDelay;
  }

  /**
   * Get request logs for debugging
   */
  getRequestLogs(): RequestLog[] {
    return [...this.requestLogs];
  }

  /**
   * Clear request logs
   */
  clearRequestLogs(): void {
    this.requestLogs = [];
  }

  /**
   * Set a custom route handler for a specific path
   * 
   * This allows tests to override default behavior for specific endpoints.
   * 
   * **Note**: This method is only useful for unit/integration tests that
   * create their own MockOpenWebUIServer instance. E2E tests using the
   * global mock server should use HTTP endpoints (like /test/auth-scenario)
   * instead due to Playwright's process isolation.
   * 
   * @param path The route path (e.g., '/api/v1/auths/')
   * @param handler The custom handler function
   * 
   * @example
   * // In a unit test
   * const server = new MockOpenWebUIServer();
   * await server.start();
   * server.setRouteHandler('/api/v1/auths/', (req, res) => {
   *   res.json({ custom: 'response' });
   * });
   */
  setRouteHandler(path: string, handler: (req: Request, res: Response) => void): void {
    this.customRouteHandlers.set(path, handler);
  }

  /**
   * Clear a custom route handler for a specific path
   * @param path The route path to clear
   */
  clearRouteHandler(path: string): void {
    this.customRouteHandlers.delete(path);
  }

  /**
   * Clear all custom route handlers
   */
  clearAllRouteHandlers(): void {
    this.customRouteHandlers.clear();
  }

  /**
   * Reset server to default state (normal mode, clear logs, fast OAuth)
   * 
   * Resets all customizable settings:
   * - Error mode to 'none'
   * - OAuth delay to 100ms (fast/silent auth)
   * - Clears request logs
   * - Clears custom route handlers
   * - Auth test scenario to 'default'
   */
  reset(): void {
    this.errorMode = 'none';
    this.oauthDelay = 100;
    this.requestLogs = [];
    this.customRouteHandlers.clear();
    this.authTestScenario = 'default';
  }
}

/**
 * Helper to setup and start the mock server for E2E tests
 */
export async function setupMockServer(port?: number): Promise<MockOpenWebUIServer> {
  const server = new MockOpenWebUIServer();
  await server.start(port);
  return server;
}
