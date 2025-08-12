import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  createClient,
  createAdapter,
  isAdapterAvailable,
  FetchAdapter,
  AxiosAdapter,
  KyAdapter,
} from '../src';

// Mock fetch, axios, and ky
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock axios
vi.mock('axios', () => ({
  default: {
    request: vi.fn(),
  },
}));

// Mock ky
vi.mock('ky', () => ({
  default: vi.fn(),
}));

describe('HTTP Adapters', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  const apiContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.string().uuid(),
      }),
      response: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email(),
      }),
    },
  } as const;

  describe('Adapter Factory', () => {
    it('should create fetch adapter by default', async () => {
      const adapter = await createAdapter('fetch');
      expect(adapter.name).toBe('fetch');
      expect(adapter).toBeInstanceOf(FetchAdapter);
    });

    it('should create axios adapter when specified', async () => {
      const adapter = await createAdapter('axios');
      expect(adapter.name).toBe('axios');
      expect(adapter).toBeInstanceOf(AxiosAdapter);
    });

    it('should create ky adapter when specified', async () => {
      const adapter = await createAdapter('ky');
      expect(adapter.name).toBe('ky');
      expect(adapter).toBeInstanceOf(KyAdapter);
    });

    it('should throw error for unsupported adapter type', async () => {
      await expect(createAdapter('invalid' as any)).rejects.toThrow(
        'Unsupported adapter type: invalid'
      );
    });
  });

  describe('Adapter Availability', () => {
    it('should detect fetch availability', async () => {
      const available = await isAdapterAvailable('fetch');
      expect(available).toBe(true);
    });

    it('should detect axios availability', async () => {
      const available = await isAdapterAvailable('axios');
      expect(available).toBe(true); // Mocked
    });

    it('should detect ky availability', async () => {
      const available = await isAdapterAvailable('ky');
      expect(available).toBe(true); // Mocked
    });
  });

  describe('FetchAdapter', () => {
    it('should make successful request', async () => {
      const mockResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        adapter: 'fetch',
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123e4567-e89b-12d3-a456-426614174000',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        adapter: 'fetch',
      });

      await expect(
        client.getUser({
          id: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'User not found' }),
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        adapter: 'fetch',
      });

      await expect(
        client.getUser({
          id: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('Client with Adapters', () => {
    it('should use specified adapter', async () => {
      const mockResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        adapter: 'fetch',
        adapterConfig: {
          timeout: 5000,
          credentials: 'include',
        },
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should use adapter with custom config', async () => {
      const mockResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        adapter: 'fetch',
        adapterConfig: {
          timeout: 10000,
          credentials: 'same-origin',
        },
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Adapter Configuration', () => {
    it('should pass adapter config to adapter', async () => {
      const adapter = new FetchAdapter({
        timeout: 15000,
        credentials: 'include',
        mode: 'cors',
      });

      expect(adapter.name).toBe('fetch');
    });

    it('should merge client timeout with adapter config', async () => {
      const mockResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        adapter: 'fetch',
        timeout: 20000,
        adapterConfig: {
          credentials: 'include',
        },
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockResponse);
    });
  });
});
