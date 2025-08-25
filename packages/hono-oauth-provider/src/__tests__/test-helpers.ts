/**
 * Test Helpers for OAuth Provider
 * 
 * Unified test utilities for consistent testing across all test files.
 */

import { Hono } from 'hono';
import { OAuthProvider as OAuthProviderMiddleware } from '../oauth-provider';
import type { OAuth21Config } from '../types';

// Export unified storage mock
export { TestStorage } from './test-helpers/TestStorage';

/**
 * Test wrapper for OAuthProvider that provides a class-based API
 * This is only used in tests to maintain compatibility with existing test structure
 */
export class OAuthProviderTestWrapper {
  private app: Hono;
  
  constructor(config: OAuth21Config) {
    this.app = new Hono();
    const middleware = OAuthProviderMiddleware(config);
    this.app.use('*', middleware);
  }
  
  getApp(): Hono {
    return this.app;
  }
}

/**
 * Create a basic OAuth configuration for testing
 */
export function createTestOAuthConfig(overrides: Partial<OAuth21Config> = {}): OAuth21Config {
  const { TestStorage: TestStorageClass } = require('./test-helpers/TestStorage');
  
  return {
    storage: new TestStorageClass(),
    issuer: 'http://localhost:8787',
    scopesSupported: ['read', 'write'],
    strictMode: true,
    ...overrides
  };
}

/**
 * Create a test client registration
 */
export function createTestClient(overrides: any = {}) {
  return {
    redirect_uris: ['https://client.example.com/callback'],
    client_name: 'Test Client',
    token_endpoint_auth_method: 'client_secret_basic',
    ...overrides
  };
}