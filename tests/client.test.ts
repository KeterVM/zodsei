import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient, ValidationError, HttpError } from '../src';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ZodseiClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const UserSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email()
  });

  const apiContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.string().uuid()
      }),
      response: UserSchema
    },
    
    createUser: {
      path: '/users',
      method: 'post' as const,
      request: z.object({
        name: z.string().min(1),
        email: z.string().email()
      }),
      response: UserSchema
    },

    getUsers: {
      path: '/users',
      method: 'get' as const,
      request: z.object({
        page: z.number().optional(),
        limit: z.number().optional()
      }),
      response: z.object({
        users: z.array(UserSchema),
        total: z.number()
      })
    }
  } as const;

  it('should create client successfully', () => {
    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com'
    });

    expect(client).toBeDefined();
    expect(typeof client.getUser).toBe('function');
    expect(typeof client.createUser).toBe('function');
    expect(typeof client.getUsers).toBe('function');
  });

  describe('Path Parameters', () => {
    it('should handle single path parameter', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockUser
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com'
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123e4567-e89b-12d3-a456-426614174000',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle multiple path parameters', async () => {
      // Add a new endpoint with multiple path params for testing
      const multiParamContract = {
        getUserPost: {
          path: '/users/:userId/posts/:postId',
          method: 'get' as const,
          request: z.object({
            userId: z.string().uuid(),
            postId: z.string().uuid()
          }),
          response: z.object({
            id: z.string().uuid(),
            title: z.string(),
            content: z.string(),
            userId: z.string().uuid()
          })
        }
      } as const;

      const mockPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Post',
        content: 'Test content',
        userId: '123e4567-e89b-12d3-a456-426614174001'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockPost
      });

      const client = createClient(multiParamContract, {
        baseUrl: 'https://api.example.com'
      });

      const result = await client.getUserPost({
        userId: '123e4567-e89b-12d3-a456-426614174001',
        postId: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(result).toEqual(mockPost);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123e4567-e89b-12d3-a456-426614174001/posts/123e4567-e89b-12d3-a456-426614174000',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should URL encode path parameters', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockUser
      });

      const client = createClient(apiContract, {
        baseUrl: 'https://api.example.com',
        validateRequest: false, // Disable validation for this test
        validateResponse: false // Also disable response validation
      });

      const result = await client.getUser({
        id: 'user with spaces'
      } as any);

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/user%20with%20spaces',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should separate path params from query params', async () => {
      // Create a contract that has both path and query params
      const mixedParamsContract = {
        searchUserPosts: {
          path: '/users/:userId/posts',
          method: 'get' as const,
          request: z.object({
            userId: z.string().uuid(),
            page: z.number().optional(),
            limit: z.number().optional(),
            search: z.string().optional()
          }),
          response: z.object({
            posts: z.array(z.object({
              id: z.string(),
              title: z.string()
            })),
            total: z.number()
          })
        }
      } as const;

      const mockResponse = {
        posts: [{ id: 'post-1', title: 'Test Post' }],
        total: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse
      });

      const client = createClient(mixedParamsContract, {
        baseUrl: 'https://api.example.com'
      });

      const result = await client.searchUserPosts({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        page: 1,
        limit: 10,
        search: 'test'
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123e4567-e89b-12d3-a456-426614174000/posts?page=1&limit=10&search=test',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  it('should make POST request with body', async () => {
    const requestData = {
      name: 'Jane Doe',
      email: 'jane@example.com'
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ...requestData
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUser
    });

    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com'
    });

    const result = await client.createUser(requestData);

    expect(result).toEqual(mockUser);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(requestData)
      })
    );
  });

  it('should make GET request with query params', async () => {
    const mockResponse = {
      users: [],
      total: 0
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse
    });

    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com'
    });

    const result = await client.getUsers({
      page: 1,
      limit: 10
    });

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users?page=1&limit=10',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('should validate request data', async () => {
    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com',
      validateRequest: true
    });

    await expect(client.getUser({
      id: 'invalid-uuid'
    })).rejects.toThrow(ValidationError);
  });

  it('should validate response data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ invalid: 'response' })
    });

    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com',
      validateResponse: true
    });

    await expect(client.getUser({
      id: '123e4567-e89b-12d3-a456-426614174000'
    })).rejects.toThrow(ValidationError);
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'User not found' })
    });

    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com',
      validateResponse: false // Disable response validation to test HTTP error
    });

    await expect(client.getUser({
      id: '123e4567-e89b-12d3-a456-426614174000'
    })).rejects.toThrow(HttpError);
  });

  it('should disable validation when configured', async () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUser
    });

    const client = createClient(apiContract, {
      baseUrl: 'https://api.example.com',
      validateRequest: false,
      validateResponse: false
    });

    // This should not throw an error, even if UUID is invalid
    const result = await client.getUser({
      id: 'invalid-uuid'
    } as any);

    expect(result).toEqual(mockUser);
  });
});
