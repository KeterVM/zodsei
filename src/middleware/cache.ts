import type { Middleware, RequestContext, ResponseContext } from '../types';

/**
 * Cache middleware configuration
 */
export interface CacheConfig {
  ttl: number; // Cache time (milliseconds)
  /**
   * The default key covers method, URL, query, body and per-call headers. It cannot see headers
   * added by the axios instance or its interceptors, so when those decide whose data comes back
   * (an Authorization token, a tenant id) include that identity here.
   */
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
  private readonly maxEntries: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = Math.max(1, Math.trunc(options.maxEntries ?? 1000) || 1);
  }

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
    // Re-inserting moves the key to the end, so the Map's first key is always the oldest write.
    this.cache.delete(key);
    this.cache.set(key, entry);
    if (this.cache.size > this.maxEntries) {
      this.cleanup();
    }
    while (this.cache.size > this.maxEntries) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
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
  const { url, method, body, query, headers } = request;
  const parts = [method.toUpperCase(), url];

  if (query && Object.keys(query).length > 0) {
    parts.push(JSON.stringify(query));
  }

  // Per-call headers such as Authorization change who the response belongs to.
  if (Object.keys(headers).length > 0) {
    parts.push(JSON.stringify(headers));
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

// Streams and other uncloneable bodies cannot be replayed, so they are not cached.
function cloneOrUndefined(response: ResponseContext): ResponseContext | undefined {
  try {
    return structuredClone(response);
  } catch {
    return undefined;
  }
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
      // Callers get their own copy, so mutating a result cannot change later cache hits.
      return structuredClone(cachedEntry.data);
    }

    // Execute request
    const response = await next(request);

    // Check if should cache
    if (shouldCache(request, response)) {
      const data = cloneOrUndefined(response);
      if (data) {
        await storage.set(cacheKey, { data, timestamp: Date.now(), ttl });
      }
    }

    return response;
  };
}

/**
 * Create simple cache middleware
 * @deprecated Use cacheMiddleware for explicit cache behavior.
 */
export function simpleCache(ttl: number): Middleware {
  return cacheMiddleware({ ttl });
}
