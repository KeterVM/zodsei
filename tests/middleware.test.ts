import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient } from '../src';
import { retryMiddleware, cacheMiddleware } from '../src';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Middleware', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const apiContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.string().uuid()
      }),
      response: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email()
      })
    }
  } as const;

  describe('Retry Middleware', () => {
    it('should retry on server errors', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
      };

      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockUser
        });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        validateResponse: false, // Disable validation for this test
        middleware: [
          retryMiddleware({
            retries: 1,
            delay: 10 // Short delay for testing
          })
        ]
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not found' })
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        validateResponse: false,
        middleware: [
          retryMiddleware({
            retries: 2,
            delay: 10
          })
        ]
      });

      await expect(client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      })).rejects.toThrow();

      // Should only be called once (no retry for 404)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Middleware', () => {
    it('should cache GET requests', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockUser
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        middleware: [
          cacheMiddleware({
            ttl: 1000 // 1 second cache
          })
        ]
      });

      // First call
      const result1 = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      // Second call should use cache
      const result2 = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result1).toEqual(mockUser);
      expect(result2).toEqual(mockUser);
      // Should only make one HTTP request due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Middleware', () => {
    it('should execute middleware in order', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockUser
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        middleware: [
          cacheMiddleware({ ttl: 1000 }),
          retryMiddleware({ retries: 1, delay: 10 })
        ]
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
