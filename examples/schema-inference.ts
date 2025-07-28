import { z } from 'zod';
import {
  createClient,
  defineContract,
  type InferRequestType,
  type InferResponseType,
} from '../src';

/**
 * Example demonstrating the new schema inference and type extraction features
 */

// Define schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

const CreateUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

const UsersListSchema = z.object({
  users: z.array(UserSchema),
  total: z.number(),
  page: z.number(),
});

// Define contract with type inference support
const contract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({ id: z.string() }),
    response: UserSchema,
  },
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: CreateUserSchema,
    response: UserSchema,
  },
  listUsers: {
    path: '/users',
    method: 'get' as const,
    request: z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
    }),
    response: UsersListSchema,
  },
  // Nested endpoints example
  profile: {
    update: {
      path: '/profile',
      method: 'put' as const,
      request: z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      }),
      response: UserSchema,
    },
    avatar: {
      upload: {
        path: '/profile/avatar',
        method: 'post' as const,
        request: z.object({
          file: z.string(), // base64 encoded file
        }),
        response: z.object({
          avatarUrl: z.string(),
        }),
      },
    },
  },
});

// Create enhanced client with schema support
const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
});

// Example usage demonstrating the new features
async function demonstrateSchemaFeatures() {
  // 1. Type-safe method calls with inferred types
  const user = await client.getUser({ id: '123' });
  // user is automatically typed as z.infer<typeof UserSchema>
  console.log('User:', user.name, user.email);

  const newUser = await client.createUser({
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  });
  // newUser is automatically typed as z.infer<typeof UserSchema>
  console.log('Created user:', newUser.id);

  // 2. Access schema information directly from methods
  console.log('Get user request schema:', client.getUser.schema.request);
  console.log('Get user response schema:', client.getUser.schema.response);
  console.log('Get user endpoint info:', client.getUser.schema.endpoint);

  // 3. Type inference helpers (useful for development/debugging)
  type GetUserRequest = typeof client.getUser.infer.request;
  type GetUserResponse = typeof client.getUser.infer.response;

  // 4. Using the $schema extractor for advanced operations
  const schema = client.$schema;

  // Get all endpoint paths
  const endpoints = schema.getEndpointPaths();
  console.log('Available endpoints:', endpoints);

  // Get specific endpoint schemas
  const getUserSchemas = schema.getEndpointSchemas('getUser');
  console.log('Get user schemas:', getUserSchemas);

  // Get nested contract access
  const profileSchema = schema.getNested('profile');
  const profileEndpoints = profileSchema.getEndpointPaths();
  console.log('Profile endpoints:', profileEndpoints);

  // Describe endpoint for documentation
  const description = schema.describeEndpoint('createUser');
  console.log('Create user description:', description);

  // 5. Nested endpoint access with schema support
  const updatedProfile = await client.profile.update({
    name: 'Jane Doe',
    email: 'jane@example.com',
  });
  console.log('Updated profile:', updatedProfile);

  // Access nested endpoint schemas
  console.log('Profile update schema:', client.profile.update.schema);

  // 6. Extract type information at runtime
  const createUserEndpoint = schema.getEndpoint('createUser');
  console.log('Create user endpoint:', {
    path: createUserEndpoint.path,
    method: createUserEndpoint.method,
  });

  // 7. Type utilities for external use
  type CreateUserRequest = InferRequestType<typeof createUserEndpoint>;
  type CreateUserResponse = InferResponseType<typeof createUserEndpoint>;

  // Example of using inferred types in other functions
  function processUser(userData: CreateUserRequest): CreateUserResponse {
    // This function signature is automatically type-safe
    return {
      id: Math.random(),
      name: userData.name,
      email: userData.email,
      age: userData.age,
    };
  }

  const processedUser = processUser({
    name: 'Test User',
    email: 'test@example.com',
  });
  console.log('Processed user:', processedUser);
}

// Export for demonstration
export {
  contract,
  client,
  demonstrateSchemaFeatures,
  UserSchema,
  CreateUserSchema,
  UsersListSchema,
};

// Type exports for external use
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UsersList = z.infer<typeof UsersListSchema>;
