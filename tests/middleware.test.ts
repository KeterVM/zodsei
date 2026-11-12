import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { z } from 'zod';
import { createClient, HttpError } from '../src';
import { retryMiddleware, cacheMiddleware, MemoryCacheStorage } from '../src';
import { AxiosError } from 'axios';
import { httpFailure } from './helpers';
import type { AxiosInstance } from 'axios';
import type { Middleware } from '../src';

function createAxiosMock(baseURL = 'https://api.example.com') {
  return {
    request: vi.fn(),
    defaults: { baseURL },
  } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
}

describe('Middleware', () => {
  let axiosMock: ReturnType<typeof createAxiosMock>;
  beforeEach(() => {
    axiosMock = createAxiosMock();
  });

  const apiContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.uuid(),
      }),
      response: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
      }),
    },
  } as const;

  describe('Retry Middleware', () => {
    it('should retry on server errors', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      // First call fails, second succeeds
      axiosMock.request
        .mockRejectedValueOnce(httpFailure(500, 'Internal Server Error', { error: 'Server error' }))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: mockUser,
        });

      const client = createClient(apiContract, {
        axios: axiosMock,
        validateResponse: false, // Disable validation for this test
        middleware: [
          retryMiddleware({
            retries: 1,
            delay: 10, // Short delay for testing
          }),
        ],
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockUser);
      expect(axiosMock.request).toHaveBeenCalledTimes(2);
    });

    it('should rerun downstream middleware for every attempt', async () => {
      const calls: string[] = [];
      const downstream: Middleware = async (request, next) => {
        calls.push('downstream');
        return next(request);
      };

      axiosMock.request
        .mockRejectedValueOnce(httpFailure(500, 'Internal Server Error', null))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { id: 'user-1' },
        });

      const client = createClient(apiContract, {
        axios: axiosMock,
        validateResponse: false,
        middleware: [retryMiddleware({ retries: 1, delay: 0 }), downstream],
      });

      await client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(calls).toEqual(['downstream', 'downstream']);
      expect(axiosMock.request).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      axiosMock.request.mockRejectedValueOnce(
        httpFailure(404, 'Not Found', { error: 'Not found' })
      );

      const client = createClient(apiContract, {
        axios: axiosMock,
        validateResponse: false,
        middleware: [
          retryMiddleware({
            retries: 2,
            delay: 10,
          }),
        ],
      });

      await expect(
        client.getUser({
          id: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow();

      // Should only be called once (no retry for 404)
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    const serverError = httpFailure(500, 'Internal Server Error');
    const ok = { status: 200, statusText: 'OK', headers: {}, data: { id: 'u1' } };
    const writeContract = {
      createUser: {
        path: '/users',
        method: 'post',
        request: z.object({ name: z.string() }),
      },
    } as const;

    it('does not retry non-idempotent methods by default', async () => {
      axiosMock.request.mockRejectedValue(serverError);
      const client = createClient(writeContract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: 3, delay: 0 })],
      });

      await expect(client.createUser({ name: 'Ann' })).rejects.toBeInstanceOf(HttpError);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('lets a custom retryCondition opt a POST into retries', async () => {
      axiosMock.request.mockRejectedValueOnce(serverError).mockResolvedValueOnce(ok);
      const retryCondition = vi.fn(() => true);
      const client = createClient(writeContract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: 1, delay: 0, retryCondition })],
      });

      await client.createUser({ name: 'Ann' });

      expect(axiosMock.request).toHaveBeenCalledTimes(2);
      expect(retryCondition).toHaveBeenCalledWith(
        expect.any(HttpError),
        expect.objectContaining({ method: 'post', url: '/users' })
      );
    });

    it('retries network failures on GET', async () => {
      axiosMock.request
        .mockRejectedValueOnce(new AxiosError('socket hang up', 'ECONNRESET', undefined, {}))
        .mockResolvedValueOnce(ok);
      const client = createClient(apiContract, {
        axios: axiosMock,
        validateResponse: false,
        middleware: [retryMiddleware({ retries: 1, delay: 0 })],
      });

      await client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(axiosMock.request).toHaveBeenCalledTimes(2);
    });

    it('does not retry errors that did not come from axios', async () => {
      axiosMock.request.mockRejectedValue(new Error('token refresh failed'));
      const client = createClient(apiContract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: 3, delay: 0 })],
      });

      await expect(client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' })).rejects.toThrow(
        'token refresh failed'
      );
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('treats negative retries as zero and rethrows the real error', async () => {
      axiosMock.request.mockRejectedValue(serverError);
      const client = createClient(apiContract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: -1, delay: 0 })],
      });

      await expect(
        client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' })
      ).rejects.toBeInstanceOf(HttpError);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('treats NaN retries as zero instead of retrying forever', async () => {
      axiosMock.request.mockRejectedValue(serverError);
      const client = createClient(apiContract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: Number('not a number'), delay: 0 })],
      });

      await expect(
        client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' })
      ).rejects.toBeInstanceOf(HttpError);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('matches idempotent methods case-insensitively', async () => {
      axiosMock.request.mockRejectedValueOnce(serverError).mockResolvedValueOnce(ok);
      const client = createClient(
        { list: { path: '/users', method: 'GET' as 'get' } },
        { axios: axiosMock, middleware: [retryMiddleware({ retries: 1, delay: 0 })] }
      );

      await client.list();

      expect(axiosMock.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Middleware', () => {
    it('should cache GET requests', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      axiosMock.request.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockUser,
      });

      const client = createClient(apiContract, {
        axios: axiosMock,
        middleware: [
          cacheMiddleware({
            ttl: 1000, // 1 second cache
          }),
        ],
      });

      // First call
      const result1 = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      // Second call should use cache
      const result2 = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result1).toEqual(mockUser);
      expect(result2).toEqual(mockUser);
      // Should only make one HTTP request due to caching
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('should not let a mutated result change later cache hits', async () => {
      const contract = { getTags: { path: '/tags', method: 'get' as const } };
      axiosMock.request.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { tags: ['a'] },
      });
      const client = createClient(contract, {
        axios: axiosMock,
        middleware: [cacheMiddleware({ ttl: 1000 })],
      });

      const first = (await client.getTags()) as { tags: string[] };
      first.tags.push('mutated');
      const second = (await client.getTags()) as { tags: string[] };
      second.tags.push('mutated again');

      expect(await client.getTags()).toEqual({ tags: ['a'] });
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('should evict the oldest entry once the memory storage is full', async () => {
      const storage = new MemoryCacheStorage({ maxEntries: 2 });
      const entry = (data: unknown) => ({
        data: { status: 200, statusText: 'OK', headers: {}, data },
        timestamp: Date.now(),
        ttl: 1000,
      });

      await storage.set('a', entry(1));
      await storage.set('b', entry(2));
      await storage.set('c', entry(3));

      expect(storage.size()).toBe(2);
      expect(await storage.get('a')).toBeNull();
      expect((await storage.get('c'))?.data.data).toBe(3);
    });

    it('should drop expired entries before evicting live ones', async () => {
      const storage = new MemoryCacheStorage({ maxEntries: 2 });
      const entry = (ttl: number, timestamp: number) => ({
        data: { status: 200, statusText: 'OK', headers: {}, data: null },
        timestamp,
        ttl,
      });

      await storage.set('live', entry(1000, Date.now()));
      await storage.set('expired', entry(1, Date.now() - 1000));
      await storage.set('new', entry(1000, Date.now()));

      expect(await storage.get('live')).not.toBeNull();
      expect(await storage.get('new')).not.toBeNull();
    });
  });

  describe('use()', () => {
    it('should not add middleware to another client built from the same array', async () => {
      const contract = { ping: { path: '/ping', method: 'get' as const } };
      axiosMock.request.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: 1 });
      const shared: Middleware[] = [];
      const first = createClient(contract, { axios: axiosMock, middleware: shared });
      const second = createClient(contract, { axios: axiosMock, middleware: shared });
      const spy = vi.fn<Middleware>((request, next) => next(request));

      first.use(spy);
      await second.ping();

      expect(spy).not.toHaveBeenCalled();
      expect(shared).toHaveLength(0);

      await first.ping();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Middleware', () => {
    it('should execute middleware in order', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      axiosMock.request.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockUser,
      });

      const client = createClient(apiContract, {
        axios: axiosMock,
        middleware: [cacheMiddleware({ ttl: 1000 }), retryMiddleware({ retries: 1, delay: 10 })],
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockUser);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });
  });
});
