/**
 * Hono OAuth 2.1 Provider
 * 
 * A modular OAuth 2.1 authorization server implementation for Hono.
 * Implements the latest OAuth 2.1 draft specification with focus on security and simplicity.
 * 
 * @packageDocumentation
 */

// Core OAuth provider middleware
export { OAuthProvider } from './oauth-provider';

// Storage adapters for different environments
export { MemoryStorage, KVStorage } from './storage';

// Essential types for configuration
export type {
  OAuth21Config,
  Storage,
  TokenExchangeCallbackOptions,
  TokenExchangeCallbackResult,
  TokenResponse,
  ErrorResponse
} from './types';