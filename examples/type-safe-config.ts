import { z, defineContract, createClient } from '../src';

// Define a simple contract
const contract = defineContract({
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
});

// Example 1: Fetch adapter with type-safe configuration
// When adapter is 'fetch', adapterConfig is automatically typed as FetchAdapterConfig
const fetchClient = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'fetch', // 👈 This determines the type of adapterConfig
  adapterConfig: {
    // ✅ TypeScript knows these are fetch-specific options
    timeout: 5000,
    credentials: 'include', // ✅ RequestCredentials
    mode: 'cors',           // ✅ RequestMode
    cache: 'no-cache',      // ✅ RequestCache
    redirect: 'follow',     // ✅ RequestRedirect
    referrerPolicy: 'no-referrer', // ✅ ReferrerPolicy
    integrity: 'sha256-abc123',     // ✅ string
    // auth: { username: 'test' },  // ❌ TypeScript error: not valid for fetch
  },
});

// Example 2: Axios adapter with type-safe configuration
// When adapter is 'axios', adapterConfig is automatically typed as AxiosAdapterConfig
const axiosClient = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'axios', // 👈 This determines the type of adapterConfig
  adapterConfig: {
    // ✅ TypeScript knows these are axios-specific options
    timeout: 10000,
    maxRedirects: 5,        // ✅ Only available in axios
    auth: {                 // ✅ Only available in axios
      username: 'user',
      password: 'pass',
    },
    proxy: {                // ✅ Only available in axios
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080,
    },
    interceptors: {         // ✅ Only available in axios
      request: [
        {
          onFulfilled: (config) => {
            console.log('Request interceptor:', config);
            return config;
          },
          onRejected: (error) => {
            console.error('Request error:', error);
            return Promise.reject(error);
          },
        },
      ],
      response: [
        {
          onFulfilled: (response) => {
            console.log('Response interceptor:', response);
            return response;
          },
          onRejected: (error) => {
            console.error('Response error:', error);
            return Promise.reject(error);
          },
        },
      ],
    },
    // credentials: 'include', // ❌ TypeScript error: not valid for axios
  },
});

// Example 3: Ky adapter with type-safe configuration
const kyClient = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'ky',
  adapterConfig: {
    // TypeScript will provide autocomplete and type checking for ky-specific options
    timeout: 15000,
    retry: {
      limit: 3,
      methods: ['get', 'put'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3000,
    },
    throwHttpErrors: false,
    credentials: 'same-origin',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    hooks: {
      beforeRequest: [
        (request) => {
          console.log('Before request:', request);
        },
      ],
      afterResponse: [
        (request, options, response) => {
          console.log('After response:', response);
          return response;
        },
      ],
    },
  },
});

// Example 4: Default adapter (no adapter specified, defaults to fetch)
const defaultClient = createClient(contract, {
  baseUrl: 'https://api.example.com',
  // No adapter specified - defaults to 'fetch'
  adapterConfig: {
    // ✅ TypeScript knows this defaults to FetchAdapterConfig
    timeout: 8000,
    credentials: 'same-origin', // ✅ Valid for fetch
    mode: 'cors',
    // retry: { limit: 3 },     // ❌ TypeScript error: not valid for fetch
  },
});

// Usage examples
async function examples() {
  try {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    const user1 = await fetchClient.getUser({ id: userId });
    const user2 = await axiosClient.getUser({ id: userId });
    const user3 = await kyClient.getUser({ id: userId });
    const user4 = await defaultClient.getUser({ id: userId });

    console.log('Users:', { user1, user2, user3, user4 });
  } catch (error) {
    console.error('Error:', error);
  }
}

export { fetchClient, axiosClient, kyClient, defaultClient, examples };
