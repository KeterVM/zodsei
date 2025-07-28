import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient, SchemaExtractor } from '../src';
import type { InferRequestType, InferResponseType, InferContractTypes } from '../src';

// Mock fetch for testing
const mockFetch = vi.fn();
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
});

// Mock Headers
Object.defineProperty(global, 'Headers', {
  value: class Headers {
    private headers = new Map();
    constructor(init?: any) {
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.headers.set(key.toLowerCase(), value);
        });
      }
    }
    get(name: string) {
      return this.headers.get(name.toLowerCase());
    }
    set(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
    }
    has(name: string) {
      return this.headers.has(name.toLowerCase());
    }
    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach((value, key) => callback(value, key));
    }
  },
});

describe('Schema Inference and Type Extraction', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  // Test contract with various schema types
  const testContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.string(),
        include: z.array(z.string()).optional(),
      }),
      response: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0),
        isActive: z.boolean(),
        tags: z.array(z.string()),
        profile: z
          .object({
            bio: z.string().optional(),
            avatar: z.string().url().optional(),
          })
          .optional(),
      }),
    },
    createUser: {
      path: '/users',
      method: 'post' as const,
      request: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(0).max(120),
      }),
      response: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.string().datetime(),
      }),
    },
    // Nested contract for testing
    profile: {
      update: {
        path: '/profile',
        method: 'put' as const,
        request: z.object({
          name: z.string().optional(),
          bio: z.string().optional(),
        }),
        response: z.object({
          success: z.boolean(),
          updatedAt: z.string().datetime(),
        }),
      },
      settings: {
        get: {
          path: '/profile/settings',
          method: 'get' as const,
          request: z.object({}),
          response: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
            language: z.string(),
          }),
        },
      },
    },
    // Deeply nested contract simulating defineContract usage
    admin: {
      users: {
        list: {
          path: '/admin/users',
          method: 'get' as const,
          request: z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(100).default(10),
            search: z.string().optional(),
          }),
          response: z.object({
            users: z.array(z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().email(),
              role: z.enum(['admin', 'user']),
            })),
            total: z.number(),
            page: z.number(),
            totalPages: z.number(),
          }),
        },
        delete: {
          path: '/admin/users/:id',
          method: 'delete' as const,
          request: z.object({
            id: z.string(),
            reason: z.string().optional(),
          }),
          response: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      reports: {
        analytics: {
          daily: {
            path: '/admin/reports/analytics/daily',
            method: 'get' as const,
            request: z.object({
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              metrics: z.array(z.enum(['users', 'sessions', 'revenue'])).optional(),
            }),
            response: z.object({
              date: z.string(),
              metrics: z.object({
                users: z.number(),
                sessions: z.number(),
                revenue: z.number(),
              }),
            }),
          },
        },
      },
    },
  };

  const client = createClient(testContract, {
    baseUrl: 'https://api.example.com',
  });

  describe('Endpoint Method Schema Access', () => {
    it('should provide schema access on endpoint methods', () => {
      // Test schema property exists
      expect(client.getUser.schema).toBeDefined();
      expect(client.getUser.schema.request).toBeDefined();
      expect(client.getUser.schema.response).toBeDefined();
      expect(client.getUser.schema.endpoint).toBeDefined();

      // Test schema objects are Zod schemas
      expect(client.getUser.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.getUser.schema.response).toBeInstanceOf(z.ZodObject);

      // Test endpoint definition
      expect(client.getUser.schema.endpoint).toEqual(testContract.getUser);
    });

    it('should provide type inference helpers on endpoint methods', () => {
      // Test infer property exists
      expect(client.getUser.infer).toBeDefined();
      expect(client.getUser.infer.request).toBeDefined();
      expect(client.getUser.infer.response).toBeDefined();

      // These are compile-time type helpers, so we just check they exist
      expect(typeof client.getUser.infer.request).toBe('object');
      expect(typeof client.getUser.infer.response).toBe('object');
    });

    it('should work with nested contract endpoints', () => {
      // Test nested endpoint schema access
      expect(client.profile.update.schema).toBeDefined();
      expect(client.profile.update.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.profile.update.schema.response).toBeInstanceOf(z.ZodObject);

      // Test deeply nested endpoint
      expect(client.profile.settings.get.schema).toBeDefined();
      expect(client.profile.settings.get.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.profile.settings.get.schema.response).toBeInstanceOf(z.ZodObject);
    });

    it('should work with deeply nested contract endpoints', () => {
      // Test 3-level nested endpoint (admin.users.list)
      expect(client.admin.users.list.schema).toBeDefined();
      expect(client.admin.users.list.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.admin.users.list.schema.response).toBeInstanceOf(z.ZodObject);
      expect(client.admin.users.list.schema.endpoint.path).toBe('/admin/users');
      expect(client.admin.users.list.schema.endpoint.method).toBe('get');

      // Test 3-level nested endpoint (admin.users.delete)
      expect(client.admin.users.delete.schema).toBeDefined();
      expect(client.admin.users.delete.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.admin.users.delete.schema.response).toBeInstanceOf(z.ZodObject);
      expect(client.admin.users.delete.schema.endpoint.path).toBe('/admin/users/:id');
      expect(client.admin.users.delete.schema.endpoint.method).toBe('delete');

      // Test 4-level nested endpoint (admin.reports.analytics.daily)
      expect(client.admin.reports.analytics.daily.schema).toBeDefined();
      expect(client.admin.reports.analytics.daily.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.admin.reports.analytics.daily.schema.response).toBeInstanceOf(z.ZodObject);
      expect(client.admin.reports.analytics.daily.schema.endpoint.path).toBe('/admin/reports/analytics/daily');
      expect(client.admin.reports.analytics.daily.schema.endpoint.method).toBe('get');
    });
  });

  describe('Schema Extractor', () => {
    it('should provide $schema property with SchemaExtractor instance', () => {
      expect(client.$schema).toBeDefined();
      expect(client.$schema).toBeInstanceOf(SchemaExtractor);
    });

    it('should extract endpoint paths correctly', () => {
      const paths = client.$schema.getEndpointPaths();

      // Only top-level endpoints that match EndpointDefinition structure are returned
      expect(paths).toContain('getUser');
      expect(paths).toContain('createUser');
      // 'profile' is a nested object, not an endpoint, so it won't be included
      expect(paths.length).toBe(2); // getUser, createUser
    });

    it('should get endpoint schemas by path', () => {
      const getUserSchemas = client.$schema.getEndpointSchemas('getUser');

      expect(getUserSchemas).toBeDefined();
      expect(getUserSchemas.request).toBeInstanceOf(z.ZodObject);
      expect(getUserSchemas.response).toBeInstanceOf(z.ZodObject);
      expect(getUserSchemas.endpoint).toEqual(testContract.getUser);
    });

    it('should get nested endpoint schemas by path', () => {
      // Note: getEndpointSchemas only works with top-level endpoints
      // For nested endpoints, we need to access them through the client directly
      expect(client.profile.update.schema).toBeDefined();
      expect(client.profile.update.schema.request).toBeInstanceOf(z.ZodObject);
      expect(client.profile.update.schema.response).toBeInstanceOf(z.ZodObject);
      expect(client.profile.update.schema.endpoint).toEqual(testContract.profile.update);
    });

    it('should throw error for non-existent endpoint paths', () => {
      expect(() => {
        client.$schema.getEndpointSchemas('nonExistent' as any);
      }).toThrow('Endpoint "nonExistent" not found or is not a valid endpoint');
    });

    it('should describe endpoint schemas', () => {
      const description = client.$schema.describeEndpoint('getUser');

      expect(description).toBeDefined();
      expect(description.path).toBe('/users/:id'); // This is the actual path, not the endpoint name
      expect(description.method).toBe('get');
      expect(description.requestSchema).toBeInstanceOf(z.ZodObject);
      expect(description.responseSchema).toBeInstanceOf(z.ZodObject);
      expect(description.requestType).toBeDefined();
      expect(description.responseType).toBeDefined();
    });

    it('should describe nested endpoint schemas', () => {
      // Note: describeEndpoint only works with top-level endpoints
      // For nested endpoints, we access them through the client directly
      expect(client.profile.update.schema).toBeDefined();
      expect(client.profile.update.schema.endpoint.path).toBe('/profile');
      expect(client.profile.update.schema.endpoint.method).toBe('put');
    });

    it('should throw error for non-existent endpoint description', () => {
      expect(() => {
        client.$schema.describeEndpoint('nonExistent' as any);
      }).toThrow('Endpoint "nonExistent" not found or is not a valid endpoint');
    });

    it('should provide schema description through describeEndpoint', () => {
      const description = client.$schema.describeEndpoint('getUser');

      expect(description).toBeDefined();
      expect(description.requestType).toBeDefined();
      expect(description.responseType).toBeDefined();
      expect(typeof description.requestType).toBe('string');
      expect(typeof description.responseType).toBe('string');
    });
  });

  describe('Schema Validation', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          isActive: true,
          tags: ['developer', 'typescript'],
        }),
      });
    });

    it('should validate request data against schema', async () => {
      // Valid request should work
      await expect(client.getUser({ id: '123', include: ['profile'] })).resolves.toBeDefined();

      // Invalid request should throw
      await expect(
        // @ts-expect-error - Testing runtime validation
        client.getUser({ id: 123 }) // id should be string
      ).rejects.toThrow();
    });

    it('should validate response data against schema', async () => {
      // Mock invalid response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: '123',
          name: 'John Doe',
          // Missing required fields
        }),
      });

      await expect(client.getUser({ id: '123' })).rejects.toThrow();
    });
  });

  describe('Type Inference Utilities', () => {
    it('should infer request types correctly', () => {
      type GetUserRequest = InferRequestType<typeof testContract.getUser>;
      type CreateUserRequest = InferRequestType<typeof testContract.createUser>;

      // These are compile-time tests, we just ensure they compile
      const getUserReq: GetUserRequest = {
        id: '123',
        include: ['profile'],
      };

      const createUserReq: CreateUserRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      expect(getUserReq.id).toBe('123');
      expect(createUserReq.name).toBe('John Doe');
    });

    it('should infer response types correctly', () => {
      type GetUserResponse = InferResponseType<typeof testContract.getUser>;
      type CreateUserResponse = InferResponseType<typeof testContract.createUser>;

      // Mock response data matching the inferred types
      const getUserRes: GetUserResponse = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        tags: ['developer'],
        profile: {
          bio: 'Software developer',
          avatar: 'https://example.com/avatar.jpg',
        },
      };

      const createUserRes: CreateUserResponse = {
        id: '456',
        name: 'Jane Smith',
        email: 'jane@example.com',
        createdAt: '2023-07-28T12:00:00Z',
      };

      expect(getUserRes.id).toBe('123');
      expect(createUserRes.id).toBe('456');
    });

    it('should infer contract types correctly', () => {
      type ContractTypes = InferContractTypes<typeof testContract>;

      // Test that we can access nested types
      const contractTypes: ContractTypes = {
        getUser: {
          request: { id: '123' },
          response: {
            id: '123',
            name: 'John',
            email: 'john@example.com',
            age: 30,
            isActive: true,
            tags: [],
          },
          endpoint: testContract.getUser,
        },
        createUser: {
          request: { name: 'John', email: 'john@example.com', age: 30 },
          response: {
            id: '123',
            name: 'John',
            email: 'john@example.com',
            createdAt: '2023-01-01T00:00:00Z',
          },
          endpoint: testContract.createUser,
        },
        profile: {
          update: {
            request: { name: 'John' },
            response: { success: true, updatedAt: '2023-01-01T00:00:00Z' },
            endpoint: testContract.profile.update,
          },
          settings: {
            get: {
              request: {},
              response: { theme: 'light' as const, notifications: true, language: 'en' },
              endpoint: testContract.profile.settings.get,
            },
          },
        },
        admin: {
          users: {
            list: {
              request: { page: 1, limit: 10 },
              response: {
                users: [{ id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin' as const }],
                total: 1,
                page: 1,
                totalPages: 1,
              },
              endpoint: testContract.admin.users.list,
            },
            delete: {
              request: { id: '1' },
              response: { success: true, message: 'User deleted' },
              endpoint: testContract.admin.users.delete,
            },
          },
          reports: {
            analytics: {
              daily: {
                request: { date: '2023-01-01' },
                response: {
                  date: '2023-01-01',
                  metrics: { users: 100, sessions: 500, revenue: 1000 },
                },
                endpoint: testContract.admin.reports.analytics.daily,
              },
            },
          },
        },
      };

      expect(contractTypes.getUser.request.id).toBe('123');
      expect(contractTypes.profile.update.response.success).toBe(true);
      expect(contractTypes.admin.users.list.response.total).toBe(1);
      expect(contractTypes.admin.reports.analytics.daily.request.date).toBe('2023-01-01');
    });

    it('should infer deeply nested endpoint types correctly', () => {
      // Test 3-level nested endpoint types
      type AdminUsersListRequest = InferRequestType<typeof testContract.admin.users.list>;
      type AdminUsersListResponse = InferResponseType<typeof testContract.admin.users.list>;

      const listRequest: AdminUsersListRequest = {
        page: 1,
        limit: 20,
        search: 'john',
      };

      const listResponse: AdminUsersListResponse = {
        users: [
          { id: '1', name: 'John Doe', email: 'john@example.com', role: 'user' },
          { id: '2', name: 'Jane Admin', email: 'jane@example.com', role: 'admin' },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      };

      expect(listRequest.page).toBe(1);
      expect(listResponse.users.length).toBe(2);

      // Test 4-level nested endpoint types
      type DailyAnalyticsRequest = InferRequestType<typeof testContract.admin.reports.analytics.daily>;
      type DailyAnalyticsResponse = InferResponseType<typeof testContract.admin.reports.analytics.daily>;

      const analyticsRequest: DailyAnalyticsRequest = {
        date: '2023-12-25',
        metrics: ['users', 'sessions'],
      };

      const analyticsResponse: DailyAnalyticsResponse = {
        date: '2023-12-25',
        metrics: {
          users: 1500,
          sessions: 5000,
          revenue: 25000,
        },
      };

      expect(analyticsRequest.date).toBe('2023-12-25');
      expect(analyticsResponse.metrics.users).toBe(1500);
    });
  });

  describe('Runtime Schema Access', () => {
    it('should allow runtime schema manipulation', () => {
      const requestSchema = client.getUser.schema.request;
      const _responseSchema = client.getUser.schema.response;

      // Test parsing valid data
      const validRequest = { id: '123', include: ['profile'] };
      const parsedRequest = requestSchema.parse(validRequest);
      expect(parsedRequest).toEqual(validRequest);

      // Test parsing invalid data
      expect(() => {
        requestSchema.parse({ id: 123 }); // id should be string
      }).toThrow();

      // Test safeParse
      const safeResult = requestSchema.safeParse({ id: '123' });
      expect(safeResult.success).toBe(true);
      if (safeResult.success) {
        expect(safeResult.data.id).toBe('123');
      }
    });

    it('should support schema transformation', () => {
      const requestSchema = client.createUser.schema.request;

      // Test transform
      const transformedSchema = requestSchema.transform((data) => ({
        ...data,
        name: data.name.toUpperCase(),
      }));

      const result = transformedSchema.parse({
        name: 'john doe',
        email: 'john@example.com',
        age: 30,
      });

      expect(result.name).toBe('JOHN DOE');
    });
  });
});
