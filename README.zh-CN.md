# Zodsei

一个面向Contract-first、类型安全的 TypeScript HTTP 客户端，使用 Zod 进行校验。

## 为什么选择 Zodsei？

Zodsei 旨在解决现有 HTTP 客户端库的局限性：

### 问题

- **Zodios 已无人维护**：原始 Zodios 库已不再积极维护，无法获得更新与修复
- **糟糕的 API 设计**：许多方案的 API 复杂且不直观，难以使用与维护
- **灵活性不足**：当你无法使用 tRPC 或 oRPC，或无法控制后端时，需要一个灵活的Contract-first方案
- **类型安全缺口**：大多数 HTTP 客户端缺乏全面的编译期类型检查与运行时校验

### 解决方案

Zodsei 提供：

- **现代而简洁的 API**：使用 `{path, method, request, response}` 的直观Contract定义
- **真正的Contract优先**：一次定义API Contract，处处享受完整类型安全
- **积极维护**：基于现代工具链，持续维护
- **灵活架构**：可对接任何后端，无需服务端配合
- **端到端类型安全**：从请求到响应，结合运行时校验

## 何时使用 Zodsei（与其他方案对比）

### 面向全栈项目（推荐的替代方案）

如果你在开发**全栈项目**或**可控制后端**，推荐以下优秀方案：

- **[ts-rest](https://ts-rest.com/)** - Contract-first 的 REST API，提供全栈类型安全
- **[tRPC](https://trpc.io/)** - 端到端类型安全的 API，简单易用
- **[oRPC](https://orpc.unnoq.com/)** - 现代 RPC 框架，优秀的 TypeScript 支持

当你能同时控制前后端时，这些库通常能提供更优的开发体验。

### 何时适合使用 Zodsei

在以下场景使用 Zodsei：

- 🔌 **消费第三方 API**：你不控制后端
- 🏢 **对接既有 REST API**：遗留系统或外部服务
- 🔄 **从无人维护的库迁移**：从 Zodios 或类似库迁移
- 🎯 **需要灵活的 HTTP 客户端**：定制需求无法被全栈方案覆盖
- 📱 **仅客户端应用**：移动端、浏览器扩展或纯前端项目

## 特性

- 🔒 **类型安全**：完整的 TypeScript 支持与自动类型推断
- 📋 **契约优先**：一次定义APIContract，处处享受类型安全
- ✅ **运行时校验**：使用 Zod 对请求与响应进行校验
- 🔌 **中间件支持**：内置重试、缓存与自定义中间件
- 🌐 **多种 HTTP 客户端**：通过适配器支持 fetch、axios、ky
- 🚀 **最小依赖**：只需 Zod，HTTP 客户端为可选
- 📦 **现代包**：同时提供 ESM/CJS，支持 Node.js 与浏览器

## 安装

```bash
npm install zodsei zod
# or
pnpm add zodsei zod
# or
yarn add zodsei zod
```

## 快速开始

### 1. 定义 API Contract

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

### 2. 创建客户端

```typescript
import { createClient } from 'zodsei';

const client = createClient(apiContract, {
  baseUrl: 'https://api.example.com',
  validateRequest: true,
  validateResponse: true,
  // Type-safe adapter configuration - TypeScript infers the correct type based on adapter
  adapter: 'fetch', // 👈 This determines adapterConfig type (FetchAdapterConfig)
  adapterConfig: {
    timeout: 10000,
    credentials: 'include', // ✅ Valid for fetch
    mode: 'cors',           // ✅ Valid for fetch
    cache: 'no-cache'       // ✅ Valid for fetch
    // auth: { username: 'user' } // ❌ TypeScript error: not valid for fetch
  }
});
```

### 3. 使用客户端

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

## 核心概念

### 端点方法上的类型推断

```ts
// Fully typed response inferred from the contract
const user = await client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' });
// `user` type is inferred from the endpoint response schema
```

### 方法级类型助手：.infer

```ts
// Dev-time type helpers derived from the endpoint definition
type GetUserRequest = typeof client.getUser.infer.request;
type GetUserResponse = typeof client.getUser.infer.response;
```

### 方法级 Schema：.schema

```ts
// Runtime access to Zod schemas
const reqSchema = client.getUser.schema.request;
const resSchema = client.getUser.schema.response;
```

### Contract级 Schema 浏览器：$schema

```ts
// Explore the contract at runtime
const endpointPaths = client.$schema.getEndpointPaths();
const info = client.$schema.describeEndpoint('getUser');
// info: { path, method, requestSchema, responseSchema, requestType, responseType }
```

### 嵌套Contract

```ts
type LoginRequest = typeof client.auth.login.infer.request;
const getByIdSchemas = client.users.getById.schema;
```

### 重新导出的 z

```ts
import { z } from 'zodsei'; // re-exported for convenience
```

## API 参考

### Contract定义

每个Contract端点应包含：

- `path`：API 路径（支持 `:id` 等路径参数）
- `method`：HTTP 方法（`'get' | 'post' | 'put' | 'delete' | 'patch'`）
- `request`：请求数据的 Zod schema
- `response`：响应数据的 Zod schema

#### 基础Contract

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

#### 嵌套Contract

可通过嵌套组织你的 API 端点：

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

### 客户端配置

```typescript
interface ClientConfig {
  baseUrl: string;                    // Base URL for all requests
  validateRequest?: boolean;          // Enable request validation (default: true)
  validateResponse?: boolean;         // Enable response validation (default: true)
  headers?: Record<string, string>;   // Default headers
  timeout?: number;                   // Request timeout in ms (default: 30000)
  retries?: number;                   // Number of retries (default: 0)
  middleware?: Middleware[];          // Custom middleware
}
```

### 中间件

Zodsei 支持面向横切关注点的中间件：

#### 重试中间件

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

#### 缓存中间件

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

#### 自定义中间件

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

### HTTP 适配器

Zodsei 通过可插拔的适配器机制支持多种 HTTP 客户端。选择最适合你的适配器：

#### 快速设置

```typescript
// Fetch (default) - Zero dependencies
const client = createClient(contract, {
  baseUrl: 'https://api.example.com'
  // adapter: 'fetch' is implicit
});

// Axios - Full-featured HTTP client
const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'axios'
});

// Ky - Modern with built-in retry
const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'ky'
});
```

高级配置与特性对比见下方「高级」章节。有关请求/响应生命周期，建议使用客户端级中间件。

### 错误处理

Zodsei 为不同场景提供了特定错误类型：

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

## 高级

### 适配器：高级配置

```typescript
// String-based with config
const client = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'axios',
  adapterConfig: {
    timeout: 15000,
    withCredentials: true
  }
});
```

### 特性对比

| 特性 | Fetch | Axios | Ky |
|------|-------|-------|----|
| **包体积** | 0KB | ~13KB | ~4KB |
| **依赖** | 无 | 需要安装 | 需要安装 |
| **内置** | ✅ 原生 | ❌ 需安装 | ❌ 需安装 |
| **平台** | Node.js, Browser | Node.js, Browser | Node.js, Browser |
| **拦截器** | ❌ | ❌ | ❌ |
| **自动重试** | ❌ | ❌ | ✅ 内置 |
| **高级特性** | 基础 | 代理、认证等 | Hooks、超时 |
| **最适合** | 简单 API | 复杂 API | 现代 API |

### 中间件（推荐）

使用中间件实现认证、日志、重试、错误处理等横切关注点：

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

### 路径参数

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

### 查询参数

对于 GET 请求，非路径参数会自动转换为查询参数：

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

### 请求体

对于 POST/PUT/PATCH 请求，请求数据将作为 JSON body 发送：

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

## 许可

MIT

## 贡献

欢迎贡献！请阅读贡献指南并向仓库提交 PR。
