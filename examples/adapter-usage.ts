import { createClient, z, AxiosAdapter, KyAdapter } from '../src';

// Define API contract
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

  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    response: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    }),
  },
} as const;

// Example 1: Use default fetch adapter
const fetchClient = createClient(apiContract, {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  adapter: 'fetch', // Default value, can be omitted
  adapterConfig: {
    timeout: 10000,
    credentials: 'include',
  },
});

// Example 2: Use Axios adapter
const axiosClient = createClient(apiContract, {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  adapter: 'axios',
  adapterConfig: {
    timeout: 15000,
    withCredentials: true,
    maxRedirects: 5,
  },
});

// Example 3: Use Ky adapter
const kyClient = createClient(apiContract, {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  adapter: 'ky',
  adapterConfig: {
    timeout: 12000,
    retry: 3,
    credentials: 'include',
  },
});

// Example 4: Use custom adapter instance
const customAxiosClient = createClient(apiContract, {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  adapter: new AxiosAdapter({
    timeout: 20000,
    withCredentials: true,
    auth: {
      username: 'user',
      password: 'pass',
    },
  }),
});

// Example 5: Use custom Ky adapter instance
const customKyClient = createClient(apiContract, {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  adapter: new KyAdapter({
    timeout: 8000,
    retry: {
      limit: 5,
      methods: ['get', 'post'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3000,
    },
  }),
});

// Usage example
async function demonstrateAdapters() {
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  console.log('🔄 Testing different HTTP adapters...\n');

  try {
    // Use Fetch adapter
    console.log('📡 Using Fetch adapter:');
    const fetchUser = await fetchClient.getUser({ id: userId });
    console.log('✅ Fetch result:', fetchUser);

    // Use Axios adapter
    console.log('\n📡 Using Axios adapter:');
    const axiosUser = await axiosClient.getUser({ id: userId });
    console.log('✅ Axios result:', axiosUser);

    // Use Ky adapter
    console.log('\n📡 Using Ky adapter:');
    const kyUser = await kyClient.getUser({ id: userId });
    console.log('✅ Ky result:', kyUser);

    // Create user example
    console.log('\n➕ Creating user with different adapters:');

    const newUserData = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    const fetchNewUser = await fetchClient.createUser(newUserData);
    console.log('✅ Fetch create:', fetchNewUser);

    const axiosNewUser = await axiosClient.createUser(newUserData);
    console.log('✅ Axios create:', axiosNewUser);

    const kyNewUser = await kyClient.createUser(newUserData);
    console.log('✅ Ky create:', kyNewUser);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Adapter feature comparison
function compareAdapters() {
  console.log('\n📊 Adapter Features Comparison:');
  console.log('┌─────────────┬─────────┬─────────┬─────────┐');
  console.log('│ Feature     │ Fetch   │ Axios   │ Ky      │');
  console.log('├─────────────┼─────────┼─────────┼─────────┤');
  console.log('│ Built-in    │ ✅      │ ❌      │ ❌      │');
  console.log('│ Node.js     │ ✅      │ ✅      │ ✅      │');
  console.log('│ Browser     │ ✅      │ ✅      │ ✅      │');
  console.log('│ Retry       │ ❌      │ ❌      │ ✅      │');
  console.log('│ Interceptors│ ❌      │ ✅      │ ❌      │');
  console.log('│ Progress    │ ❌      │ ✅      │ ❌      │');
  console.log('│ Size        │ 0KB     │ ~13KB   │ ~4KB    │');
  console.log('└─────────────┴─────────┴─────────┴─────────┘');
}

// Run example
if (require.main === module) {
  demonstrateAdapters().then(() => {
    compareAdapters();
    console.log('\n🎉 Adapter demonstration completed!');
  });
}

export { fetchClient, axiosClient, kyClient, customAxiosClient, customKyClient };
