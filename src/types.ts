import { z } from 'zod';
import type { HttpAdapter, AdapterType } from './adapters';

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
export type Contract = Record<string, EndpointDefinition>;

// Client configuration
export interface ClientConfig {
  baseUrl: string;
  validateRequest?: boolean;
  validateResponse?: boolean;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  middleware?: Middleware[];
  adapter?: AdapterType | HttpAdapter;
  adapterConfig?: Record<string, any>;
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

// Derive client type from Contract
export type ApiClient<T extends Contract> = {
  [K in keyof T]: (
    data: z.infer<T[K]['request']>
  ) => Promise<z.infer<T[K]['response']>>
};

// Path parameter extraction type
export type ExtractPathParams<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractPathParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {};

// Request data separation type
export type SeparateRequestData<T> = T extends Record<string, any>
  ? {
      pathParams: ExtractPathParams<string>;
      queryParams: Omit<T, keyof ExtractPathParams<string>>;
      body: T;
    }
  : {
      pathParams: {};
      queryParams: {};
      body: T;
    };
