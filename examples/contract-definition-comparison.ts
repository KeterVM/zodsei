import { z, createClient, defineContract, type Contract } from '../src';
import axios from 'axios';

// Sample schemas for demonstration
const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
});

console.log('🔍 Contract Definition Methods Comparison\n');

// ========================================
// 方案 1: 使用 satisfies (推荐)
// ========================================
console.log('📋 方案 1: as const satisfies Contract');

const contract1 = {
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({ id: z.uuid() }),
    response: UserSchema,
  },
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({ name: z.string(), email: z.email() }),
    response: UserSchema,
  },
} as const satisfies Contract;

// 类型推导测试
type Contract1Type = typeof contract1;
// ✅ 保留字面量类型: method: "get" | "post"

console.log('✅ 保留字面量类型，编译时类型检查');
console.log('✅ TypeScript 4.9+ 推荐方式');
console.log('❌ 语法稍显冗长\n');

// ========================================
// 方案 2: 使用 defineContract 辅助函数
// ========================================
console.log('📋 方案 2: defineContract 辅助函数');

const contract2 = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({ id: z.uuid() }),
    response: UserSchema,
  },
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({ name: z.string(), email: z.email() }),
    response: UserSchema,
  },
});

// 类型推导测试
type Contract2Type = typeof contract2;
// ✅ 保留字面量类型: method: "get" | "post"

console.log('✅ 语法简洁，函数式风格');
console.log('✅ 保留字面量类型');
console.log('✅ 编译时类型检查');
console.log('❌ 需要额外的辅助函数\n');

// ========================================
// 方案 3: 泛型约束函数 (最灵活)
// ========================================
console.log('📋 方案 3: 泛型约束函数');

function createContract<T extends Contract>(contract: T): T {
  return contract;
}

const contract3 = createContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({ id: z.uuid() }),
    response: UserSchema,
  },
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({ name: z.string(), email: z.email() }),
    response: UserSchema,
  },
});

// 类型推导测试
type Contract3Type = typeof contract3;
// ✅ 保留字面量类型: method: "get" | "post"

console.log('✅ 最大灵活性');
console.log('✅ 可以添加额外的运行时逻辑');
console.log('✅ 保留字面量类型');
console.log('❌ 需要自定义函数\n');

// ========================================
// 方案 4: 直接使用 as const (最简单)
// ========================================
console.log('📋 方案 4: 直接使用 as const');

const contract4 = {
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({ id: z.uuid() }),
    response: UserSchema,
  },
  createUser: {
    path: '/users',
    method: 'post' as const,
    request: z.object({ name: z.string(), email: z.email() }),
    response: UserSchema,
  },
} as const;

// 类型推导测试
type Contract4Type = typeof contract4;
// ✅ 保留字面量类型: method: "get" | "post"

console.log('✅ 最简洁的语法');
console.log('✅ 保留字面量类型');
console.log('❌ 没有编译时 Contract 类型检查');
console.log('❌ 可能定义错误的 contract 结构\n');

// ========================================
// 错误示例: 使用类型注解 (不推荐)
// ========================================
console.log('📋 ❌ 错误方案: 直接类型注解');

const contractWrong: Contract = {
  getUser: {
    path: '/users/:id',
    method: 'get' as const, // 这里的 as const 会被擦除
    request: z.object({ id: z.uuid() }),
    response: UserSchema,
  },
};

// 类型推导测试
type ContractWrongType = typeof contractWrong;
// ❌ 丢失字面量类型: method: HttpMethod (联合类型)

console.log('❌ 丢失字面量类型');
console.log('❌ 类型推导不准确');
console.log('❌ 影响客户端方法生成\n');

// ========================================
// 实际使用测试
// ========================================
console.log('🧪 实际使用测试:\n');

// 所有正确的方案都能正常工作
const axiosInstance = axios.create({ baseURL: 'https://api.example.com' });
const client1 = createClient(contract1, { axios: axiosInstance });
const client2 = createClient(contract2, { axios: axiosInstance });
const client3 = createClient(contract3, { axios: axiosInstance });
const client4 = createClient(contract4, { axios: axiosInstance });

console.log('✅ 所有正确方案都能正常创建客户端');

// 类型推导测试
async function testTypeInference() {
  // 这些调用都有正确的类型推导
  // const user1 = await client1.getUser({ id: 'uuid' });
  // const user2 = await client2.getUser({ id: 'uuid' });
  // const user3 = await client3.getUser({ id: 'uuid' });
  // const user4 = await client4.getUser({ id: 'uuid' });

  console.log('✅ 所有方案都有正确的类型推导');
}

// ========================================
// 推荐方案总结
// ========================================
console.log('\n🎯 推荐方案总结:');
console.log('1. 🥇 方案2 (defineContract): 最佳平衡，语法简洁 + 类型安全');
console.log('2. 🥈 方案1 (satisfies): TypeScript 官方推荐，稍显冗长');
console.log('3. 🥉 方案4 (as const): 最简单，但缺少类型检查');
console.log('4. 🔧 方案3 (自定义函数): 需要额外逻辑时使用');

export { contract1, contract2, contract3, contract4, contractWrong, createContract };
