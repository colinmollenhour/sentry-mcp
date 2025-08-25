/**
 * Discovery Endpoint Tests
 * 
 * Tests for OAuth 2.0 Authorization Server Metadata endpoint
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc8414 - OAuth 2.0 Authorization Server Metadata
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-3.3 - OAuth 2.1 Discovery
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { OAuthProvider } from '../../oauth-provider';
import { TestStorage, createTestOAuthConfig } from '../test-helpers';

describe('Discovery Endpoint', () => {
  let app: Hono;
  let storage: TestStorage;

  beforeEach(() => {
    storage = new TestStorage();
    const config = createTestOAuthConfig({ 
      storage,
      issuer: 'https://auth.example.com',
      scopesSupported: ['read', 'write', 'profile'] 
    });
    app = new Hono();
    app.use('*', OAuthProvider(config));
  });

  describe('GET /.well-known/oauth-authorization-server', () => {
    it('should return OAuth 2.0 authorization server metadata', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      
      const metadata = await response.json() as any;
      
      // Required fields per RFC 8414
      expect(metadata.issuer).toBe('https://auth.example.com');
      expect(metadata.authorization_endpoint).toBe('https://auth.example.com/authorize');
      expect(metadata.token_endpoint).toBe('https://auth.example.com/token');
      expect(metadata.response_types_supported).toEqual(['code']);
      expect(metadata.scopes_supported).toEqual(['read', 'write', 'profile']);
    });

    it('should include OAuth 2.1 compliant response types', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      // OAuth 2.1 only supports authorization code flow
      expect(metadata.response_types_supported).toEqual(['code']);
      expect(metadata.response_types_supported).not.toContain('token'); // No implicit flow
      expect(metadata.response_types_supported).not.toContain('id_token'); // No implicit flow
    });

    it('should include supported grant types', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.grant_types_supported).toContain('authorization_code');
      expect(metadata.grant_types_supported).toContain('refresh_token');
      
      // OAuth 2.1 deprecated grants should not be supported
      expect(metadata.grant_types_supported).not.toContain('implicit');
      expect(metadata.grant_types_supported).not.toContain('password');
    });

    it('should include PKCE support information', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.code_challenge_methods_supported).toContain('S256');
      expect(metadata.code_challenge_methods_supported).toContain('plain');
    });

    it('should include token endpoint authentication methods', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.token_endpoint_auth_methods_supported).toContain('client_secret_basic');
      expect(metadata.token_endpoint_auth_methods_supported).toContain('client_secret_post');
      expect(metadata.token_endpoint_auth_methods_supported).toContain('none'); // For public clients
    });

    it('should include additional endpoint URLs', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.registration_endpoint).toBe('https://auth.example.com/register');
      expect(metadata.introspection_endpoint).toBe('https://auth.example.com/introspect');
      expect(metadata.revocation_endpoint).toBe('https://auth.example.com/revoke');
    });

    it('should have correct content type and cache headers', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server');
      
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('Cache-Control')).toContain('public');
    });

    it('should be accessible via OPTIONS request for CORS', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server', {
        method: 'OPTIONS'
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });

  describe('Discovery with different issuer configurations', () => {
    it('should handle issuer without trailing slash', async () => {
      const config = createTestOAuthConfig({ 
        storage,
        issuer: 'https://auth.example.com', // No trailing slash
        scopesSupported: ['read'] 
      });
      const testApp = new Hono();
      testApp.use('*', OAuthProvider(config));
      
      const response = await testApp.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.issuer).toBe('https://auth.example.com');
      expect(metadata.authorization_endpoint).toBe('https://auth.example.com/authorize');
    });

    it('should handle issuer with trailing slash', async () => {
      const config = createTestOAuthConfig({ 
        storage,
        issuer: 'https://auth.example.com/', // With trailing slash
        scopesSupported: ['read'] 
      });
      const testApp = new Hono();
      testApp.use('*', OAuthProvider(config));
      
      const response = await testApp.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.issuer).toBe('https://auth.example.com/');
      expect(metadata.authorization_endpoint).toBe('https://auth.example.com/authorize');
    });

    it('should handle different port configurations', async () => {
      const config = createTestOAuthConfig({ 
        storage,
        issuer: 'https://auth.example.com:8443',
        scopesSupported: ['read'] 
      });
      const testApp = new Hono();
      testApp.use('*', OAuthProvider(config));
      
      const response = await testApp.request('/.well-known/oauth-authorization-server');
      const metadata = await response.json() as any;
      
      expect(metadata.issuer).toBe('https://auth.example.com:8443');
      expect(metadata.token_endpoint).toBe('https://auth.example.com:8443/token');
    });
  });
});