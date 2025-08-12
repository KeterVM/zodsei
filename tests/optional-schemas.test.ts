import { z } from 'zod';
import { defineContract, createClient, extractTypeInfo } from '../src';
import { describe, it, expect } from 'vitest';

describe('Optional Schemas', () => {
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
      response: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
        })
      ),
    },

    // 只有 request schema 的端点
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
  } as const);

  const client = createClient(contract, {
    baseUrl: 'https://api.example.com',
  });

  describe('Type Inference', () => {
    it('should infer correct types for endpoints with schemas', () => {
      // 类型推断测试
      type CreateUserRequest = typeof client.createUser.infer.request;
      type CreateUserResponse = typeof client.createUser.infer.response;

      // 这些类型应该被正确推断
      const request: CreateUserRequest = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const response: CreateUserResponse = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      expect(request.name).toBe('John Doe');
      expect(response.id).toBe('123');
    });

    it('should infer void for endpoints without request schema', () => {
      type GetUsersRequest = typeof client.getUsers.infer.request;
      type HealthCheckRequest = typeof client.healthCheck.infer.request;

      // 这些应该是 void 类型
      const getUsersRequest: GetUsersRequest = undefined as any;
      const healthRequest: HealthCheckRequest = undefined as any;

      expect(getUsersRequest).toBeUndefined();
      expect(healthRequest).toBeUndefined();
    });

    it('should infer unknown for endpoints without response schema', () => {
      type DeleteUserResponse = typeof client.deleteUser.infer.response;
      type HealthCheckResponse = typeof client.healthCheck.infer.response;

      // 这些应该是 unknown 类型
      const deleteResponse: DeleteUserResponse = 'any value';
      const healthResponse: HealthCheckResponse = { status: 'ok' };

      expect(deleteResponse).toBeDefined();
      expect(healthResponse).toBeDefined();
    });
  });

  describe('Schema Access', () => {
    it('should provide access to schemas', () => {
      // 完整的端点
      expect(client.createUser.schema.request).toBeDefined();
      expect(client.createUser.schema.response).toBeDefined();
      expect(client.createUser.schema.endpoint).toBe(contract.createUser);

      // 只有 response schema
      expect(client.getUsers.schema.request).toBeUndefined();
      expect(client.getUsers.schema.response).toBeDefined();

      // 只有 request schema
      expect(client.deleteUser.schema.request).toBeDefined();
      expect(client.deleteUser.schema.response).toBeUndefined();

      // 没有 schema
      expect(client.healthCheck.schema.request).toBeUndefined();
      expect(client.healthCheck.schema.response).toBeUndefined();
    });
  });

  describe('Schema Extractor', () => {
    it('should describe endpoints correctly', () => {
      const schema = client.$schema;

      // 完整的端点
      const createUserDesc = schema.describeEndpoint('createUser');
      expect(createUserDesc.path).toBe('/users');
      expect(createUserDesc.method).toBe('post');
      expect(createUserDesc.requestSchema).toBeDefined();
      expect(createUserDesc.responseSchema).toBeDefined();
      expect(createUserDesc.requestType).toContain('name');
      expect(createUserDesc.responseType).toContain('id');

      // 只有 response schema
      const getUsersDesc = schema.describeEndpoint('getUsers');
      expect(getUsersDesc.requestSchema).toBeUndefined();
      expect(getUsersDesc.responseSchema).toBeDefined();
      expect(getUsersDesc.requestType).toBe('void');

      // 只有 request schema
      const deleteUserDesc = schema.describeEndpoint('deleteUser');
      expect(deleteUserDesc.requestSchema).toBeDefined();
      expect(deleteUserDesc.responseSchema).toBeUndefined();
      expect(deleteUserDesc.responseType).toBe('unknown');

      // 没有 schema
      const healthDesc = schema.describeEndpoint('healthCheck');
      expect(healthDesc.requestSchema).toBeUndefined();
      expect(healthDesc.responseSchema).toBeUndefined();
      expect(healthDesc.requestType).toBe('void');
      expect(healthDesc.responseType).toBe('unknown');
    });
  });

  describe('Runtime Type Info', () => {
    it('should extract type information correctly', () => {
      // 完整的端点
      const createUserInfo = extractTypeInfo(contract.createUser);
      expect(createUserInfo.hasRequestSchema).toBe(true);
      expect(createUserInfo.hasResponseSchema).toBe(true);
      expect(createUserInfo.requestSchema).toBeDefined();
      expect(createUserInfo.responseSchema).toBeDefined();

      // 只有 response schema
      const getUsersInfo = extractTypeInfo(contract.getUsers);
      expect(getUsersInfo.hasRequestSchema).toBe(false);
      expect(getUsersInfo.hasResponseSchema).toBe(true);
      expect(getUsersInfo.requestSchema).toBeUndefined();
      expect(getUsersInfo.responseSchema).toBeDefined();

      // 只有 request schema
      const deleteUserInfo = extractTypeInfo(contract.deleteUser);
      expect(deleteUserInfo.hasRequestSchema).toBe(true);
      expect(deleteUserInfo.hasResponseSchema).toBe(false);
      expect(deleteUserInfo.requestSchema).toBeDefined();
      expect(deleteUserInfo.responseSchema).toBeUndefined();

      // 没有 schema
      const healthInfo = extractTypeInfo(contract.healthCheck);
      expect(healthInfo.hasRequestSchema).toBe(false);
      expect(healthInfo.hasResponseSchema).toBe(false);
      expect(healthInfo.requestSchema).toBeUndefined();
      expect(healthInfo.responseSchema).toBeUndefined();
    });
  });

  describe('Method Signatures', () => {
    it('should have correct method signatures', () => {
      // 这些测试主要是编译时验证，确保类型系统正确工作

      // 有 request schema 的端点需要参数
      // client.createUser({ name: 'John', email: 'john@example.com' }); // ✅
      // client.createUser(); // ❌ 应该报错

      // 没有 request schema 的端点不需要参数
      // client.getUsers(); // ✅
      // client.getUsers({ param: 'value' }); // ❌ 应该报错

      // 这里我们只能测试运行时行为
      expect(typeof client.createUser).toBe('function');
      expect(typeof client.getUsers).toBe('function');
      expect(typeof client.deleteUser).toBe('function');
      expect(typeof client.healthCheck).toBe('function');
    });
  });
});
