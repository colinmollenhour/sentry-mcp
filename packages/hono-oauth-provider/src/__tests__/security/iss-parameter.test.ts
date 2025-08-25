/**
 * RFC 9207: OAuth 2.0 Authorization Server Issuer Identification Tests
 * 
 * Tests the implementation of the 'iss' parameter in authorization responses
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9207 - OAuth 2.0 Authorization Server Issuer Identification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OAuthProviderTestWrapper as OAuthProvider, TestStorage } from '../test-helpers';

describe('RFC 9207: Authorization Server Issuer Identification', () => {
  let provider: OAuthProvider;
  let storage: TestStorage;
  let app: any;
  let testClient: any;

  beforeEach(async () => {
    storage = new TestStorage();
    provider = new OAuthProvider({
      storage,
      issuer: 'http://localhost:8787',
      scopesSupported: ['read', 'write'],
      strictMode: false, // Disable strict mode to allow localhost redirects in tests
    });
    app = provider.getApp();

    // Register test client with external redirect URI
    const response = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Test Client',
        redirect_uris: ['https://client.example.com/callback'],
      }),
    });
    testClient = await response.json() as any;
  });

  describe('Discovery Metadata', () => {
    it('should advertise iss parameter support in discovery metadata', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      
      expect(response.status).toBe(200);
      const metadata = await response.json() as any;
      expect(metadata.authorization_response_iss_parameter_supported).toBe(true);
    });
  });

  describe('Authorization Response with ISS Parameter', () => {
    it('should include iss parameter in successful authorization code response', async () => {
      // Create valid CSRF token
      const csrfToken = 'test-csrf-success';
      await storage.put(`csrf:${csrfToken}`, JSON.stringify({
        clientId: testClient.client_id,
        redirectUri: 'https://client.example.com/callback',
        expiresAt: Date.now() + 600000,
      }));

      // Mock user consent form submission (successful authorization)
      const response = await app.request('/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'approve',
          csrf_token: csrfToken,
          client_id: testClient.client_id,
          redirect_uri: 'https://client.example.com/callback',
          scope: 'read',
          state: 'test-state',
        }).toString(),
      });

      // Should redirect with iss parameter
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      
      const redirectUrl = new URL(location!);
      expect(redirectUrl.searchParams.get('iss')).toBe('http://localhost:8787');
      expect(redirectUrl.searchParams.get('code')).toBeTruthy();
      expect(redirectUrl.searchParams.get('state')).toBe('test-state');
    });

    it('should include iss parameter in error responses (access denied)', async () => {
      // Create valid CSRF token
      const csrfToken = 'test-csrf-deny';
      await storage.put(`csrf:${csrfToken}`, JSON.stringify({
        clientId: testClient.client_id,
        redirectUri: 'https://client.example.com/callback',
        expiresAt: Date.now() + 600000,
      }));

      // Mock user consent form submission (user denies access)
      const response = await app.request('/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'deny',
          csrf_token: csrfToken,
          client_id: testClient.client_id,
          redirect_uri: 'https://client.example.com/callback',
          scope: 'read',
          state: 'test-state',
        }).toString(),
      });

      // Should redirect with error and iss parameter
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      
      const redirectUrl = new URL(location!);
      expect(redirectUrl.searchParams.get('iss')).toBe('http://localhost:8787');
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectUrl.searchParams.get('state')).toBe('test-state');
    });

    it('should include iss parameter in PKCE error responses for public clients', async () => {
      // Create a strict mode provider for this test
      const strictStorage = new TestStorage();
      const strictProvider = new OAuthProvider({
        storage: strictStorage,
        issuer: 'http://localhost:8787',
        scopesSupported: ['read', 'write'],
        strictMode: true, // Enable strict mode for PKCE enforcement
      });
      const strictApp = strictProvider.getApp();

      // Register a public client (no secret) with strict provider
      const pubResponse = await strictApp.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Public Client',
          redirect_uris: ['https://client.example.com/callback'],
          token_endpoint_auth_method: 'none',
        }),
      });
      const publicClient = await pubResponse.json() as any;

      // Try authorization without PKCE (should fail)
      const response = await strictApp.request('/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: publicClient.client_id,
        redirect_uri: 'https://client.example.com/callback',
        state: 'test-state',
      }).toString());

      // Should redirect with PKCE error and iss parameter
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      
      const redirectUrl = new URL(location!);
      expect(redirectUrl.searchParams.get('iss')).toBe('http://localhost:8787');
      expect(redirectUrl.searchParams.get('error')).toBe('invalid_request');
      expect(redirectUrl.searchParams.get('error_description')).toContain('PKCE');
      expect(redirectUrl.searchParams.get('state')).toBe('test-state');
    });

    it('should use correct issuer value from config', async () => {
      // Create provider with different issuer
      const customStorage = new TestStorage();
      const customProvider = new OAuthProvider({
        storage: customStorage,
        issuer: 'https://auth.example.com',
        scopesSupported: ['read'],
        strictMode: true,
      });
      const customApp = customProvider.getApp();

      // Register client with custom provider
      const regResponse = await customApp.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Test Client',
          redirect_uris: ['https://client.example.com/callback'],
        }),
      });
      const customClient = await regResponse.json() as any;

      // Create valid CSRF token for custom app
      const csrfToken = 'test-csrf-custom';
      await customStorage.put(`csrf:${csrfToken}`, JSON.stringify({
        clientId: customClient.client_id,
        redirectUri: 'https://client.example.com/callback',
        expiresAt: Date.now() + 600000,
      }));

      // Test authorization with custom issuer
      const response = await customApp.request('/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'approve',
          csrf_token: csrfToken,
          client_id: customClient.client_id,
          redirect_uri: 'https://client.example.com/callback',
          scope: 'read',
        }).toString(),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      const redirectUrl = new URL(location!);
      expect(redirectUrl.searchParams.get('iss')).toBe('https://auth.example.com');
    });
  });

  describe('ISS Parameter Validation Requirements', () => {
    it('should include iss parameter in all authorization responses per RFC 9207', async () => {
      // Test that iss is included in both success and error cases
      // This test validates that we follow RFC 9207 requirement:
      // "Authorization servers supporting this specification MUST include the iss parameter in all authorization responses"
      
      const testCases = [
        {
          name: 'successful authorization',
          action: 'approve',
          expectCode: true,
        },
        {
          name: 'access denied',
          action: 'deny',
          expectError: 'access_denied',
        }
      ];

      for (const testCase of testCases) {
        // Create valid CSRF token for each test case
        const csrfToken = `test-csrf-${testCase.name.replace(' ', '-')}`;
        await storage.put(`csrf:${csrfToken}`, JSON.stringify({
          clientId: testClient.client_id,
          redirectUri: 'https://client.example.com/callback',
          expiresAt: Date.now() + 600000,
        }));

        const response = await app.request('/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            action: testCase.action,
            csrf_token: csrfToken,
            client_id: testClient.client_id,
            redirect_uri: 'https://client.example.com/callback',
            scope: 'read',
            state: `test-state-${testCase.name}`,
          }).toString(),
        });

        expect(response.status, `Expected 302 but got ${response.status} for ${testCase.name}`).toBe(302);
        const location = response.headers.get('location');
        const redirectUrl = new URL(location!);
        
        // ISS parameter MUST be present
        expect(redirectUrl.searchParams.get('iss'), `ISS parameter missing for ${testCase.name}`).toBe('http://localhost:8787');
        
        // Verify expected response parameters
        if (testCase.expectCode) {
          expect(redirectUrl.searchParams.get('code')).toBeTruthy();
        }
        if (testCase.expectError) {
          expect(redirectUrl.searchParams.get('error')).toBe(testCase.expectError);
        }
      }
    });
  });
});