import { z } from 'zod';
import type { HttpAdapter, AdapterType } from './adapters';
import type { FetchAdapterConfig } from './adapters/fetch';
import type { AxiosAdapterConfig } from './adapters/axios';
import type { KyAdapterConfig } from './adapters/ky';

// HTTP method types
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

// Endpoint definition interface
export interface EndpointDefinition {
  path: string;
  method: HttpMethod;
  request: z.ZodSchema;
  response: z.ZodSchema;
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
 * Endpoint method type
 */
type EndpointMethod<T extends EndpointDefinition> = (
  data: z.infer<T['request']>
) => Promise<z.infer<T['response']>>;

/**
 * Create client type from contract - supports nested access only
 */
export type ApiClient<T extends Contract> = {
  [K in keyof T]: T[K] extends EndpointDefinition
    ? EndpointMethod<T[K]>
    : T[K] extends Contract
      ? ApiClient<T[K]>
      : never;
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
      adapter: HttpAdapter;
      adapterConfig?: Record<string, any>;
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
  adapter: AdapterType | HttpAdapter;
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
