describe('Cache Behavior Integration Tests', () => {
  let mockCache;
  
  beforeEach(() => {
    // Initialize mock cache
    mockCache = {
      storage: new Map(),
      metadata: new Map(),
      tags: new Map(),
      ttl: 3600000, // 1 hour default TTL
      
      get: function(key) {
        const item = this.storage.get(key);
        const meta = this.metadata.get(key);
        
        if (!item || !meta) return null;
        
        // Check if expired
        if (Date.now() > meta.expiresAt) {
          this.delete(key);
          return null;
        }
        
        // Update access time
        meta.lastAccessed = Date.now();
        return item;
      },
      
      set: function(key, value, options = {}) {
        const now = Date.now();
        const ttl = options.ttl || this.ttl;
        
        this.storage.set(key, value);
        this.metadata.set(key, {
          createdAt: now,
          lastAccessed: now,
          expiresAt: now + ttl,
          tags: options.tags || []
        });
        
        // Index by tags
        if (options.tags) {
          options.tags.forEach(tag => {
            if (!this.tags.has(tag)) {
              this.tags.set(tag, new Set());
            }
            this.tags.get(tag).add(key);
          });
        }
        
        return true;
      },
      
      delete: function(key) {
        const meta = this.metadata.get(key);
        if (meta && meta.tags) {
          // Remove from tag indexes
          meta.tags.forEach(tag => {
            const tagSet = this.tags.get(tag);
            if (tagSet) {
              tagSet.delete(key);
              if (tagSet.size === 0) {
                this.tags.delete(tag);
              }
            }
          });
        }
        
        this.storage.delete(key);
        this.metadata.delete(key);
        return true;
      },
      
      invalidateByTag: function(tag) {
        const keys = this.tags.get(tag);
        if (keys) {
          keys.forEach(key => this.delete(key));
        }
      },
      
      clear: function() {
        this.storage.clear();
        this.metadata.clear();
        this.tags.clear();
      }
    };
  });

  afterEach(() => {
    mockCache.clear();
  });

  describe('Basic Cache Operations', () => {
    test('stores and retrieves values', () => {
      const key = 'test-key';
      const value = { data: 'test data' };
      
      mockCache.set(key, value);
      const retrieved = mockCache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    test('returns null for non-existent keys', () => {
      const result = mockCache.get('non-existent-key');
      expect(result).toBeNull();
    });

    test('deletes values correctly', () => {
      const key = 'test-key';
      const value = { data: 'test data' };
      
      mockCache.set(key, value);
      expect(mockCache.get(key)).toEqual(value);
      
      mockCache.delete(key);
      expect(mockCache.get(key)).toBeNull();
    });

    test('clears all values', () => {
      mockCache.set('key1', 'value1');
      mockCache.set('key2', 'value2');
      
      expect(mockCache.get('key1')).toBe('value1');
      expect(mockCache.get('key2')).toBe('value2');
      
      mockCache.clear();
      
      expect(mockCache.get('key1')).toBeNull();
      expect(mockCache.get('key2')).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    test('expires items after TTL', async () => {
      const key = 'expiring-key';
      const value = 'expiring value';
      const shortTTL = 100; // 100ms
      
      mockCache.set(key, value, { ttl: shortTTL });
      expect(mockCache.get(key)).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockCache.get(key)).toBeNull();
    });

    test('uses default TTL when not specified', () => {
      const key = 'default-ttl-key';
      const value = 'test value';
      
      mockCache.set(key, value);
      const meta = mockCache.metadata.get(key);
      
      expect(meta.expiresAt - meta.createdAt).toBe(mockCache.ttl);
    });

    test('allows custom TTL per item', () => {
      const key = 'custom-ttl-key';
      const value = 'test value';
      const customTTL = 5000; // 5 seconds
      
      mockCache.set(key, value, { ttl: customTTL });
      const meta = mockCache.metadata.get(key);
      
      expect(meta.expiresAt - meta.createdAt).toBe(customTTL);
    });
  });

  describe('Tag-based Invalidation', () => {
    test('invalidates cache by tag', () => {
      mockCache.set('user:1', { name: 'John' }, { tags: ['users', 'user:1'] });
      mockCache.set('user:2', { name: 'Jane' }, { tags: ['users', 'user:2'] });
      mockCache.set('post:1', { title: 'Hello' }, { tags: ['posts', 'user:1'] });
      
      expect(mockCache.get('user:1')).toBeTruthy();
      expect(mockCache.get('user:2')).toBeTruthy();
      expect(mockCache.get('post:1')).toBeTruthy();
      
      // Invalidate all users
      mockCache.invalidateByTag('users');
      
      expect(mockCache.get('user:1')).toBeNull();
      expect(mockCache.get('user:2')).toBeNull();
      expect(mockCache.get('post:1')).toBeTruthy(); // Should remain
    });

    test('handles multiple tags per item', () => {
      mockCache.set('item:1', { data: 'test' }, { tags: ['tag1', 'tag2', 'tag3'] });
      
      expect(mockCache.get('item:1')).toBeTruthy();
      
      mockCache.invalidateByTag('tag2');
      
      expect(mockCache.get('item:1')).toBeNull();
    });

    test('cleans up empty tag indexes', () => {
      mockCache.set('item:1', { data: 'test' }, { tags: ['cleanup-test'] });
      
      expect(mockCache.tags.has('cleanup-test')).toBe(true);
      
      mockCache.delete('item:1');
      
      expect(mockCache.tags.has('cleanup-test')).toBe(false);
    });
  });

  describe('Cache Hit/Miss Tracking', () => {
    test('tracks cache hits and misses', () => {
      const stats = {
        hits: 0,
        misses: 0,
        hitRate: function() {
          const total = this.hits + this.misses;
          return total === 0 ? 0 : this.hits / total;
        }
      };
      
      const cacheWithStats = {
        ...mockCache,
        get: function(key) {
          const result = mockCache.get.call(this, key);
          if (result !== null) {
            stats.hits++;
          } else {
            stats.misses++;
          }
          return result;
        }
      };
      
      // Test cache misses
      cacheWithStats.get('miss1');
      cacheWithStats.get('miss2');
      
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
      expect(stats.hitRate()).toBe(0);
      
      // Add items and test hits
      cacheWithStats.set('hit1', 'value1');
      cacheWithStats.set('hit2', 'value2');
      
      cacheWithStats.get('hit1');
      cacheWithStats.get('hit2');
      
      expect(stats.hits).toBe(2);
      expect(stats.hitRate()).toBe(0.5); // 2 hits out of 4 total
    });
  });

  describe('Background Refresh', () => {
    test('refreshes cache in background when near expiry', async () => {
      const refreshThreshold = 0.8; // Refresh when 80% of TTL has passed
      let refreshCalled = false;
      
      const refreshFunction = async (key) => {
        refreshCalled = true;
        return { data: 'refreshed data', timestamp: Date.now() };
      };
      
      const cacheWithRefresh = {
        ...mockCache,
        get: function(key) {
          const item = mockCache.get.call(this, key);
          if (item) {
            const meta = this.metadata.get(key);
            const age = Date.now() - meta.createdAt;
            const ttl = meta.expiresAt - meta.createdAt;
            
            // Check if refresh threshold is reached
            if (age / ttl >= refreshThreshold) {
              // Trigger background refresh
              setTimeout(async () => {
                const refreshed = await refreshFunction(key);
                this.set(key, refreshed);
              }, 0);
            }
          }
          return item;
        }
      };
      
      const key = 'refresh-test';
      const shortTTL = 100; // 100ms
      
      cacheWithRefresh.set(key, { data: 'original' }, { ttl: shortTTL });
      
      // Wait until refresh threshold (80ms)
      await new Promise(resolve => setTimeout(resolve, 85));
      
      const result = cacheWithRefresh.get(key);
      expect(result.data).toBe('original');
      
      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(refreshCalled).toBe(true);
    });
  });

  describe('Memory Management', () => {
    test('implements LRU eviction when cache is full', () => {
      const maxSize = 3;
      const lruCache = {
        storage: new Map(),
        maxSize: maxSize,
        accessOrder: [],
        
        get: function(key) {
          const value = this.storage.get(key);
          if (value !== undefined) {
            // Move to end (most recently used)
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
              this.accessOrder.splice(index, 1);
            }
            this.accessOrder.push(key);
          }
          return value;
        },
        
        set: function(key, value) {
          if (this.storage.has(key)) {
            this.storage.set(key, value);
            this.get(key); // Update access order
          } else {
            // Check if cache is full
            if (this.storage.size >= this.maxSize) {
              // Evict least recently used
              const lruKey = this.accessOrder.shift();
              this.storage.delete(lruKey);
            }
            
            this.storage.set(key, value);
            this.accessOrder.push(key);
          }
        }
      };
      
      // Fill cache to capacity
      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.set('key3', 'value3');
      
      expect(lruCache.storage.size).toBe(3);
      
      // Access key1 to make it recently used
      lruCache.get('key1');
      
      // Add new item (should evict key2, the LRU)
      lruCache.set('key4', 'value4');
      
      expect(lruCache.storage.has('key1')).toBe(true);
      expect(lruCache.storage.has('key2')).toBe(false);
      expect(lruCache.storage.has('key3')).toBe(true);
      expect(lruCache.storage.has('key4')).toBe(true);
    });
  });

  describe('Concurrent Access', () => {
    test('handles concurrent reads and writes', async () => {
      const concurrentOperations = [];
      const key = 'concurrent-key';
      
      // Start multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          new Promise(resolve => {
            setTimeout(() => {
              mockCache.set(`${key}:${i}`, `value:${i}`);
              const result = mockCache.get(`${key}:${i}`);
              resolve(result);
            }, Math.random() * 50);
          })
        );
      }
      
      const results = await Promise.all(concurrentOperations);
      
      // All operations should complete successfully
      results.forEach((result, index) => {
        expect(result).toBe(`value:${index}`);
      });
    });

    test('prevents cache stampede with locking', async () => {
      const locks = new Map();
      let expensiveOperationCalls = 0;
      
      const expensiveOperation = async (key) => {
        expensiveOperationCalls++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { data: `computed-${key}`, timestamp: Date.now() };
      };
      
      const cacheWithLocking = {
        ...mockCache,
        
        getOrCompute: async function(key, computeFn) {
          // Check cache first
          let value = this.get(key);
          if (value) return value;
          
          // Check if computation is already in progress
          if (locks.has(key)) {
            return locks.get(key);
          }
          
          // Start computation and store promise in locks
          const computePromise = computeFn(key).then(result => {
            this.set(key, result);
            locks.delete(key);
            return result;
          });
          
          locks.set(key, computePromise);
          return computePromise;
        }
      };
      
      const key = 'expensive-key';
      
      // Start multiple concurrent requests for the same key
      const promises = [
        cacheWithLocking.getOrCompute(key, expensiveOperation),
        cacheWithLocking.getOrCompute(key, expensiveOperation),
        cacheWithLocking.getOrCompute(key, expensiveOperation)
      ];
      
      const results = await Promise.all(promises);
      
      // All requests should get the same result
      results.forEach(result => {
        expect(result.data).toBe(`computed-${key}`);
      });
      
      // But expensive operation should only be called once
      expect(expensiveOperationCalls).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    test('measures cache performance', async () => {
      const metrics = {
        operations: [],
        avgLatency: 0,
        maxLatency: 0,
        minLatency: Infinity
      };
      
      const cacheWithMetrics = {
        ...mockCache,
        
        get: function(key) {
          const start = Date.now();
          const result = mockCache.get.call(this, key);
          const latency = Date.now() - start;
          
          metrics.operations.push({ type: 'get', latency, hit: result !== null });
          metrics.maxLatency = Math.max(metrics.maxLatency, latency);
          metrics.minLatency = Math.min(metrics.minLatency, latency);
          metrics.avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;
          
          return result;
        },
        
        set: function(key, value, options) {
          const start = Date.now();
          const result = mockCache.set.call(this, key, value, options);
          const latency = Date.now() - start;
          
          metrics.operations.push({ type: 'set', latency });
          metrics.maxLatency = Math.max(metrics.maxLatency, latency);
          metrics.minLatency = Math.min(metrics.minLatency, latency);
          metrics.avgLatency = metrics.operations.reduce((sum, op) => sum + op.latency, 0) / metrics.operations.length;
          
          return result;
        }
      };
      
      // Perform various cache operations
      cacheWithMetrics.set('perf1', 'value1');
      cacheWithMetrics.set('perf2', 'value2');
      cacheWithMetrics.get('perf1');
      cacheWithMetrics.get('nonexistent');
      
      expect(metrics.operations.length).toBe(4);
      expect(metrics.avgLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.minLatency);
      
      const hits = metrics.operations.filter(op => op.hit === true).length;
      const gets = metrics.operations.filter(op => op.type === 'get').length;
      const hitRate = hits / gets;
      
      expect(hitRate).toBe(0.5); // 1 hit out of 2 gets
    });
  });
});