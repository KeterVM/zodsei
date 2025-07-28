import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient, AxiosAdapter } from '../src';

// Mock axios instance
const mockAxiosInstance = {
  request: vi.fn(),
  interceptors: {
    request: {
      use: vi.fn(),
    },
    response: {
      use: vi.fn(),
    },
  },
};

// Mock axios
const mockAxios = {
  create: vi.fn(() => mockAxiosInstance),
  request: vi.fn(),
  interceptors: {
    request: {
      use: vi.fn(),
    },
    response: {
      use: vi.fn(),
    },
  },
};

// Mock axios import - handle both static and dynamic imports
vi.mock('axios', async () => {
  return {
    default: mockAxios,
    ...mockAxios,
  };
});

describe('AxiosAdapter Interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockAxios.create.mockImplementation(() => mockAxiosInstance);
    
    // Mock both axios and axios instance request methods
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        id: '123',
        name: 'John Doe',
      },
    };
    
    mockAxios.request.mockResolvedValue(mockResponse);
    mockAxiosInstance.request.mockResolvedValue(mockResponse);
  });

  const testContract = {
    getUser: {
      path: '/users/:id',
      method: 'get' as const,
      request: z.object({
        id: z.string(),
      }),
      response: z.object({
        id: z.string(),
        name: z.string(),
      }),
    },
  } as const;

  it('should setup request interceptors', async () => {
    const requestInterceptor = {
      onFulfilled: vi.fn((config) => config),
      onRejected: vi.fn(),
    };

    const adapter = new AxiosAdapter({
      interceptors: {
        request: [requestInterceptor],
      },
    });

    // Trigger getAxios call to execute setupInterceptors
    await adapter.request({
      url: 'https://api.example.com/test',
      method: 'get',
      headers: {},
      body: undefined,
    });

    expect(mockAxios.create).toHaveBeenCalled();
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
      requestInterceptor.onFulfilled,
      requestInterceptor.onRejected
    );
  });

  it('should setup response interceptors', async () => {
    const responseInterceptor = {
      onFulfilled: vi.fn((response) => response),
      onRejected: vi.fn(),
    };

    const adapter = new AxiosAdapter({
      interceptors: {
        response: [responseInterceptor],
      },
    });

    // Trigger getAxios call to execute setupInterceptors
    await adapter.request({
      url: 'https://api.example.com/test',
      method: 'get',
      headers: {},
      body: undefined,
    });

    expect(mockAxios.create).toHaveBeenCalled();
    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
      responseInterceptor.onFulfilled,
      responseInterceptor.onRejected
    );
  });

  it('should setup multiple interceptors', async () => {
    const requestInterceptor1 = {
      onFulfilled: vi.fn((config) => config),
    };
    const requestInterceptor2 = {
      onFulfilled: vi.fn((config) => config),
      onRejected: vi.fn(),
    };

    const adapter = new AxiosAdapter({
      interceptors: {
        request: [requestInterceptor1, requestInterceptor2],
      },
    });

    // Trigger getAxios call to execute setupInterceptors
    await adapter.request({
      url: 'https://api.example.com/test',
      method: 'get',
      headers: {},
      body: undefined,
    });

    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(2);
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenNthCalledWith(
      1,
      requestInterceptor1.onFulfilled,
      undefined // requestInterceptor1 has no onRejected
    );
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenNthCalledWith(
      2,
      requestInterceptor2.onFulfilled,
      requestInterceptor2.onRejected
    );
  });

  it('should work without interceptors', async () => {
    const adapter = new AxiosAdapter({});

    // Trigger getAxios call, but should not create new instance
    await adapter.request({
      url: 'https://api.example.com/test',
      method: 'get',
      headers: {},
      body: undefined,
    });

    // Should use default axios, not create new instance
    expect(mockAxios.create).not.toHaveBeenCalled();
    expect(mockAxios.request).toHaveBeenCalled();
  });

  it('should handle interceptors without onRejected', async () => {
    const requestInterceptor = {
      onFulfilled: vi.fn((config) => config),
      // No onRejected
    };

    // Mock successful response
    mockAxiosInstance.request.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: true },
    });

    const adapter = new AxiosAdapter({
      interceptors: {
        request: [requestInterceptor],
      },
    });

    await adapter.request({
      url: 'https://api.example.com/test',
      method: 'get',
      headers: {},
      body: undefined,
    });

    expect(mockAxios.create).toHaveBeenCalled();
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
      requestInterceptor.onFulfilled,
      undefined
    );
  });

  it('should integrate with client', async () => {
    const requestInterceptor = {
      onFulfilled: vi.fn((config) => {
        config.headers.Authorization = 'Bearer test-token';
        return config;
      }),
      onRejected: vi.fn(),
    };

    mockAxiosInstance.request.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { id: '123', name: 'John Doe' },
    });

    const client = createClient(testContract, {
      baseUrl: 'https://api.example.com',
      adapter: new AxiosAdapter({
        interceptors: {
          request: [requestInterceptor],
        },
      }),
    });

    // Call client method to trigger interceptor setup
    await client.getUser({ id: '123' });

    expect(mockAxios.create).toHaveBeenCalled();
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
      requestInterceptor.onFulfilled,
      requestInterceptor.onRejected
    );
  });
});
