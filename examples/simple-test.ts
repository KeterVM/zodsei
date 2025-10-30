import { z } from 'zod';
import { createClient, defineContract } from '../src';
import axios from 'axios';

// 定义简单的测试合约
const contract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({ id: z.string() }),
    response: z.object({
      id: z.number(),
      name: z.string(),
    }),
  },
});

// 创建客户端（现在直接包含所有 schema 功能）
const client = createClient(contract, {
  axios: axios.create({ baseURL: 'https://api.example.com' }),
});

// 测试功能
console.log('=== 简化的 API 测试 ===');

// 1. Schema 访问
console.log('1. Schema 访问正常:', !!client.getUser.schema);

// 2. $schema 提取器
console.log('2. Schema 提取器正常:', !!client.$schema);

// 3. 端点列表
console.log('3. 端点列表:', client.$schema.getEndpointPaths());

// 4. 类型推断
type RequestType = typeof client.getUser.infer.request;
type ResponseType = typeof client.getUser.infer.response;

console.log('4. 类型推断正常 ✓');

console.log('\n=== API 简化成功！===');
console.log('现在 createClient 直接返回包含所有 schema 功能的客户端');
