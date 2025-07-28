/**
 * Zodsei - Contract-first type-safe HTTP client with Zod validation
 */

// Core exports
export { createClient, ZodseiClient } from './client';
export { defineContract } from './types';

// Schema exports
export {
  SchemaExtractor,
  createSchemaExtractor,
  extractTypeInfo,
  type InferRequestType,
  type InferResponseType,
  type InferContractTypes,
  type InferEndpointMethod
} from './schema';

// Type exports
export type {
  Contract,
  EndpointDefinition,
  ClientConfig,
  ApiClient,
  EnhancedApiClient,
  EndpointMethodWithSchema,
  HttpMethod,
  RequestContext,
  ResponseContext,
  Middleware,
  ExtractPathParams,
  SeparateRequestData
} from './types';

// Error class exports
export {
  ZodseiError,
  ValidationError,
  HttpError,
  NetworkError,
  ConfigError,
  TimeoutError
} from './errors';

// Validation utility exports
export {
  validateRequest,
  validateResponse,
  safeParseRequest,
  safeParseResponse,
  createValidator
} from './validation';

// Middleware exports
export { createMiddlewareExecutor, composeMiddleware } from './middleware';
export { retryMiddleware, simpleRetry } from './middleware/retry';
export { 
  cacheMiddleware, 
  simpleCache, 
  MemoryCacheStorage,
  type CacheConfig,
  type CacheStorage,
  type CacheEntry
} from './middleware/cache';

// Utility function exports
export {
  extractPathParamNames,
  replacePath,
  buildQueryString,
  buildUrl,
  separateParams,
  shouldHaveBody
} from './utils/path';

export {
  mergeHeaders
} from './utils/request';

// Adapter exports
export {
  createAdapter,
  getDefaultAdapter,
  isAdapterAvailable,
  type HttpAdapter,
  type AdapterType,
  type AdapterConfig
} from './adapters';

export { FetchAdapter, type FetchAdapterConfig } from './adapters/fetch';
export { AxiosAdapter, type AxiosAdapterConfig } from './adapters/axios';
export { KyAdapter, type KyAdapterConfig } from './adapters/ky';

// Re-export zod for user convenience
export { z } from 'zod';
