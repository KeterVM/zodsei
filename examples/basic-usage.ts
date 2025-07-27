import { createClient, z, retryMiddleware, cacheMiddleware } from '../src';

// Define data schemas
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

// Define API contract
const apiContract = {
  // Authentication
  login: {
    path: '/auth/login',
    method: 'post' as const,
    request: z.object({
      email: z.string().email(),
      password: z.string().min(6)
    }),
    response: z.object({
      token: z.string(),
      user: UserSchema,
      expiresAt: z.string().datetime()
    })
  },

  // User management
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

  getUserById: {
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
    request: CreateUserSchema,
    response: UserSchema
  },

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
  baseUrl: 'https://api.example.com',
  validateRequest: true,
  validateResponse: true,
  headers: {
    'Authorization': 'Bearer your-token-here'
  },
  timeout: 10000,
  middleware: [
    // Retry middleware
    retryMiddleware({
      retries: 3,
      delay: 1000,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}:`, error.message);
      }
    }),
    
    // Cache middleware (only cache GET requests)
    cacheMiddleware({
      ttl: 60000, // 1 minute
    })
  ]
});

// Usage example
async function example() {
  try {
    // Login
    const loginResult = await client.login({
      email: 'user@example.com',
      password: 'password123'
    });
    console.log('Login successful:', loginResult);

    // Get user list
    const users = await client.getUsers({
      page: 1,
      limit: 20,
      search: 'john'
    });
    console.log('Users:', users);

    // Get single user
    const user = await client.getUserById({
      id: '123e4567-e89b-12d3-a456-426614174000'
    });
    console.log('User:', user);

    // Create user
    const newUser = await client.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });
    console.log('New user:', newUser);

    // Update user
    const updatedUser = await client.updateUser({
      id: newUser.id,
      name: 'John Smith'
    });
    console.log('Updated user:', updatedUser);

    // Delete user
    const deleteResult = await client.deleteUser({
      id: newUser.id
    });
    console.log('Delete result:', deleteResult);

  } catch (error) {
    console.error('API Error:', error);
  }
}

// Run example
if (require.main === module) {
  example();
}

export { apiContract, client };
