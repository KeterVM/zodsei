import { z } from 'zod';
import { defineContract, createClient, extractTypeInfo } from '../src';
import axios from 'axios';

// 定义包含可选 schema 的合约
const contract = defineContract({
  // 完整的端点：有 request 和 response schema
  createUser: {
    path: '/users',
    method: 'post',
    request: z.object({
      name: z.string(),
      email: z.email(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },

  // 只有 response schema 的端点
  getUsers: {
    path: '/users',
    method: 'get',
    response: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.email(),
    })),
  },

  // 只有 request schema 的端点（比如删除操作）
  deleteUser: {
    path: '/users/:id',
    method: 'delete',
    request: z.object({
      id: z.string(),
    }),
  },

  // 既没有 request 也没有 response schema 的端点
  healthCheck: {
    path: '/health',
    method: 'get',
  },

  // 嵌套合约也支持可选 schema
  admin: {
    // 只有 request schema
    clearCache: {
      path: '/admin/cache',
      method: 'delete',
      request: z.object({
        confirm: z.boolean(),
      }),
    },

    // 只有 response schema
    getStats: {
      path: '/admin/stats',
      method: 'get',
      response: z.object({
        userCount: z.number(),
        activeUsers: z.number(),
      }),
    },
  },
} as const);

// 创建客户端
const client = createClient(contract, {
  axios: axios.create({ baseURL: 'https://api.example.com' }),
});

async function demonstrateOptionalSchemas() {
  // 1. 完整的端点调用（需要传入 data）
  const newUser = await client.createUser({
    name: 'John Doe',
    email: 'john@example.com',
  });
  console.log('Created user:', newUser.id, newUser.name);

  // 2. 只有 response schema 的端点（不需要传入参数）
  const users = await client.getUsers();
  console.log('Users count:', users.length);

  // 3. 只有 request schema 的端点（需要传入 data，但 response 是 unknown）
  const deleteResult = await client.deleteUser({ id: '123' });
  console.log('Delete result:', deleteResult); // unknown 类型

  // 4. 既没有 request 也没有 response schema 的端点
  const healthResult = await client.healthCheck();
  console.log('Health check:', healthResult); // unknown 类型

  // 5. 嵌套合约中的可选 schema
  await client.admin.clearCache({ confirm: true });
  const stats = await client.admin.getStats();
  console.log('Stats:', stats.userCount, stats.activeUsers);

  // 6. 访问 schema 信息
  console.log('createUser request schema:', client.createUser.schema.request);
  console.log('getUsers request schema:', client.getUsers.schema.request); // undefined
  console.log('deleteUser response schema:', client.deleteUser.schema.response); // undefined
  console.log('healthCheck schemas:', client.healthCheck.schema); // 都是 undefined

  // 7. 使用 schema 提取器
  const schema = client.$schema;
  
  // 描述不同类型的端点
  console.log('createUser description:', schema.describeEndpoint('createUser'));
  console.log('getUsers description:', schema.describeEndpoint('getUsers'));
  console.log('deleteUser description:', schema.describeEndpoint('deleteUser'));
  console.log('healthCheck description:', schema.describeEndpoint('healthCheck'));

  // 8. 类型推断示例
  type CreateUserRequest = typeof client.createUser.infer.request; // { name: string; email: string; }
  type GetUsersRequest = typeof client.getUsers.infer.request; // void
  type DeleteUserResponse = typeof client.deleteUser.infer.response; // unknown
  type HealthCheckRequest = typeof client.healthCheck.infer.request; // void
  type HealthCheckResponse = typeof client.healthCheck.infer.response; // unknown

  // 9. 运行时检查 schema 是否存在
  const createUserInfo = extractTypeInfo(contract.createUser);
  console.log('createUser has request schema:', createUserInfo.hasRequestSchema); // true
  console.log('createUser has response schema:', createUserInfo.hasResponseSchema); // true

  const getUsersInfo = extractTypeInfo(contract.getUsers);
  console.log('getUsers has request schema:', getUsersInfo.hasRequestSchema); // false
  console.log('getUsers has response schema:', getUsersInfo.hasResponseSchema); // true
}

// 类型安全验证
function typeValidation() {
  // ✅ 正确：有 request schema 的端点需要传入参数
  client.createUser({ name: 'John', email: 'john@example.com' });
  client.deleteUser({ id: '123' });
  client.admin.clearCache({ confirm: true });

  // ✅ 正确：没有 request schema 的端点不需要参数
  client.getUsers();
  client.healthCheck();
  client.admin.getStats();

  // ❌ 错误：这些调用会产生 TypeScript 错误
  // client.getUsers({ someParam: 'value' }); // 不应该传入参数
  // client.createUser(); // 缺少必需的参数
  // client.healthCheck({ unnecessary: 'param' }); // 不应该传入参数
}

export { contract, client, demonstrateOptionalSchemas, typeValidation };
