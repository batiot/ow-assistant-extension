/**
 * Mock OpenWebUI Server for E2E Testing
 * 
 * Simulates OpenWebUI authentication endpoints for testing without a real backend.
 * Supports OAuth flow with Set-Cookie headers and token validation.
 */

import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'http';

export type ErrorMode = 'none' | 'network' | 'invalid_token' | 'server_error';

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
    this.app.get('/oauth/microsoft/login', (_req, res) => {
      this.handleOAuthLogin(res);
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
      if (mode && ['none', 'network', 'invalid_token', 'server_error'].includes(mode)) {
        this.setErrorMode(mode as 'none' | 'network' | 'invalid_token' | 'server_error');
        res.json({ success: true, mode: this.errorMode });
      } else {
        res.status(400).json({ error: 'Invalid error mode' });
      }
    });
  }

  /**
   * Handle OAuth login - returns HTML that auto-redirects
   */
  private handleOAuthLogin(res: Response): void {
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
            // Auto-redirect after 100ms to simulate OAuth flow
            setTimeout(function() {
              window.location.href = '${baseUrl}/oauth/microsoft/callback?code=mock-auth-code-${Date.now()}';
            }, 100);
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
   * Reset server to default state (normal mode, clear logs)
   */
  reset(): void {
    this.errorMode = 'none';
    this.requestLogs = [];
  }
}
