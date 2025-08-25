/**
 * Test Storage Implementation for OAuth 2.1 Provider Tests
 * 
 * Unified storage mock for all test files to ensure consistency.
 * Implements Storage interface with in-memory Map storage and TTL support.
 */

import type { Storage } from '../../types';

export class TestStorage implements Storage {
  private store = new Map<string, string>();
  private ttls = new Map<string, number>();

  /**
   * Get a value from storage with TTL checking
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
        console.error(`[TestStorage] Failed to parse JSON for key "${key}":`, error);
        return null;
      }
    }
    
    return value;
  }
  
  /**
   * Store a value with optional TTL
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
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.ttls.delete(key);
  }
  
  /**
   * List keys with optional prefix filtering and TTL checking
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

  // Test utilities
  
  /**
   * Clear all data (test utility)
   */
  clear(): void {
    this.store.clear();
    this.ttls.clear();
  }
  
  /**
   * Get current storage size (test utility)
   */
  size(): number {
    return this.store.size;
  }
  
  /**
   * Get all keys (test utility)
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Create a storage that throws on specific operations (for error testing)
   */
  static createErrorStorage(errorOnMethods: ('get' | 'put' | 'delete' | 'list')[] = []): Storage {
    const storage = new TestStorage();
    const originalMethods = {
      get: storage.get.bind(storage),
      put: storage.put.bind(storage),
      delete: storage.delete.bind(storage),
      list: storage.list.bind(storage),
    };

    if (errorOnMethods.includes('get')) {
      storage.get = async () => { throw new Error('Storage error on get'); };
    }
    if (errorOnMethods.includes('put')) {
      storage.put = async () => { throw new Error('Storage error on put'); };
    }
    if (errorOnMethods.includes('delete')) {
      storage.delete = async () => { throw new Error('Storage error on delete'); };
    }
    if (errorOnMethods.includes('list')) {
      storage.list = async () => { throw new Error('Storage error on list'); };
    }

    return storage;
  }
}