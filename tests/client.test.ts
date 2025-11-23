import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient, ValidationError, HttpError } from '../src';
import type { AxiosInstance } from 'axios';

// Mock axios instance helper
function createAxiosMock(baseURL = 'https://api.example.com') {
  return {
    request: vi.fn(),
    defaults: { baseURL },
  } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
}

describe('ZodseiClient', () => {
  let axiosMock: ReturnType<typeof createAxiosMock>;
  beforeEach(() => {
    axiosMock = createAxiosMock();
  });

  const UserSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  });

  const apiContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.uuid(),
      }),
      response: UserSchema,
    },

    createUser: {
      path: '/users',
      method: 'post' as const,
      request: z.object({
        name: z.string().min(1),
        email: z.email(),
      }),
      response: UserSchema,
    },

    getUsers: {
      path: '/users',
      method: 'get' as const,
      request: z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
      }),
      response: z.object({
        users: z.array(UserSchema),
        total: z.number(),
      }),
    },
  } as const;

  it('should create client successfully', () => {
    const client = createClient(apiContract, {
      axios: axiosMock,
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
        email: 'john@example.com',
      };

      axiosMock.request.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockUser,
      });

      const client = createClient(apiContract, {
        axios: axiosMock,
      });

      const result = await client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockUser);
      expect(axiosMock.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/users/123e4567-e89b-12d3-a456-426614174000',
          method: 'get',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
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
            userId: z.uuid(),
            postId: z.uuid(),
          }),
          response: z.object({
            id: z.uuid(),
            title: z.string(),
            content: z.string(),
            userId: z.uuid(),
          }),
        },
      } as const;

      const mockPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Post',
        content: 'Test content',
        userId: '123e4567-e89b-12d3-a456-426614174001',
      };

      axiosMock.request.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockPost,
      });

      const client = createClient(multiParamContract, {
        axios: axiosMock,
      });

      const result = await client.getUserPost({
        userId: '123e4567-e89b-12d3-a456-426614174001',
        postId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toEqual(mockPost);
      expect(axiosMock.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/users/123e4567-e89b-12d3-a456-426614174001/posts/123e4567-e89b-12d3-a456-426614174000',
          method: 'get',
        })
      );
    });

    it('should URL encode path parameters', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      };

      axiosMock.request.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockUser,
      });

      const client = createClient(apiContract, {
        axios: axiosMock,
        validateRequest: false, // Disable validation for this test
        validateResponse: false, // Also disable response validation
      });

      const result = await client.getUser({
        id: 'user with spaces',
      });

      expect(result).toEqual(mockUser);
      expect(axiosMock.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/users/user%20with%20spaces',
          method: 'get',
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
            userId: z.uuid(),
            page: z.number().optional(),
            limit: z.number().optional(),
            search: z.string().optional(),
          }),
          response: z.object({
            posts: z.array(
              z.object({
                id: z.string(),
                title: z.string(),
              })
            ),
            total: z.number(),
          }),
        },
      } as const;

      const mockResponse = {
        posts: [{ id: 'post-1', title: 'Test Post' }],
        total: 1,
      };

      axiosMock.request.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockResponse,
      });

      const client = createClient(mixedParamsContract, {
        axios: axiosMock,
      });

      const result = await client.searchUserPosts({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        page: 1,
        limit: 10,
        search: 'test',
      });

      expect(result).toEqual(mockResponse);
      expect(axiosMock.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/users/123e4567-e89b-12d3-a456-426614174000/posts?page=1&limit=10&search=test',
          method: 'get',
        })
      );
    });
  });

  it('should make POST request with body', async () => {
    const requestData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ...requestData,
    };

    axiosMock.request.mockResolvedValueOnce({
      status: 201,
      statusText: 'Created',
      headers: {},
      data: mockUser,
    });

    const client = createClient(apiContract, {
      axios: axiosMock,
    });

    const result = await client.createUser(requestData);

    expect(result).toEqual(mockUser);
    expect(axiosMock.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/users',
        method: 'post',
        data: requestData,
      })
    );
  });

  it('should make GET request with query params', async () => {
    const mockResponse = {
      users: [],
      total: 0,
    };

    axiosMock.request.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockResponse,
    });

    const client = createClient(apiContract, {
      axios: axiosMock,
    });

    const result = await client.getUsers({
      page: 1,
      limit: 10,
    });

    expect(result).toEqual(mockResponse);
    expect(axiosMock.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/users?page=1&limit=10',
        method: 'get',
      })
    );
  });

  it('should validate request data', async () => {
    const client = createClient(apiContract, {
      axios: axiosMock,
      validateRequest: true,
    });

    await expect(
      client.getUser({
        id: 'invalid-uuid',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should validate response data', async () => {
    axiosMock.request.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { invalid: 'response' },
    });

    const client = createClient(apiContract, {
      axios: axiosMock,
      validateResponse: true,
    });

    await expect(
      client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should handle HTTP errors', async () => {
    axiosMock.request.mockResolvedValueOnce({
      status: 404,
      statusText: 'Not Found',
      headers: {},
      data: { error: 'User not found' },
    });

    const client = createClient(apiContract, {
      axios: axiosMock,
      validateResponse: false, // Disable response validation to test HTTP error
    });

    await expect(
      client.getUser({
        id: '123e4567-e89b-12d3-a456-426614174000',
      })
    ).rejects.toThrow(HttpError);
  });

  it('should disable validation when configured', async () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
    };

    axiosMock.request.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockUser,
    });

    const client = createClient(apiContract, {
      axios: axiosMock,
      validateRequest: false,
      validateResponse: false,
    });

    // This should not throw an error, even if UUID is invalid
    const result = await client.getUser({
      id: 'invalid-uuid',
    } as unknown as typeof client.getUser.infer.request);

    expect(result).toEqual(mockUser);
  });
});
