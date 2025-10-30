# Zodsei

A contract-first, type-safe HTTP client with Zod validation for TypeScript.

## Why Zodsei?

Zodsei was created to solve the limitations of existing HTTP client libraries:

### The Problem

- **Zodios is unmaintained**: The original Zodios library is no longer actively maintained, leaving users without updates and bug fixes
- **Poor API design**: Many existing solutions have complex, unintuitive APIs that are hard to use and maintain
- **Limited flexibility**: When you can't use tRPC or oRPC, or don't control the backend, you need a flexible contract-first solution
- **Type safety gaps**: Most HTTP clients lack comprehensive compile-time type checking and runtime validation

### The Solution

Zodsei provides:

- **Modern, clean API**: Intuitive contract definition with `{path, method, request, response}` structure
- **True contract-first**: Define your API contract once, get full type safety everywhere
- **Active maintenance**: Built with modern tooling and actively maintained
- **Flexible architecture**: Works with any backend, no server-side requirements
- **Complete type safety**: From request to response, with runtime validation

## When to Use Zodsei vs Other Solutions

### For Full-Stack Projects (Recommended Alternatives)

If you're developing a **full-stack project** or have **control over the backend**, we recommend using these excellent alternatives:

- **[ts-rest](https://ts-rest.com/)** - Contract-first REST APIs with full-stack type safety
- **[tRPC](https://trpc.io/)** - End-to-end typesafe APIs made easy
- **[oRPC](https://orpc.unnoq.com/)** - Modern RPC framework with excellent TypeScript support

These libraries provide superior developer experience when you control both frontend and backend.

### When Zodsei is the Right Choice

Use Zodsei when:

- 🔌 **Consuming third-party APIs** - You don't control the backend
- 🏢 **Working with existing REST APIs** - Legacy systems or external services
- 🔄 **Migrating from unmaintained libraries** - Moving away from Zodios or similar
- 🎯 **Need flexible HTTP client** - Custom requirements not covered by full-stack solutions
- 📱 **Client-only applications** - Mobile apps, browser extensions, or pure frontend projects

## Features

- 🔒 **Type-safe**: Full TypeScript support with automatic type inference
- 📋 **Contract-first**: Define your API contract once, get type safety everywhere
- ✅ **Runtime validation**: Request and response validation using Zod schemas
- 🔌 **Middleware support**: Built-in retry, caching, and custom middleware
- 🌐 **Axios-based client**: Bring-your-own Axios instance for requests
- 🚀 **Minimal dependencies**: Zod + Axios
- 📦 **Modern**: ESM/CJS dual package, works in Node.js and browsers

## Installation

```bash
npm install zodsei zod axios
# or
pnpm add zodsei zod axios
# or
yarn add zodsei zod axios
```

## Quick Start

### 1. Define your API contract

```typescript
import { z } from 'zod';
import { defineContract } from 'zodsei';

const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email()
});

const apiContract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({
      id: z.uuid(),
    }),
    response: UserSchema
  },
  
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({
      name: z.string().min(1),
      email: z.email()
    }),
    response: UserSchema
  }
});
```

### 2. Create a client

```typescript
import { createClient } from 'zodsei';
import axios from 'axios';

const axiosInstance = axios.create({ baseURL: 'https://api.example.com', timeout: 10000 });

const client = createClient(apiContract, {
  axios: axiosInstance,
  validateRequest: true,
  validateResponse: true,
});
```

### 3. Use the client

```typescript
// Fully type-safe API calls
const user = await client.getUser({ 
  id: '123e4567-e89b-12d3-a456-426614174000' 
});
// user is automatically typed as { id: string, name: string, email: string }

const newUser = await client.createUser({
  name: 'John Doe',
  email: 'john@example.com'
});
// newUser is also automatically typed
```

## Core Concepts

### Type inference on endpoint methods

```ts
// Fully typed response inferred from the contract
const user = await client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' });
// `user` type is inferred from the endpoint response schema
```

### Method-level type helpers: .infer

```ts
// Dev-time type helpers derived from the endpoint definition
type GetUserRequest = typeof client.getUser.infer.request;
type GetUserResponse = typeof client.getUser.infer.response;
```

### Method-level schemas: .schema

```ts
// Runtime access to Zod schemas
const reqSchema = client.getUser.schema.request;
const resSchema = client.getUser.schema.response;
```

### Contract-level schema explorer: $schema

```ts
// Explore the contract at runtime
const endpointPaths = client.$schema.getEndpointPaths();
const info = client.$schema.describeEndpoint('getUser');
// info: { path, method, requestSchema, responseSchema, requestType, responseType }
```

### Nested contracts

```ts
type LoginRequest = typeof client.auth.login.infer.request;
const getByIdSchemas = client.users.getById.schema;
```

### Re-exported z

```ts
import { z } from 'zodsei'; // re-exported for convenience
```

## API Reference

### Contract Definition

Each endpoint in your contract should have:

- `path`: The API endpoint path (supports path parameters like `:id`)
- `method`: HTTP method (`'get' | 'post' | 'put' | 'delete' | 'patch'`)
- `request`: Zod schema for request data
- `response`: Zod schema for response data

#### Basic Contract

```typescript
const contract = defineContract({
  endpointName: {
    path: '/api/path/:param',
    method: 'post',
    request: z.object({ /* request schema */ }),
    response: z.object({ /* response schema */ })
  }
});
```

#### Nested Contracts

Contracts can be nested to organize your API endpoints by feature or module:

```typescript
const contract = defineContract({
  auth: defineContract({
    login: {
      path: '/auth/login',
      method: 'post',
      request: z.object({ email: z.string(), password: z.string() }),
      response: z.object({ token: z.string() })
    },
    logout: {
      path: '/auth/logout',
      method: 'post',
      request: z.object({}),
      response: z.object({ success: z.boolean() })
    }
  }),
  
  users: defineContract({
    getById: {
      path: '/users/:id',
      method: 'get',
      request: z.object({ id: z.string() }),
      response: UserSchema
    }
  })
});

// Usage with nested structure
const loginResult = await client.auth.login({ email, password });
const user = await client.users.getById({ id: '123' });
```

### Client Configuration

```typescript
interface ClientConfig {
  axios: AxiosInstance;               // Your Axios instance (required)
  validateRequest?: boolean;          // Enable request validation (default: true)
  validateResponse?: boolean;         // Enable response validation (default: true)
  middleware?: Middleware[];          // Custom middleware
}
```

### Middleware

Zodsei supports middleware for cross-cutting concerns:

#### Retry Middleware

```typescript
import { retryMiddleware } from 'zodsei';

const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  middleware: [
    retryMiddleware({
      retries: 3,
      delay: 1000,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}:`, error.message);
      }
    })
  ]
});
```

#### Cache Middleware

```typescript
import { cacheMiddleware } from 'zodsei';

const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  middleware: [
    cacheMiddleware({
      ttl: 60000, // Cache for 1 minute
    })
  ]
});
```

#### Custom Middleware

```typescript
const loggingMiddleware = async (request, next) => {
  console.log('Request:', request);
  const response = await next(request);
  console.log('Response:', response);
  return response;
};

const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  middleware: [loggingMiddleware]
});
```

### HTTP Client

Zodsei uses Axios under the hood. You must provide an `AxiosInstance` when creating the client. Use middleware for cross-cutting concerns (auth, logging, retries, caching).

### Error Handling

Zodsei provides specific error types for different scenarios:

```typescript
import { 
  ValidationError, 
  HttpError, 
  NetworkError, 
  TimeoutError 
} from 'zodsei';

try {
  const user = await client.getUser({ id: 'invalid-uuid' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.issues);
  } else if (error instanceof HttpError) {
    console.log('HTTP error:', error.status, error.message);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  } else if (error instanceof TimeoutError) {
    console.log('Request timeout');
  }
}
```

## Advanced

### Notes

- Provide your own Axios instance to integrate global config, interceptors, and shared headers.
- For retries, caching, auth headers, prefer Zodsei middleware to keep concerns consistent across transports.

### Middleware (Recommended)

Use middleware to implement cross-cutting concerns (auth, logging, retries, error handling):

```typescript
const authMiddleware = async (req, next) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return next(req);
};

const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  middleware: [authMiddleware]
});
```

### Path Parameters

```typescript
const contract = defineContract({
  getUserPosts: {
    path: '/users/:userId/posts/:postId',
    method: 'get' as const,
    request: z.object({
      userId: z.string().uuid(),
      postId: z.string().uuid()
    }),
    response: PostSchema
  }
});

// Usage
const post = await client.getUserPosts({
  userId: 'user-uuid',
  postId: 'post-uuid'
});
```

### Query Parameters

For GET requests, non-path parameters are automatically converted to query parameters:

```typescript
const contract = defineContract({
  searchUsers: {
    path: '/users',
    method: 'get' as const,
    request: z.object({
      q: z.string(),
      page: z.number().optional(),
      limit: z.number().optional()
    }),
    response: z.object({
      users: z.array(UserSchema),
      total: z.number()
    })
  }
});

// Usage - generates: GET /users?q=john&page=1&limit=10
const results = await client.searchUsers({
  q: 'john',
  page: 1,
  limit: 10
});
```

### Request Body

For POST/PUT/PATCH requests, the request data is sent as JSON body:

```typescript
const contract = defineContract({
  updateUser: {
    path: '/users/:id',
    method: 'put' as const,
    request: z.object({
      id: z.string().uuid(),      // Path parameter
      name: z.string().optional(), // Body field
      email: z.string().email().optional() // Body field
    }),
    response: UserSchema
  }
});

// Usage
const updated = await client.updateUser({
  id: 'user-uuid',
  name: 'New Name',
  email: 'new@example.com'
});
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guide and submit pull requests to our repository.
