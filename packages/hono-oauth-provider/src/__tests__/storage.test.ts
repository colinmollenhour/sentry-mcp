/**
 * Storage Adapter Tests
 * 
 * Tests to validate storage adapter implementations work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from '../storage/memory';

describe('Storage Adapters', () => {
  describe('MemoryStorage', () => {
    let storage: MemoryStorage;

    beforeEach(() => {
      storage = new MemoryStorage();
    });

    it('should store and retrieve string values', async () => {
      await storage.put('test-key', 'test-value');
      const value = await storage.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should store and retrieve JSON values', async () => {
      const testObject = { foo: 'bar', number: 42 };
      await storage.put('json-key', JSON.stringify(testObject));
      
      const value = await storage.get('json-key', { type: 'json' });
      expect(value).toEqual(testObject);
    });

    it('should return null for non-existent keys', async () => {
      const value = await storage.get('non-existent');
      expect(value).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      await storage.put('expiring-key', 'expiring-value', { expirationTtl: 1 });
      
      // Should exist immediately
      let value = await storage.get('expiring-key');
      expect(value).toBe('expiring-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      value = await storage.get('expiring-key');
      expect(value).toBeNull();
    });

    it('should delete keys', async () => {
      await storage.put('delete-me', 'value');
      expect(await storage.get('delete-me')).toBe('value');
      
      await storage.delete('delete-me');
      expect(await storage.get('delete-me')).toBeNull();
    });

    it('should list keys with prefix filtering', async () => {
      await storage.put('client:abc', 'client-abc');
      await storage.put('client:def', 'client-def');
      await storage.put('token:xyz', 'token-xyz');
      
      const allKeys = await storage.list();
      expect(allKeys.keys).toHaveLength(3);
      expect(allKeys.keys.map(k => k.name).sort()).toEqual([
        'client:abc', 'client:def', 'token:xyz'
      ]);
      
      const clientKeys = await storage.list({ prefix: 'client:' });
      expect(clientKeys.keys).toHaveLength(2);
      expect(clientKeys.keys.map(k => k.name).sort()).toEqual([
        'client:abc', 'client:def'
      ]);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      await storage.put('bad-json', 'not-valid-json');
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const value = await storage.get('bad-json', { type: 'json' });
      expect(value).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should filter expired keys from list results', async () => {
      await storage.put('persistent', 'value1');
      await storage.put('expiring', 'value2', { expirationTtl: 1 });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const keys = await storage.list();
      expect(keys.keys).toHaveLength(1);
      expect(keys.keys[0].name).toBe('persistent');
    });

    describe('Development utilities', () => {
      it('should provide clear() method for testing', () => {
        storage.put('test', 'value');
        expect(storage.size()).toBe(1);
        
        storage.clear();
        expect(storage.size()).toBe(0);
      });

      it('should provide getAllKeys() method for debugging', async () => {
        await storage.put('key1', 'value1');
        await storage.put('key2', 'value2');
        
        const keys = storage.getAllKeys();
        expect(keys.sort()).toEqual(['key1', 'key2']);
      });
    });
  });

  // Note: KVStorage tests would require mocking the Cloudflare KV interface
  // which is more complex and would need proper Cloudflare testing setup
  describe('KVStorage', () => {
    it('should be importable', async () => {
      const { KVStorage } = await import('../storage/cloudflare-kv');
      expect(KVStorage).toBeDefined();
      expect(typeof KVStorage).toBe('function');
    });
  });
});