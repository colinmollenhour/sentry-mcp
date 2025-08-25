/**
 * Cloudflare KV Storage Adapter for OAuth 2.1 Provider
 * 
 * Implements Storage interface using Cloudflare Workers KV storage.
 * Suitable for production Cloudflare Workers deployments.
 * 
 * Features:
 * - Distributed, eventually consistent storage
 * - Automatic TTL support
 * - High availability and performance
 */

import type { Storage } from '../types';

/**
 * Cloudflare KV storage adapter
 * 
 * @example
 * ```typescript
 * // In Cloudflare Worker
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const storage = new KVStorage(env.OAUTH_KV);
 *     
 *     const oauth = OAuthProvider({
 *       storage,
 *       issuer: 'https://your-domain.com',
 *       scopesSupported: ['read', 'write'],
 *     });
 *     
 *     return oauth(request, env);
 *   }
 * };
 * ```
 */
export class KVStorage implements Storage {
  constructor(private kv: KVNamespace) {}

  /**
   * Get a value from Cloudflare KV storage
   * @param key Storage key
   * @param options Optional type conversion options
   */
  async get(key: string): Promise<string | null>;
  async get<T>(key: string, options: { type: 'json' }): Promise<T | null>;
  async get(key: string, options?: { type?: string }): Promise<any> {
    try {
      if (options?.type === 'json') {
        return await this.kv.get(key, { type: 'json' });
      }
      return await this.kv.get(key, { type: 'text' });
    } catch (error) {
      console.error(`[KVStorage] Failed to get key "${key}":`, error);
      return null;
    }
  }
  
  /**
   * Store a value in Cloudflare KV with optional TTL
   * @param key Storage key
   * @param value Value to store (string)
   * @param options Optional TTL configuration
   */
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      const kvOptions: KVNamespacePutOptions = {};
      
      if (options?.expirationTtl) {
        kvOptions.expirationTtl = options.expirationTtl;
      }
      
      await this.kv.put(key, value, kvOptions);
    } catch (error) {
      console.error(`[KVStorage] Failed to put key "${key}":`, error);
      throw error;
    }
  }
  
  /**
   * Delete a key from Cloudflare KV storage
   * @param key Storage key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`[KVStorage] Failed to delete key "${key}":`, error);
      throw error;
    }
  }
  
  /**
   * List keys from Cloudflare KV with optional prefix filtering
   * @param options Optional prefix filtering
   */
  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    try {
      const result = await this.kv.list(options);
      return {
        keys: result.keys.map(key => ({ name: key.name }))
      };
    } catch (error) {
      console.error(`[KVStorage] Failed to list keys:`, error);
      return { keys: [] };
    }
  }
}