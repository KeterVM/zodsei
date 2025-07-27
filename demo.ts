import { createClient, z } from './src';

// Define user schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
});

// Define API contract
const apiContract = {
  // Get user list
  getUsers: {
    path: '/users',
    method: 'get' as const,
    request: z.object({
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      search: z.string().optional()
    }),
    response: z.object({
      users: z.array(UserSchema),
      total: z.number(),
      page: z.number(),
      hasMore: z.boolean()
    })
  },

  // Get user by ID
  getUserById: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({
      id: z.string().uuid()
    }),
    response: UserSchema
  },

  // Create user
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({
      name: z.string().min(1),
      email: z.string().email()
    }),
    response: UserSchema
  },

  // Update user
  updateUser: {
    path: '/users/:id',
    method: 'put' as const,
    request: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional()
    }),
    response: UserSchema
  },

  // Delete user
  deleteUser: {
    path: '/users/:id',
    method: 'delete' as const,
    request: z.object({
      id: z.string().uuid()
    }),
    response: z.object({
      success: z.boolean(),
      message: z.string()
    })
  }
} as const;

// Create client
const client = createClient(apiContract, {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  validateRequest: true,
  validateResponse: false, // JSONPlaceholder response format may not fully match our schema
  headers: {
    'Content-Type': 'application/json'
  }
});

// Demo function
async function demo() {
  console.log('🚀 Zodsei Demo Started');
  
  try {
    // 1. Get user list
    console.log('\n📋 Getting users list...');
    const users = await client.getUsers({
      page: 1,
      limit: 5
    });
    console.log('✅ Users fetched:', users);

    // 2. Get single user
    console.log('\n👤 Getting user by ID...');
    const user = await client.getUserById({
      id: '550e8400-e29b-41d4-a716-446655440000' // Example UUID
    });
    console.log('✅ User fetched:', user);

    // 3. Create user
    console.log('\n➕ Creating new user...');
    const newUser = await client.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });
    console.log('✅ User created:', newUser);

    // 4. Update user
    console.log('\n✏️ Updating user...');
    const updatedUser = await client.updateUser({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John Smith'
    });
    console.log('✅ User updated:', updatedUser);

    // 5. Delete user
    console.log('\n🗑️ Deleting user...');
    const deleteResult = await client.deleteUser({
      id: '550e8400-e29b-41d4-a716-446655440000'
    });
    console.log('✅ User deleted:', deleteResult);

  } catch (error) {
    console.error('❌ Error occurred:', error);
  }
}

// Type safety demo
function typeDemo() {
  console.log('\n🔒 Type Safety Demo');
  
  // These calls will have complete type hints and checking
  
  // ✅ Correct calls
  client.getUsers({ page: 1, limit: 10 });
  
  // ❌ These will have TypeScript errors (if validation is enabled)
  // client.getUsers({ page: 'invalid' }); // page must be number
  // client.getUserById({ id: 'invalid-uuid' }); // id must be valid UUID
  // client.createUser({ name: '' }); // name cannot be empty
  
  console.log('✅ All type checks passed!');
}

// If running this file directly
if (require.main === module) {
  demo().then(() => {
    typeDemo();
    console.log('\n🎉 Demo completed!');
  });
}

export { apiContract, client };
