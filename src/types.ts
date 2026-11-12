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

export function isEndpointDefinition(value: unknown): value is EndpointDefinition {
  // A group may hold endpoints named `path` and `method`; only strings mark an endpoint.
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { path?: unknown }).path === 'string' &&
    typeof (value as { method?: unknown }).method === 'string'
  );
}

export function isNestedContract(value: unknown): value is Contract {
  return typeof value === 'object' && value !== null && !isEndpointDefinition(value);
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
  signal?: AbortSignal;
  timeout?: number;
}

// Per-call options, passed after the request data (or alone when the endpoint has none)
export interface RequestOptions {
  signal?: AbortSignal;
  /** Milliseconds; overrides the axios instance timeout for this call. */
  timeout?: number;
  /** Merged over the client's headers for this call. */
  headers?: Record<string, string>;
}

// Response context
export interface ResponseContext {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}

// Schema inference types
export type InferRequestType<T extends EndpointDefinition> = T['request'] extends z.ZodType
  ? z.infer<T['request']>
  : void;

export type InferResponseType<T extends EndpointDefinition> = T['response'] extends z.ZodType
  ? z.infer<T['response']>
  : unknown;

// Enhanced endpoint method with schema access
export interface EndpointMethodWithSchema<T extends EndpointDefinition> {
  (
    ...args: T['request'] extends z.ZodType
      ? [data: InferRequestType<T>, options?: RequestOptions]
      : [options?: RequestOptions]
  ): Promise<InferResponseType<T>>;
  schema: {
    request: T['request'];
    response: T['response'];
    endpoint: T;
  };
}
