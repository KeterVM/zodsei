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
- 🧩 **TanStack Vue Query**: `api.users.get.useQuery()` with typed keys, via `zodsei/vue-query`
- 🌐 **Axios-based client**: Bring-your-own Axios instance for requests
- 🚀 **Minimal dependencies**: Zod + Axios
- 📦 **Modern**: ESM-only package for modern Node.js and browsers

## Installation

```bash
bun add zodsei zod axios
```

## Quick Start

### 1. Define your API contract

```typescript
import { z } from 'zod';
import { defineContract } from 'zodsei';

const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
});

const apiContract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({
      id: z.uuid(),
    }),
    response: UserSchema,
  },

  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({
      name: z.string().min(1),
      email: z.email(),
    }),
    response: UserSchema,
  },
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
  id: '123e4567-e89b-12d3-a456-426614174000',
});
// user is automatically typed as { id: string, name: string, email: string }

const newUser = await client.createUser({
  name: 'John Doe',
  email: 'john@example.com',
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

### Contract type helpers

```ts
import type { InferRequestType, InferResponseType } from 'zodsei';

type GetUserRequest = InferRequestType<typeof apiContract.getUser>;
type GetUserResponse = InferResponseType<typeof apiContract.getUser>;
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
// info: { path, method, requestSchema, responseSchema }
```

### Nested contracts

```ts
type LoginRequest = InferRequestType<typeof contract.auth.login>;
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
    request: z.object({/* request schema */}),
    response: z.object({/* response schema */}),
  },
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
      response: z.object({ token: z.string() }),
    },
    logout: {
      path: '/auth/logout',
      method: 'post',
      request: z.object({}),
      response: z.object({ success: z.boolean() }),
    },
  }),

  users: defineContract({
    getById: {
      path: '/users/:id',
      method: 'get',
      request: z.object({ id: z.string() }),
      response: UserSchema,
    },
  }),
});

// Usage with nested structure
const loginResult = await client.auth.login({ email, password });
const user = await client.users.getById({ id: '123' });
```

### Client Configuration

```typescript
interface ClientConfig {
  axios: AxiosInstance; // Your Axios instance (required)
  validateRequest?: boolean; // Enable request validation (default: true)
  validateResponse?: boolean; // Enable response validation (default: true)
  middleware?: Middleware[]; // Custom middleware
}
```

### Middleware

Zodsei supports middleware for cross-cutting concerns:

#### Retry Middleware

By default only idempotent methods (`GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`) are retried, on
5xx, 408 and 429 responses, timeouts, and Axios network failures. Cancelled requests and errors
thrown by your own interceptors are not retried. Pass `retryCondition(error, request)` to replace
this policy, for example to retry a `POST` you know is safe to repeat.

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
      },
    }),
  ],
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
    }),
  ],
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
  middleware: [loggingMiddleware],
});
```

### HTTP Client

Zodsei uses Axios under the hood. You must provide an `AxiosInstance` when creating the client. Interceptors configured on that instance continue to run normally; Zodsei does not register or manage them.

Any response Axios resolves is accepted, so a custom `validateStatus` on the instance decides which
statuses become an `HttpError`. Zodsei sets `transitional.clarifyTimeoutError: true` on each
request so a timeout (`ETIMEDOUT`) is never confused with a browser abort (`ECONNABORTED`). Your
other `transitional` settings are kept.

### Per-call options

Pass options after the request data, or as the only argument when the endpoint has no request
schema. They are also visible to middleware on the request context.

```typescript
const controller = new AbortController();

await client.auth.login({ email, password }, { signal: controller.signal });
await client.health({ timeout: 2000 });
await client.getUser({ id }, { headers: { 'X-Request-Id': requestId } });

// e.g. on logout
controller.abort(); // the pending call rejects with CanceledError
```

Use `timeout` rather than `signal: AbortSignal.timeout(ms)` when you want a `TimeoutError`; an
aborted signal always rejects with `CanceledError`, and an already-aborted signal rejects before
any middleware runs. Retry delays end early when the signal aborts.

| Option    | Effect                                                  |
| --------- | ------------------------------------------------------- |
| `signal`  | `AbortSignal` for this call                             |
| `timeout` | Milliseconds; overrides the Axios instance timeout      |
| `headers` | Merged over the headers Zodsei sets, for this call only |

### Error Handling

Zodsei provides specific error types for different scenarios:

```typescript
import { ValidationError, HttpError, NetworkError, TimeoutError, CanceledError } from 'zodsei';

try {
  const user = await client.getUser({ id: 'invalid-uuid' });
} catch (error) {
  if (error instanceof CanceledError) {
    return; // aborted on purpose, nothing to show
  } else if (error instanceof ValidationError) {
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

## TanStack Vue Query

`zodsei/vue-query` turns a client into typed TanStack Vue Query composables and options.

```bash
bun add @tanstack/vue-query vue
```

```typescript
// api.ts
import { createClient } from 'zodsei';
import { createVueQueryUtils } from 'zodsei/vue-query';

export const api = createVueQueryUtils(createClient(contract, { axios: http }));
```

```vue
<script setup lang="ts">
import { skipToken, useQueryClient } from '@tanstack/vue-query';
const props = defineProps<{ id?: string }>();

// Inputs can be plain values, refs, computeds or getters. skipToken disables the query.
const user = api.users.get.useQuery(() => (props.id ? { id: props.id } : skipToken));
const name = api.users.get.useQuery({ id: '1' }, { select: (u) => u.name, staleTime: 5_000 });
const health = api.health.useQuery(); // endpoints without a request schema take no input

const list = api.users.list.useInfiniteQuery({
  input: (cursor: number | undefined) => ({ cursor, limit: 20 }),
  initialPageParam: undefined,
  getNextPageParam: (last) => last.next ?? undefined,
});

const queryClient = useQueryClient();
const create = api.users.create.useMutation({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: api.users.key() }),
});
</script>
```

Outside components, use the options and keys from the same object:

```typescript
await queryClient.query(api.users.get.queryOptions({ id }));
queryClient.setQueryData(api.users.get.queryKey({ id }), (old) => old && { ...old, name });
queryClient.invalidateQueries({ queryKey: api.users.get.key({ input: { id } }) });
```

| Helper                             | Use it for                                               |
| ---------------------------------- | -------------------------------------------------------- |
| `useQuery` / `useInfiniteQuery`    | Components (inside `setup`)                              |
| `useMutation`                      | Components; accepts mutation options such as `onSuccess` |
| `queryOptions` / `infiniteOptions` | `queryClient.query`, `useQueries`, route loaders         |
| `mutationOptions`                  | `useMutation` from TanStack directly                     |
| `queryKey(input)`                  | Exact key; `getQueryData` and `setQueryData` are typed   |
| `key()` on groups and endpoints    | Partial key for `invalidateQueries`, `cancelQueries`     |

Keys look like `[['users', 'get'], { type: 'query', input: { id: '1' } }]`, so `api.users.key()`
matches every query under `users` and never collides with your own string keys.

- The query's `signal` is passed to zodsei, so cancelling a query aborts the HTTP request.
- `useInfiniteQuery` calls `input(pageParam)` for every page, including refetches of older pages.
  Read reactive filters once in an options getter so each key keeps its own values:

  ```typescript
  api.users.list.useInfiniteQuery(() => {
    const q = search.value;
    return {
      input: (cursor: number | undefined) => ({ cursor, q }),
      initialPageParam: undefined,
      getNextPageParam: (last) => last.next ?? undefined,
    };
  });
  ```

- Inputs in keys hold app-side values (a codec's `Date`, for example) and must be JSON-serializable;
  `bigint`, `Map` and `Set` are not.
- TanStack already retries failed queries (3 times in the browser). Don't add `retryMiddleware` as
  well; use `isTransientError` so validation errors and 4xx are not retried:

  ```typescript
  import { isTransientError, type ZodseiError } from 'zodsei';

  new QueryClient({
    defaultOptions: { queries: { retry: (count, error) => count < 3 && isTransientError(error) } },
  });

  declare module '@tanstack/vue-query' {
    interface Register {
      defaultError: ZodseiError;
    }
  }
  ```

- With one client per module on a shared `QueryClient`, give each a `scope`. Its keys then start
  with the scope, so `authApi.key()` matches only that module's queries and endpoints with the
  same name in two modules don't share cache entries:

  ```typescript
  export const authApi = createVueQueryUtils(authClient, { scope: ['auth'] });
  authApi.users.get.queryKey({ id: '1' }); // [['auth', 'users', 'get'], { type: 'query', ... }]
  ```

  Without a scope, the root `key()` is `[[]]` and matches every zodsei query.

- Pass `{ queryClient }` to `createVueQueryUtils` only in client-only apps. With SSR (Nuxt), leave
  it out so the composables inject the per-request client.
- A contract entry named `key` hides that group's `key()` helper.

## Advanced

### Middleware vs Axios Interceptors

Middleware and Axios interceptors run at different layers:

|                         | Zodsei middleware                                      | Axios interceptor                                                             |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Input                   | `RequestContext` / `ResponseContext`                   | `AxiosRequestConfig` / `AxiosResponse`                                        |
| Scope                   | One Zodsei client                                      | Every consumer of the Axios instance                                          |
| Best for                | Caching, retries, client-specific auth, logging, mocks | Axios configuration, shared headers, 401 token refresh, Axios-specific errors |
| Can skip Axios entirely | Yes, for example on a cache hit                        | Not directly; it remains inside the Axios pipeline                            |

The execution order is:

```text
request validation
→ Zodsei middleware
  → Axios request interceptor
    → HTTP request
  ← Axios response interceptor
← Zodsei middleware
← response validation
```

Use middleware when behavior belongs to one contract client or may short-circuit the request. Use an interceptor when behavior depends on Axios internals or must be shared by every consumer of the Axios instance. Simple authorization headers can use either layer; 401 refresh flows usually belong in an Axios interceptor.

Do not configure retries or caching in both layers. Doing so can duplicate requests, logs, and side effects.

### Path Parameters

```typescript
const contract = defineContract({
  getUserPosts: {
    path: '/users/:userId/posts/:postId',
    method: 'get' as const,
    request: z.object({
      userId: z.string().uuid(),
      postId: z.string().uuid(),
    }),
    response: PostSchema,
  },
});

// Usage
const post = await client.getUserPosts({
  userId: 'user-uuid',
  postId: 'post-uuid',
});
```

A parameter name is a JavaScript identifier, so `/files/:name.json` reads `name`. A colon that
follows a letter or digit is literal, so custom methods like `/users:batchGet` or
`/ops/:name:cancel` work. Values are URL-encoded and must be strings, numbers, booleans or bigints.
A missing value, a non-primitive value, or a value that would make a whole segment empty, `.` or
`..` throws a `ValidationError` before any request is sent.

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
      limit: z.number().optional(),
    }),
    response: z.object({
      users: z.array(UserSchema),
      total: z.number(),
    }),
  },
});

// Usage - generates: GET /users?q=john&page=1&limit=10
const results = await client.searchUsers({
  q: 'john',
  page: 1,
  limit: 10,
});
```

### Request Body

For POST/PUT/PATCH requests, a plain-object request is sent as a JSON body. Other values such as
`FormData`, `Blob`, `URLSearchParams` or binary data are passed to Axios untouched, and Axios
sets their `Content-Type`.

```typescript
const contract = defineContract({
  updateUser: {
    path: '/users/:id',
    method: 'put' as const,
    request: z.object({
      id: z.string().uuid(), // Path parameter
      name: z.string().optional(), // Body field
      email: z.string().email().optional(), // Body field
    }),
    response: UserSchema,
  },
});

// Usage
const updated = await client.updateUser({
  id: 'user-uuid',
  name: 'New Name',
  email: 'new@example.com',
});
```

### Codecs

Requests are encoded with `z.encode` and responses are parsed, so one
[codec](https://zod.dev/codecs) describes both directions. You pass and receive app values, and
the wire carries the encoded form:

```typescript
const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});

const contract = defineContract({
  reschedule: {
    path: '/events/:id',
    method: 'put' as const,
    request: z.object({ id: z.string(), startsAt: isoDate }),
    response: z.object({ startsAt: isoDate }),
  },
});

// Sends {"startsAt":"2026-01-01T00:00:00.000Z"}; result.startsAt is a Date.
const result = await client.reschedule({ id: '1', startsAt: new Date('2026-01-01') });
```

Encoding runs backwards through the schema. One-way steps such as `.transform()` and
`z.preprocess()` throw, and forward-only steps such as `.default()` and `.catch()` do not apply,
so defaulted fields are required at the call site. Checks such as `.refine()`, `.trim()` and
`z.coerce` keep working. With `validateRequest: false` the request data is sent as passed,
without encoding.

## License

MIT

## Contributing

Development uses Bun 1.3.14 or newer, with Oxlint and Oxfmt for linting and formatting:

```bash
bun install --frozen-lockfile
bun run check
bun run build
```

Contributions are welcome! Please read our contributing guide and submit pull requests to our repository.
