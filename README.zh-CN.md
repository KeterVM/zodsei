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
- 🌐 **Axios 统一实现**：通过你传入的 Axios 实例发起请求
- 🚀 **最小依赖**：Zod + Axios
- 📦 **现代包**：仅发布 ESM，支持现代 Node.js 与浏览器

## 安装

```bash
bun add zodsei zod axios
```

## 快速开始

### 1. 定义 API Contract

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

### 2. 创建客户端

```typescript
import { createClient } from 'zodsei';
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
});

const client = createClient(apiContract, {
  axios: axiosInstance,
  validateRequest: true,
  validateResponse: true,
});
```

### 3. 使用客户端

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

## 核心概念

### 端点方法上的类型推断

```ts
// Fully typed response inferred from the contract
const user = await client.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' });
// `user` type is inferred from the endpoint response schema
```

### Contract 类型助手

```ts
import type { InferRequestType, InferResponseType } from 'zodsei';

type GetUserRequest = InferRequestType<typeof apiContract.getUser>;
type GetUserResponse = InferResponseType<typeof apiContract.getUser>;
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
// info: { path, method, requestSchema, responseSchema }
```

### 嵌套Contract

```ts
type LoginRequest = InferRequestType<typeof contract.auth.login>;
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
    request: z.object({/* request schema */}),
    response: z.object({/* response schema */}),
  },
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

### 客户端配置

```typescript
interface ClientConfig {
  axios: AxiosInstance; // 你提供的 Axios 实例（必填）
  validateRequest?: boolean; // 启用请求校验（默认：true）
  validateResponse?: boolean; // 启用响应校验（默认：true）
  middleware?: Middleware[]; // 自定义中间件
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
      },
    }),
  ],
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
    }),
  ],
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
  middleware: [loggingMiddleware],
});
```

### HTTP 客户端

Zodsei 统一使用 Axios。创建客户端时你需要提供一个 `AxiosInstance`。配置在该实例上的拦截器会正常执行；Zodsei 本身不注册或管理拦截器。

### 错误处理

Zodsei 为不同场景提供了特定错误类型：

```typescript
import { ValidationError, HttpError, NetworkError, TimeoutError } from 'zodsei';

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

### Middleware 与 Axios Interceptor 的区别

Middleware 和 Axios interceptor 工作在不同层级：

|                    | Zodsei middleware                      | Axios interceptor                                      |
| ------------------ | -------------------------------------- | ------------------------------------------------------ |
| 输入               | `RequestContext` / `ResponseContext`   | `AxiosRequestConfig` / `AxiosResponse`                 |
| 作用范围           | 单个 Zodsei client                     | Axios instance 的所有使用者                            |
| 适合场景           | 缓存、重试、客户端专属认证、日志、Mock | Axios 配置、共享请求头、401 Token 刷新、Axios 专属错误 |
| 能否完全跳过 Axios | 可以，例如缓存命中                     | 不能直接跳过；仍在 Axios 执行链内                      |

执行顺序如下：

```text
请求校验
→ Zodsei middleware
  → Axios request interceptor
    → HTTP 请求
  ← Axios response interceptor
← Zodsei middleware
← 响应校验
```

当行为只属于某个 contract client，或者可能短路请求时，使用 middleware。当行为依赖 Axios 内部能力，或者需要共享给 Axios instance 的所有使用者时，使用 interceptor。简单的认证头两层都可以实现；401 Token 刷新通常更适合 Axios interceptor。

不要同时在两层配置重试或缓存，否则可能产生重复请求、重复日志和重复副作用。

### 路径参数

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

### 请求体

对于 POST/PUT/PATCH 请求，请求数据将作为 JSON body 发送：

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

## 许可

MIT

## 贡献

本地开发统一使用 Bun 1.3.14 或更高版本，并使用 Oxlint 和 Oxfmt 完成检查与格式化：

```bash
bun install --frozen-lockfile
bun run check
bun run build
```

欢迎贡献！请阅读贡献指南并向仓库提交 PR。
