/**
 * In-Memory Storage Adapter for OAuth 2.1 Provider
 * 
 * Implements Storage interface using in-memory Map storage.
 * Suitable for development, testing, and single-instance deployments.
 * 
 * ⚠️ Data is lost when the process restarts
 */

import type { Storage } from '../types';

export class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  private ttls = new Map<string, number>();

  /**
   * Get a value from storage
   * @param key Storage key
   * @param options Optional type conversion options
   */
  async get(key: string): Promise<string | null>;
  async get<T>(key: string, options: { type: 'json' }): Promise<T | null>;
  async get(key: string, options?: { type?: string }): Promise<any> {
    // Check TTL expiration
    const ttl = this.ttls.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }

    const value = this.store.get(key);
    if (value === undefined) return null;
    
    if (options?.type === 'json') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.error(`[MemoryStorage] Failed to parse JSON for key "${key}":`, error);
        return null;
      }
    }
    
    return value;
  }
  
  /**
   * Store a value with optional TTL
   * @param key Storage key
   * @param value Value to store (string)
   * @param options Optional TTL configuration
   */
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    
    if (options?.expirationTtl) {
      this.ttls.set(key, Date.now() + options.expirationTtl * 1000);
    } else {
      this.ttls.delete(key);
    }
  }
  
  /**
   * Delete a key from storage
   * @param key Storage key to delete
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.ttls.delete(key);
  }
  
  /**
   * List keys with optional prefix filtering
   * @param options Optional prefix filtering
   */
  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const now = Date.now();
    const keys: Array<{ name: string }> = [];
    
    for (const [key] of this.store.entries()) {
      // Check TTL expiration
      const ttl = this.ttls.get(key);
      if (ttl && now > ttl) {
        this.store.delete(key);
        this.ttls.delete(key);
        continue;
      }
      
      // Check prefix filter
      if (!options?.prefix || key.startsWith(options.prefix)) {
        keys.push({ name: key });
      }
    }
    
    return { keys };
  }

  // Development utilities
  
  /**
   * Clear all data from storage (development/testing only)
   */
  clear(): void {
    this.store.clear();
    this.ttls.clear();
  }
  
  /**
   * Get current storage size (development/testing only)
   */
  size(): number {
    return this.store.size;
  }
  
  /**
   * Get all keys (development/testing only)
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }
}