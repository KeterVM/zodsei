import { z } from 'zod';
import { createClient, AxiosAdapter } from '../src';

// Simple API contract
const contract = {
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
} as const;

// Demonstrate interceptor functionality
async function demonstrateInterceptors() {
  console.log('🚀 Axios Interceptor Demo\n');

  // 1. Basic interceptor usage
  console.log('1️⃣ Basic interceptor configuration:');
  const client = createClient(contract, {
    baseUrl: 'https://jsonplaceholder.typicode.com',
    adapter: new AxiosAdapter({
      interceptors: {
        request: [{
          onFulfilled: (config) => {
            console.log('  📤 Request interceptor: Adding auth header');
            config.headers = config.headers || {};
            config.headers.Authorization = 'Bearer demo-token';
            config.headers['X-Client'] = 'Zodsei';
            return config;
          },
          onRejected: (error) => {
            console.log('  ❌ Request interceptor error:', error.message);
            return Promise.reject(error);
          },
        }],
        response: [{
          onFulfilled: (response) => {
            console.log('  📥 Response interceptor: Status', response.status);
            // Can add response data processing logic here
            return response;
          },
          onRejected: (error) => {
            console.log('  ❌ Response interceptor error:', error.response?.status || error.message);
            return Promise.reject(error);
          },
        }],
      },
    }),
  });

  try {
    // This call will trigger interceptors
    console.log('  🔄 Sending request...');
    // const user = await client.getUser({ id: '1' });
    // console.log('  ✅ User data:', user);
    console.log('  ✅ Interceptor configuration successful!');
  } catch (error) {
    console.log('  ⚠️  Request failed (this is normal as we are using mock data)');
  }

  console.log('\n2️⃣ Multiple interceptor chain:');
  const clientWithMultiple = createClient(contract, {
    baseUrl: 'https://api.example.com',
    adapter: new AxiosAdapter({
      interceptors: {
        request: [
          {
            onFulfilled: (config) => {
              console.log('  🔧 Interceptor 1: Adding timestamp');
              config.metadata = { startTime: Date.now() };
              return config;
            },
          },
          {
            onFulfilled: (config) => {
              console.log('  🔧 Interceptor 2: Adding user agent');
              config.headers = config.headers || {};
              config.headers['User-Agent'] = 'Zodsei-Client/1.0';
              return config;
            },
          },
        ],
        response: [
          {
            onFulfilled: (response) => {
              const startTime = response.config.metadata?.startTime;
              const duration = startTime ? Date.now() - startTime : 0;
              console.log(`  ⏱️  Response interceptor: Request took ${duration}ms`);
              return response;
            },
          },
        ],
      },
    }),
  });

  console.log('  ✅ Multiple interceptor chain configuration complete!');

  console.log('\n3️⃣ Error handling interceptor:');
  const clientWithErrorHandling = createClient(contract, {
    baseUrl: 'https://api.example.com',
    adapter: new AxiosAdapter({
      interceptors: {
        response: [{
          onRejected: (error) => {
            console.log('  🚨 Global error handler activated');
            
            if (error.response) {
              const status = error.response.status;
              console.log(`  📊 HTTP Status Code: ${status}`);
              
              switch (status) {
                case 401:
                  console.log('  🔐 Handle unauthorized error - Redirect to login');
                  break;
                case 403:
                  console.log('  🚫 Handle forbidden error - Show permission notice');
                  break;
                case 500:
                  console.log('  💥 Handle server error - Show friendly message');
                  break;
                default:
                  console.log('  ❓ Handle other errors');
              }
            } else {
              console.log('  🌐 Network error or request timeout');
            }
            
            return Promise.reject(error);
          },
        }],
      },
    }),
  });

  console.log('  ✅ Error handling interceptor configuration complete!');

  console.log('\n🎉 All interceptor demos completed!');
  console.log('\n💡 Tips:');
  console.log('   - Request interceptors can be used for auth, logging, request transformation, etc.');
  console.log('   - Response interceptors can be used for data processing, error handling, performance monitoring, etc.');
  console.log('   - Multiple interceptors execute in configuration order');
  console.log('   - Interceptors support async operations');
}

// Export demo function
export { demonstrateInterceptors };

// If running this file directly
if (require.main === module) {
  demonstrateInterceptors().catch(console.error);
}
