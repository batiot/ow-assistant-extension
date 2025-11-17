/**
 * Mock Server Smoke Tests
 * 
 * Basic tests to verify the mock OpenWebUI server is working correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Mock Server Tests', () => {
  test('should start mock server and respond to health check', async () => {
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    expect(mockServerUrl).toBeTruthy();
    
    const response = await fetch(`${mockServerUrl}/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  });

  test('should serve OAuth login endpoint', async () => {
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    
    const response = await fetch(`${mockServerUrl}/oauth/microsoft/login`);
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain('Redirecting');
    expect(html).toContain('/oauth/microsoft/callback');
  });

  test('should serve OAuth callback endpoint with code', async () => {
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    
    const response = await fetch(`${mockServerUrl}/oauth/microsoft/callback?code=test123`);
    expect(response.status).toBe(200);
    
    // Check Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('token=');
    expect(setCookie).toContain('eyJ'); // JWT-like format
  });

  test('should return 400 for OAuth callback without code', async () => {
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    
    const response = await fetch(`${mockServerUrl}/oauth/microsoft/callback`);
    expect(response.status).toBe(400);
  });

  test('should validate token with Bearer header', async () => {
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    
    // First get a token
    const callbackResponse = await fetch(`${mockServerUrl}/oauth/microsoft/callback?code=test123`);
    const setCookie = callbackResponse.headers.get('set-cookie');
    const token = setCookie?.match(/token=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    
    // Validate token
    const response = await fetch(`${mockServerUrl}/api/v1/auths/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('id', '16f44d75-3705-4adf-a83e-f5f6fbedf495');
    expect(data).toHaveProperty('name', 'Test User');
    expect(data).toHaveProperty('email', 'user@example.com');
  });

  test('should handle error modes', async () => {
    const mockServerUrl = process.env.MOCK_SERVER_URL;
    
    // First, get a valid token for testing
    const callbackResponse = await fetch(`${mockServerUrl}/oauth/microsoft/callback?code=test123`);
    const setCookie = callbackResponse.headers.get('set-cookie');
    const token = setCookie?.match(/token=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    
    // Test normal mode first
    const normalResponse = await fetch(`${mockServerUrl}/api/v1/auths/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(normalResponse.status).toBe(200);
    
    // Set network error mode
    await fetch(`${mockServerUrl}/test/error-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'network' }),
    });
    
    // Verify network error (503 even with valid token)
    const response1 = await fetch(`${mockServerUrl}/api/v1/auths/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response1.status).toBe(503);
    
    // Set invalid_token mode
    await fetch(`${mockServerUrl}/test/error-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'invalid_token' }),
    });
    
    // Verify invalid token error
    const response2 = await fetch(`${mockServerUrl}/api/v1/auths/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response2.status).toBe(401);
    
    // Set server_error mode
    await fetch(`${mockServerUrl}/test/error-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'server_error' }),
    });
    
    // Verify server error
    const response3 = await fetch(`${mockServerUrl}/api/v1/auths/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response3.status).toBe(500);
    
    // Reset to normal mode
    await fetch(`${mockServerUrl}/test/error-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'none' }),
    });
    
    // Verify normal operation restored
    const response4 = await fetch(`${mockServerUrl}/api/v1/auths/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response4.status).toBe(200);
  });
});
