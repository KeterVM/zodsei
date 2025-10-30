import { z } from 'zod';
import { createClient, defineContract } from '../src';
import axios from 'axios';

// Define schemas
const LoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
  }),
});

const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});

const CreateUserRequestSchema = z.object({
  email: z.email(),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const UserIdRequestSchema = z.object({
  id: z.uuid(),
});

// Define nested contract structure
const apiContract = defineContract({
  // Authentication endpoints
  auth: defineContract({
    login: {
      path: '/auth/login',
      method: 'post' as const,
      request: LoginRequestSchema,
      response: LoginResponseSchema,
    },
    logout: {
      path: '/auth/logout',
      method: 'post' as const,
      request: z.object({}),
      response: z.object({ success: z.boolean() }),
    },
    refresh: {
      path: '/auth/refresh',
      method: 'post' as const,
      request: z.object({ refreshToken: z.string() }),
      response: z.object({ token: z.string() }),
    },
  }),

  // User management endpoints
  users: defineContract({
    create: {
      path: '/users',
      method: 'post' as const,
      request: CreateUserRequestSchema,
      response: UserSchema,
    },
    getById: {
      path: '/users/:id',
      method: 'get' as const,
      request: UserIdRequestSchema,
      response: UserSchema,
    },
    update: {
      path: '/users/:id',
      method: 'put' as const,
      request: z.object({
        id: z.uuid(),
        name: z.string().min(1, 'Name is required'),
        email: z.email(),
      }),
      response: UserSchema,
    },
    delete: {
      path: '/users/:id',
      method: 'delete' as const,
      request: UserIdRequestSchema,
      response: z.object({ success: z.boolean() }),
    },
  }),

  // Direct endpoints (not nested)
  health: {
    path: '/health',
    method: 'get' as const,
    request: z.object({}),
    response: z.object({ status: z.string() }),
  },
});

// Create client
const client = createClient(apiContract, {
  axios: axios.create({ baseURL: 'https://api.example.com' }),
});

async function demonstrateNestedAccess() {
  console.log('=== Nested Contract Demo ===\n');

  try {
    // Method 1: Authentication with nested access
    console.log('1. Using nested access: client.auth.login()');
    const loginResult = await client.auth.login({
      email: 'user@example.com',
      password: 'password123',
    });
    console.log('Login successful:', loginResult.user.name);

    // Method 2: User management with nested access
    console.log('\n2. Using nested user management: client.users.create()');
    const newUser = await client.users.create({
      email: 'newuser@example.com',
      name: 'New User',
      password: 'password123',
    });
    console.log('User created:', newUser.name);

    // Method 3: Direct endpoint access
    console.log('\n3. Direct endpoint access: client.health()');
    const healthStatus = await client.health({});
    console.log('Health status:', healthStatus.status);

    // Method 4: Multiple nested operations
    console.log('\n4. Multiple nested operations:');
    
    // Refresh token
    const refreshResult = await client.auth.refresh({ refreshToken: 'refresh-token' });
    console.log('Token refreshed:', refreshResult.token);
    
    // Get user by ID
    const user = await client.users.getById({ id: newUser.id });
    console.log('Retrieved user:', user.name);
    
    // Update user
    const updatedUser = await client.users.update({
      id: newUser.id,
      name: 'Updated Name',
      email: newUser.email,
    });
    console.log('Updated user:', updatedUser.name);
    
    // Logout
    await client.auth.logout({});
    console.log('Logged out successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Type checking examples
function typeCheckingExamples() {
  console.log('\n=== Type Checking Examples ===');
  
  // These should all have proper TypeScript types
  
  // Nested access types
  const nestedLogin: typeof client.auth.login = client.auth.login;
  const nestedLogout: typeof client.auth.logout = client.auth.logout;
  const nestedRefresh: typeof client.auth.refresh = client.auth.refresh;
  
  const nestedUserCreate: typeof client.users.create = client.users.create;
  const nestedUserGetById: typeof client.users.getById = client.users.getById;
  const nestedUserUpdate: typeof client.users.update = client.users.update;
  const nestedUserDelete: typeof client.users.delete = client.users.delete;
  
  // Direct access types
  const healthCheck: typeof client.health = client.health;
  
  console.log('All type checks passed!');
}

// Export for testing
export { apiContract, client, demonstrateNestedAccess, typeCheckingExamples };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateNestedAccess()
    .then(() => typeCheckingExamples())
    .catch(console.error);
}
