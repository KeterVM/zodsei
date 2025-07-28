import type { Middleware, RequestContext, ResponseContext } from '../types';

/**
 * Cache middleware configuration
 */
export interface CacheConfig {
  ttl: number; // Cache time (milliseconds)
  keyGenerator?: (request: RequestContext) => string;
  shouldCache?: (request: RequestContext, response: ResponseContext) => boolean;
  storage?: CacheStorage;
}

/**
 * Cache storage interface
 */
export interface CacheStorage {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  data: ResponseContext;
  timestamp: number;
  ttl: number;
}

/**
 * Memory cache storage implementation
 */
export class MemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Clean expired cache
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Default cache key generator
function defaultKeyGenerator(request: RequestContext): string {
  const { url, method, body, query } = request;
  const parts = [method.toUpperCase(), url];

  if (query && Object.keys(query).length > 0) {
    parts.push(JSON.stringify(query));
  }

  if (body) {
    parts.push(JSON.stringify(body));
  }

  return parts.join('|');
}

// Default cache condition
function defaultShouldCache(request: RequestContext, response: ResponseContext): boolean {
  // Only cache successful GET responses
  return request.method.toLowerCase() === 'get' && response.status >= 200 && response.status < 300;
}

/**
 * Create cache middleware
 */
export function cacheMiddleware(config: CacheConfig): Middleware {
  const {
    ttl,
    keyGenerator = defaultKeyGenerator,
    shouldCache = defaultShouldCache,
    storage = new MemoryCacheStorage(),
  } = config;

  return async (request, next) => {
    const cacheKey = keyGenerator(request);

    // Try to get from cache
    const cachedEntry = await storage.get(cacheKey);
    if (cachedEntry) {
      return cachedEntry.data;
    }

    // Execute request
    const response = await next(request);

    // Check if should cache
    if (shouldCache(request, response)) {
      const entry: CacheEntry = {
        data: response,
        timestamp: Date.now(),
        ttl,
      };

      await storage.set(cacheKey, entry);
    }

    return response;
  };
}

/**
 * Create simple cache middleware
 */
export function simpleCache(ttl: number): Middleware {
  return cacheMiddleware({ ttl });
}
