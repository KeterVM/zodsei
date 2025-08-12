import { z } from 'zod';
import type { AdapterType } from './adapters';
import type { FetchAdapterConfig } from './adapters/fetch';
import type { AxiosAdapterConfig } from './adapters/axios';
import type { KyAdapterConfig } from './adapters/ky';
import type { SchemaExtractor } from './schema';

// HTTP method types
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

// Endpoint definition interface
export interface EndpointDefinition {
  path: string;
  method: HttpMethod;
  request?: z.ZodSchema;
  response?: z.ZodSchema;
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
  baseUrl: string;
  validateRequest?: boolean;
  validateResponse?: boolean;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  middleware?: Middleware[];
}

// Type-safe client configuration with conditional adapterConfig
export type ClientConfig =
  | (BaseClientConfig & {
      adapter?: 'fetch';
      adapterConfig?: FetchAdapterConfig;
    })
  | (BaseClientConfig & {
      adapter: 'axios';
      adapterConfig?: AxiosAdapterConfig;
    })
  | (BaseClientConfig & {
      adapter: 'ky';
      adapterConfig?: KyAdapterConfig;
    })
  | (BaseClientConfig & {
      adapter?: undefined;
      adapterConfig?: FetchAdapterConfig; // Default to fetch
    });

// Internal configuration type for client implementation
export interface InternalClientConfig {
  baseUrl: string;
  validateRequest: boolean;
  validateResponse: boolean;
  headers: Record<string, string>;
  timeout: number;
  retries: number;
  middleware: Middleware[];
  adapter: AdapterType | undefined;
  adapterConfig: Record<string, any>;
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
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, any>;
}

// Response context
export interface ResponseContext {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
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
  T extends Record<string, any>
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
  T['request'] extends z.ZodSchema ? z.infer<T['request']> : void;

export type InferResponseType<T extends EndpointDefinition> = 
  T['response'] extends z.ZodSchema ? z.infer<T['response']> : unknown;

// Enhanced endpoint method with schema access
export interface EndpointMethodWithSchema<T extends EndpointDefinition> {
  (
    ...args: T['request'] extends z.ZodSchema 
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
