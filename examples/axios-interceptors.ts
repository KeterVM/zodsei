import { z } from 'zod';
import { createClient, AxiosAdapter, defineContract } from '../src';

// Define API contract
const apiContract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({
      id: z.string(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },

  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({
      name: z.string(),
      email: z.string(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
});

// Example 1: Use request interceptor to add auth token
const clientWithAuth = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: new AxiosAdapter({
    interceptors: {
      request: [
        {
          onFulfilled: (config) => {
            // Add auth token to every request
            const token = localStorage.getItem('authToken');
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
            console.log('🔐 Request interceptor: Added auth token');
            return config;
          },
          onRejected: (error) => {
            console.error('❌ Request interceptor error:', error);
            return Promise.reject(error);
          },
        },
      ],
    },
  }),
});

// Example 2: Use response interceptor to handle common errors
const clientWithErrorHandling = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: new AxiosAdapter({
    interceptors: {
      response: [
        {
          onFulfilled: (response) => {
            console.log('✅ Response interceptor: Success response');
            return response;
          },
          onRejected: (error) => {
            console.log('🔄 Response interceptor: Handling error');
            
            // Handle 401 unauthorized error
            if (error.response?.status === 401) {
              console.log('🚪 Redirecting to login...');
              // Clear local token
              localStorage.removeItem('authToken');
              // Redirect to login page
              window.location.href = '/login';
            }
            
            // Handle 403 forbidden error
            if (error.response?.status === 403) {
              console.log('🚫 Access forbidden');
              // Show insufficient permission message
            }
            
            return Promise.reject(error);
          },
        },
      ],
    },
  }),
});

// Example 3: Use both request and response interceptors
const clientWithFullInterceptors = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: new AxiosAdapter({
    timeout: 10000,
    interceptors: {
      request: [
        {
          // First request interceptor: add timestamp
          onFulfilled: (config) => {
            config.metadata = { startTime: Date.now() };
            console.log('⏰ Request interceptor 1: Added timestamp');
            return config;
          },
        },
        {
          // Second request interceptor: add auth and logging
          onFulfilled: (config) => {
            const token = process.env.API_TOKEN || 'demo-token';
            config.headers.Authorization = `Bearer ${token}`;
            config.headers['X-Client-Version'] = '1.0.0';
            
            console.log('📤 Request interceptor 2:', {
              method: config.method?.toUpperCase(),
              url: config.url,
              headers: config.headers,
            });
            
            return config;
          },
          onRejected: (error) => {
            console.error('❌ Request failed in interceptor:', error);
            return Promise.reject(error);
          },
        },
      ],
      response: [
        {
          // Response interceptor: log response time and data
          onFulfilled: (response) => {
            const startTime = response.config.metadata?.startTime;
            const duration = startTime ? Date.now() - startTime : 0;
            
            console.log('📥 Response interceptor:', {
              status: response.status,
              statusText: response.statusText,
              duration: `${duration}ms`,
              url: response.config.url,
            });
            
            // Can perform global response data processing here
            if (response.data && typeof response.data === 'object') {
              response.data._metadata = {
                timestamp: new Date().toISOString(),
                duration,
              };
            }
            
            return response;
          },
          onRejected: (error) => {
            const startTime = error.config?.metadata?.startTime;
            const duration = startTime ? Date.now() - startTime : 0;
            
            console.error('❌ Response error interceptor:', {
              status: error.response?.status,
              statusText: error.response?.statusText,
              duration: `${duration}ms`,
              message: error.message,
            });
            
            return Promise.reject(error);
          },
        },
      ],
    },
  }),
});

// Example 4: Use interceptor to implement request retry
const clientWithRetry = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: new AxiosAdapter({
    interceptors: {
      response: [
        {
          onRejected: async (error) => {
            const config = error.config;
            
            // If it's a network error or 5xx error, and hasn't retried yet
            if (
              (!error.response || error.response.status >= 500) &&
              !config._retry
            ) {
              config._retry = true;
              console.log('🔄 Retrying request due to error:', error.message);
              
              // Wait 1 second before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Resend the request
              const axios = await import('axios');
              return axios.default.request(config);
            }
            
            return Promise.reject(error);
          },
        },
      ],
    },
  }),
});

// Usage example
async function demonstrateInterceptors() {
  try {
    console.log('🚀 Testing axios interceptors...\n');

    // Simulate setting auth token
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('authToken', 'demo-jwt-token-12345');
    }

    // Test authenticated request
    console.log('1️⃣ Testing request with auth interceptor:');
    // const user = await clientWithAuth.getUser({ id: '123' });
    // console.log('User:', user);

    console.log('\n2️⃣ Testing request with full interceptors:');
    // const newUser = await clientWithFullInterceptors.createUser({
    //   name: 'John Doe',
    //   email: 'john@example.com',
    // });
    // console.log('New user:', newUser);

    console.log('\n✅ Interceptor examples completed!');
  } catch (error) {
    console.error('❌ Error in interceptor demo:', error);
  }
}

// Export client instance for use elsewhere
export {
  clientWithAuth,
  clientWithErrorHandling,
  clientWithFullInterceptors,
  clientWithRetry,
  demonstrateInterceptors,
};

// If running this file directly, execute demo
if (require.main === module) {
  demonstrateInterceptors();
}
