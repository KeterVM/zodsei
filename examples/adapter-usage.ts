import { createClient, z, defineContract, type ApiClient } from '../src';

// Define data schemas for reusability
const UserSchema = z.object({
  id: z.uuidv4(),
  name: z.string().min(1, 'Name is required'),
  email: z.email(),
  createdAt: z.iso.datetime().optional(),
});

const CreateUserRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email(),
});

const UserIdRequestSchema = z.object({
  id: z.uuidv4(),
});

// Define API contract with proper typing
const apiContract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: UserIdRequestSchema,
    response: UserSchema,
  },

  createUser: {
    path: '/users',
    method: 'post' as const,
    request: CreateUserRequestSchema,
    response: UserSchema,
  },

  updateUser: {
    path: '/users/:id',
    method: 'put' as const,
    request: z.object({
      id: z.uuidv4(),
      name: z.string().min(1).optional(),
      email: z.email().optional(),
    }),
    response: UserSchema,
  },

  deleteUser: {
    path: '/users/:id',
    method: 'delete' as const,
    request: UserIdRequestSchema,
    response: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
});

// Type the contract for better IntelliSense
type ApiContractType = typeof apiContract;
type ClientType = ApiClient<ApiContractType>;

// Example 1: Use default fetch adapter with explicit typing
const fetchClient: ClientType = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: 'fetch', // Default value, can be omitted
  adapterConfig: {
    timeout: 10000,
    credentials: 'include',
    cache: 'no-cache',
    mode: 'cors',
  },
});

// Example 2: Use Axios adapter with advanced configuration
const axiosClient: ClientType = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: 'axios',
  adapterConfig: {
    timeout: 15000,
    withCredentials: true,
    maxRedirects: 5,
    validateStatus: (status: number) => status < 500,
    headers: {
      'User-Agent': 'Zodsei-Example/1.0',
    },
  },
});

// Example 3: Use Ky adapter with retry configuration
const kyClient: ClientType = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: 'ky',
  adapterConfig: {
    timeout: 12000,
    retry: {
      limit: 3,
      methods: ['get', 'put', 'delete'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3000,
    },
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  },
});

// Example 4: Use Axios adapter with authentication via adapterConfig (no adapter instances)
const axiosAuthClient: ClientType = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: 'axios',
  adapterConfig: {
    timeout: 20000,
    withCredentials: true,
    auth: {
      username: 'api-user',
      password: 'secure-password',
    },
  },
});

// Example 5: Use Ky adapter with advanced retry via adapterConfig (no adapter instances)
const kyAdvancedRetryClient: ClientType = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  adapter: 'ky',
  adapterConfig: {
    timeout: 8000,
    retry: {
      limit: 5,
      methods: ['get', 'post', 'put', 'delete'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3000,
    },
    hooks: {
      beforeRequest: [
        (request) => {
          console.log('🔄 Ky before request:', request.url);
        },
      ],
      afterResponse: [
        (_request, _options, response) => {
          console.log('✅ Ky after response:', response.status);
        },
      ],
    },
  },
});

// Usage example with comprehensive type safety
async function demonstrateAdapters(): Promise<void> {
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  console.log('🔄 Testing different HTTP adapters with type safety...\n');

  try {
    // Test GET operations with all adapters
    console.log('📡 Testing GET operations:');

    const fetchUser = await fetchClient.getUser({ id: userId });
    console.log('✅ Fetch result:', {
      id: fetchUser.id,
      name: fetchUser.name,
      email: fetchUser.email,
    });

    const axiosUser = await axiosClient.getUser({ id: userId });
    console.log('✅ Axios result:', {
      id: axiosUser.id,
      name: axiosUser.name,
      email: axiosUser.email,
    });

    const kyUser = await kyClient.getUser({ id: userId });
    console.log('✅ Ky result:', {
      id: kyUser.id,
      name: kyUser.name,
      email: kyUser.email,
    });

    // Test POST operations
    console.log('\n➕ Testing POST operations:');

    const newUserData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
    } as const;

    const fetchNewUser = await fetchClient.createUser(newUserData);
    console.log('✅ Fetch create:', fetchNewUser.id);

    const axiosNewUser = await axiosClient.createUser(newUserData);
    console.log('✅ Axios create:', axiosNewUser.id);

    const kyNewUser = await kyClient.createUser(newUserData);
    console.log('✅ Ky create:', kyNewUser.id);

    // Test PUT operations
    console.log('\n🔄 Testing PUT operations:');

    const updateData = {
      id: userId,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    } as const;

    const updatedUser = await fetchClient.updateUser(updateData);
    console.log('✅ User updated:', updatedUser.name);

    // Test DELETE operations
    console.log('\n🗑️ Testing DELETE operations:');

    const deleteResult = await fetchClient.deleteUser({ id: userId });
    console.log('✅ Delete result:', deleteResult.message);
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      });
    } else {
      console.error('❌ Unknown error:', error);
    }
  }
}

// Adapter feature comparison with detailed analysis
function compareAdapters(): void {
  console.log('\n📊 HTTP Adapter Features Comparison:');
  console.log('┌───────────────┬─────────┬─────────┬─────────┐');
  console.log('│ Feature         │ Fetch   │ Axios   │ Ky      │');
  console.log('├───────────────┼─────────┼─────────┼─────────┤');
  console.log('│ Built-in        │ ✅      │ ❌      │ ❌      │');
  console.log('│ Node.js 18+     │ ✅      │ ✅      │ ✅      │');
  console.log('│ Browser         │ ✅      │ ✅      │ ✅      │');
  console.log('│ TypeScript      │ ✅      │ ✅      │ ✅      │');
  console.log('│ Auto Retry      │ ❌      │ ❌      │ ✅      │');
  console.log('│ Middleware      │ ✅      │ ✅      │ ✅      │');
  console.log('│ Upload Progress │ ❌      │ ✅      │ ❌      │');
  console.log('│ Request Cancel  │ ✅      │ ✅      │ ✅      │');
  console.log('│ JSON Auto Parse │ Manual  │ ✅      │ ✅      │');
  console.log('│ Bundle Size     │ 0KB     │ ~13KB   │ ~4KB    │');
  console.log('└───────────────┴─────────┴─────────┴─────────┘');

  console.log('\n📝 Recommendations:');
  console.log('• 🌐 **Fetch**: Best for modern environments, zero dependencies');
  console.log('• 🚀 **Axios**: Best for complex apps needing advanced HTTP features (proxy, auth, progress)');
  console.log('• ⚡ **Ky**: Best balance of features and size, great retry logic');

  console.log('\n🛠️ Configuration Examples:');
  console.log('```typescript');
  console.log('// Fetch: Minimal config');
  console.log('adapter: "fetch"');
  console.log('');
  console.log('// Axios: Full-featured');
  console.log('adapter: "axios", adapterConfig: { timeout: 10000, auth: { username: "u", password: "p" } }');
  console.log('');
  console.log('// Ky: Modern with retry');
  console.log('adapter: "ky", adapterConfig: { retry: { limit: 3 } }');
  console.log('```');
}

// Performance testing function
async function performanceTest(): Promise<void> {
  console.log('\n⚡ Performance Testing:');
  const testUrl = { id: '550e8400-e29b-41d4-a716-446655440000' };

  const adapters = [
    { name: 'Fetch', client: fetchClient },
    { name: 'Axios', client: axiosClient },
    { name: 'Ky', client: kyClient },
  ] as const;

  for (const { name, client } of adapters) {
    const start = performance.now();
    try {
      await client.getUser(testUrl);
      const end = performance.now();
      console.log(`📊 ${name}: ${(end - start).toFixed(2)}ms`);
    } catch (error) {
      console.log(`❌ ${name}: Failed`);
    }
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    await demonstrateAdapters();
    compareAdapters();
    await performanceTest();
    console.log('\n🎉 Adapter demonstration completed successfully!');
  } catch (error) {
    console.error('💥 Demo failed:', error);
    process.exit(1);
  }
}

// Run example when executed directly
if (require.main === module) {
  main();
}

// Export all clients with proper typing
export {
  fetchClient,
  axiosClient,
  kyClient,
  axiosAuthClient,
  kyAdvancedRetryClient,
  type ClientType,
  type ApiContractType,
};

// Export schemas for reuse
export { UserSchema, CreateUserRequestSchema, UserIdRequestSchema, apiContract };
