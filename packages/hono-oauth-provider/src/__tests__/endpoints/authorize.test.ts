/**
 * Authorization Endpoint Tests
 * 
 * Tests for OAuth 2.1 authorization endpoint handler
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-3.1 - Authorization Endpoint
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-4.1 - OAuth 2.1 Authorization Request
 * @see https://datatracker.ietf.org/doc/html/rfc7636#section-4.3 - PKCE Code Challenge
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { OAuthProvider } from '../../oauth-provider';
import { TestStorage, createTestOAuthConfig, createTestClient } from '../test-helpers';

describe('Authorization Endpoint', () => {
  let app: Hono;
  let storage: TestStorage;

  beforeEach(() => {
    storage = new TestStorage();
    const config = createTestOAuthConfig({ storage });
    app = new Hono();
    app.use('*', OAuthProvider(config));
  });

  describe('GET /authorize', () => {
    it('should display consent form for valid authorization request', async () => {
      // Register a test client
      const clientData = createTestClient({
        redirect_uris: ['https://client.example.com/callback']
      });
      
      const registerResponse = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      expect(registerResponse.status).toBe(201);
      const client = await registerResponse.json() as any;

      // Request authorization
      const authUrl = '/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: 'https://client.example.com/callback',
        scope: 'read write',
        state: 'random-state'
      });

      const response = await app.request(authUrl);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('Authorize Application');
      expect(html).toContain(client.client_name);
    });

    it('should reject invalid client_id', async () => {
      const authUrl = '/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: 'nonexistent-client',
        redirect_uri: 'https://client.example.com/callback',
        state: 'random-state'
      });

      const response = await app.request(authUrl);
      expect(response.status).toBe(400);
      
      const error = await response.json() as any;
      expect(error.error).toBe('invalid_client');
    });

    it('should reject mismatched redirect_uri', async () => {
      // Register client with specific redirect URI
      const clientData = createTestClient({
        redirect_uris: ['https://client.example.com/callback']
      });
      
      const registerResponse = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      const client = await registerResponse.json() as any;

      // Request with different redirect URI
      const authUrl = '/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: 'https://malicious.example.com/callback', // Different URI
        state: 'random-state'
      });

      const response = await app.request(authUrl);
      expect(response.status).toBe(400);
      
      const error = await response.json() as any;
      expect(error.error).toBe('invalid_request');
      expect(error.error_description).toContain('redirect_uri');
    });

    it('should include CSRF protection in consent form', async () => {
      // Register client
      const clientData = createTestClient();
      const registerResponse = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      const client = await registerResponse.json() as any;

      const authUrl = '/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: clientData.redirect_uris[0],
        state: 'random-state'
      });

      const response = await app.request(authUrl);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('name="csrf_token"');
      expect(html).toMatch(/value="[a-zA-Z0-9+/]+".*name="csrf_token"/);
    });
  });

  describe('POST /authorize', () => {
    it('should issue authorization code on user consent', async () => {
      // Register client
      const clientData = createTestClient();
      const registerResponse = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      const client = await registerResponse.json() as any;

      // Get consent form to extract CSRF token
      const getResponse = await app.request('/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: clientData.redirect_uris[0],
        scope: 'read',
        state: 'test-state'
      }));
      
      const html = await getResponse.text();
      const csrfMatch = html.match(/name="csrf_token"[^>]*value="([^"]+)"/);
      expect(csrfMatch).toBeTruthy();
      const csrfToken = csrfMatch![1];

      // Submit consent
      const consentResponse = await app.request('/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.client_id,
          redirect_uri: clientData.redirect_uris[0],
          scope: 'read',
          state: 'test-state',
          csrf_token: csrfToken,
          consent: 'approve'
        })
      });

      expect(consentResponse.status).toBe(302);
      
      const location = consentResponse.headers.get('Location');
      expect(location).toContain('code=');
      expect(location).toContain('state=test-state');
      expect(location?.startsWith(clientData.redirect_uris[0])).toBe(true);
    });

    it('should reject consent without valid CSRF token', async () => {
      // Register client
      const clientData = createTestClient();
      const registerResponse = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      const client = await registerResponse.json() as any;

      // Submit consent with invalid CSRF token
      const consentResponse = await app.request('/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.client_id,
          redirect_uri: clientData.redirect_uris[0],
          scope: 'read',
          state: 'test-state',
          csrf_token: 'invalid-token',
          consent: 'approve'
        })
      });

      expect(consentResponse.status).toBe(400);
      
      const error = await consentResponse.json() as any;
      expect(error.error).toBe('invalid_request');
      expect(error.error_description).toContain('CSRF');
    });

    it('should handle user denial of consent', async () => {
      // Register client
      const clientData = createTestClient();
      const registerResponse = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      const client = await registerResponse.json() as any;

      // Get CSRF token
      const getResponse = await app.request('/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: clientData.redirect_uris[0],
        state: 'test-state'
      }));
      
      const html = await getResponse.text();
      const csrfToken = html.match(/name="csrf_token"[^>]*value="([^"]+)"/)![1];

      // Deny consent
      const consentResponse = await app.request('/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: client.client_id,
          redirect_uri: clientData.redirect_uris[0],
          state: 'test-state',
          csrf_token: csrfToken,
          consent: 'deny'
        })
      });

      expect(consentResponse.status).toBe(302);
      
      const location = consentResponse.headers.get('Location');
      expect(location).toContain('error=access_denied');
      expect(location).toContain('state=test-state');
      expect(location?.startsWith(clientData.redirect_uris[0])).toBe(true);
    });
  });
});