import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import type { SchemaExtractor } from './schema';

// HTTP method types
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

// Endpoint definition interface
export interface EndpointDefinition {
  path: string;
  method: HttpMethod;
  request?: z.ZodType;
  response?: z.ZodType;
}

// Contract type
/**
 * Contract definition - can be nested
 */
export interface Contract {
  [key: string]: EndpointDefinition | Contract;
}

/**
 * Helper function to define a contract with proper type inference
 * Preserves literal types while ensuring type safety
 * Supports nested contracts
 */
export function defineContract<T extends Contract>(contract: T): T {
  return contract;
}

/**
 * Create client type from contract - supports nested access with schema support
 */
export type ApiClient<T extends Contract> = {
  [K in keyof T]: T[K] extends EndpointDefinition
    ? EndpointMethodWithSchema<T[K]>
    : T[K] extends Contract
      ? ApiClient<T[K]>
      : never;
} & {
  $schema: SchemaExtractor<T>;
};

// Base client configuration
interface BaseClientConfig {
  validateRequest?: boolean;
  validateResponse?: boolean;
  middleware?: Middleware[];
}

// Type-safe client configuration with conditional adapterConfig
export type ClientConfig = BaseClientConfig & {
  // User must provide an Axios instance
  axios: AxiosInstance;
};

// Internal configuration type for client implementation
export interface InternalClientConfig {
  validateRequest: boolean;
  validateResponse: boolean;
  middleware: Middleware[];
  axios: AxiosInstance;
}

// Middleware types
export type Middleware = (
  request: RequestContext,
  next: (request: RequestContext) => Promise<ResponseContext>
) => Promise<ResponseContext>;

// Request context
export interface RequestContext {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
}

// Response context
export interface ResponseContext {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}

// Path parameter extraction type
export type ExtractPathParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractPathParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
      ? { [K in Param]: string }
      : object;

// Request data separation type
export type SeparateRequestData<T> =
  T extends Record<string, unknown>
    ? {
        pathParams: ExtractPathParams<string>;
        queryParams: Omit<T, keyof ExtractPathParams<string>>;
        body: T;
      }
    : {
        pathParams: object;
        queryParams: object;
        body: T;
      };

// Schema inference types
export type InferRequestType<T extends EndpointDefinition> = 
  T['request'] extends z.ZodType ? z.infer<T['request']> : void;

export type InferResponseType<T extends EndpointDefinition> = 
  T['response'] extends z.ZodType ? z.infer<T['response']> : unknown;

// Enhanced endpoint method with schema access
export interface EndpointMethodWithSchema<T extends EndpointDefinition> {
  (
    ...args: T['request'] extends z.ZodType 
      ? [data: InferRequestType<T>] 
      : []
  ): Promise<InferResponseType<T>>;
  schema: {
    request: T['request'];
    response: T['response'];
    endpoint: T;
  };
  infer: {
    request: InferRequestType<T>;
    response: InferResponseType<T>;
  };
}

// Legacy type alias for backward compatibility
export type EnhancedApiClient<T extends Contract> = ApiClient<T>;
