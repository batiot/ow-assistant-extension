/**
 * Mock OpenWebUI Server for E2E Testing
 * 
 * Simulates OpenWebUI authentication endpoints for testing without a real backend.
 * Supports OAuth flow with Set-Cookie headers and token validation.
 */

import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

export type ErrorMode = 'none' | 'network' | 'invalid_token' | 'server_error' | 'config_404';

interface RequestLog {
  timestamp: number;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

interface BackendConfig {
  oauth: {
    providers: Record<string, any>;
  };
  features: {
    auth: boolean;
    enable_login_form: boolean;
  };
}

export class MockOpenWebUIServer {
  private app: Express;
  private server: Server | null = null;
  private port: number = 0;
  private errorMode: ErrorMode = 'none';
  private requestLogs: RequestLog[] = [];
  private oauthDelay: number = 100; // Default fast redirect for silent auth
  private backendConfig: BackendConfig | null = null;
  private apiDelays: Map<string, number> = new Map();

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
      this.handleTokenValidation(req, res);
    });

    // Test endpoint to set error mode
    this.app.post('/test/error-mode', express.json(), (req, res) => {
      const { mode } = req.body;
      if (mode && ['none', 'network', 'invalid_token', 'server_error', 'config_404'].includes(mode)) {
        this.setErrorMode(mode as ErrorMode);
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

    // Test endpoint to set backend config
    this.app.post('/test/backend-config', express.json(), (req, res) => {
      this.backendConfig = req.body;
      res.json({ success: true, config: this.backendConfig });
    });

    // Test endpoint to set API delays
    this.app.post('/test/api-delay', express.json(), (req, res) => {
      const { endpoint, delay } = req.body;
      if (typeof endpoint === 'string' && typeof delay === 'number' && delay >= 0) {
        this.apiDelays.set(endpoint, delay);
        res.json({ success: true, endpoint, delay });
      } else {
        res.status(400).json({ error: 'Invalid endpoint or delay value' });
      }
    });

    // Backend config endpoint
    this.app.get('/api/config', async (req, res) => {
      // Check for config_404 error mode
      if (this.errorMode === 'config_404') {
        res.status(404).json({ error: 'Config endpoint not found' });
        return;
      }

      // Apply delay if configured
      const delay = this.apiDelays.get('/api/config') || 0;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Return configured backend config or default
      if (this.backendConfig) {
        res.json(this.backendConfig);
      } else {
        // Default single provider config
        const baseUrl = `http://localhost:${this.port}`;
        res.json({
          oauth: {
            providers: {
              microsoft: {
                client_id: 'default-client-id',
                authorization_endpoint: `${baseUrl}/oauth/microsoft/login`,
                redirect_uri: `${baseUrl}/oauth/microsoft/callback`,
              },
            },
          },
          features: {
            auth: true,
            enable_login_form: false,
          },
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
   * Handle token validation - supports Bearer token and cookie
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

    // Extract token from Bearer header or cookie
    const bearerToken = req.headers.authorization?.replace('Bearer ', '');
    const cookieToken = req.cookies?.token;
    const token = bearerToken || cookieToken;

    // Check for invalid token mode or missing token
    if (this.errorMode === 'invalid_token' || !token) {
      res.status(401).json({ error: 'Invalid or missing token' });
      return;
    }

    // Validate token format (should contain 'test-' or be a valid JWT-like structure)
    if (!token.includes('test-') && !token.startsWith('eyJ')) {
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    // Return mock user data
    const response: any = {
      id: 'test-user-123',
      email: 'test.user@example.com',
      name: 'Test User',
      role: 'user',
      profile_image_url: 'https://example.com/avatar.jpg',
    };

    // If authenticated via cookie (not Bearer token), include token in response
    if (cookieToken && !bearerToken) {
      response.token = cookieToken;
    }

    res.json(response);
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
   * Reset server to default state (normal mode, clear logs, fast OAuth)
   */
  reset(): void {
    this.errorMode = 'none';
    this.oauthDelay = 100;
    this.requestLogs = [];
    this.backendConfig = null;
    this.apiDelays.clear();
  }

  /**
   * Set backend config for testing different configurations
   */
  setBackendConfig(config: BackendConfig | null): void {
    this.backendConfig = config;
  }

  /**
   * Get current backend config
   */
  getBackendConfig(): BackendConfig | null {
    return this.backendConfig;
  }

  /**
   * Set delay for specific API endpoint
   */
  setApiDelay(endpoint: string, delayMs: number): void {
    this.apiDelays.set(endpoint, delayMs);
  }

  /**
   * Clear all API delays
   */
  clearApiDelays(): void {
    this.apiDelays.clear();
  }
  }
}
