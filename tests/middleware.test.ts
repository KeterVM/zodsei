import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient } from '../src';
import { retryMiddleware, cacheMiddleware } from '../src';
import type { AxiosInstance } from 'axios';

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
        id: z.uuid()
      }),
      response: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email()
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
      axiosMock.request
        .mockResolvedValueOnce({
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          data: { error: 'Server error' },
        })
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
            delay: 10 // Short delay for testing
          })
        ]
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result).toEqual(mockUser);
      expect(axiosMock.request).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      axiosMock.request.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: { error: 'Not found' }
      });

      const client = createClient(apiContract, {
        axios: axiosMock,
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
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Middleware', () => {
    it('should cache GET requests', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
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
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Middleware', () => {
    it('should execute middleware in order', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
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
          cacheMiddleware({ ttl: 1000 }),
          retryMiddleware({ retries: 1, delay: 10 })
        ]
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result).toEqual(mockUser);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
});
  });
});
