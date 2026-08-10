import type { z } from 'zod';
import type { Contract, EndpointDefinition, InferRequestType, InferResponseType } from './types';

/**
 * Schema inference and extraction utilities
 */

/**
 * Extract all endpoint types from a contract
 */
export type InferContractTypes<T extends Contract> = {
  [K in keyof T]: T[K] extends EndpointDefinition
    ? {
        request: InferRequestType<T[K]>;
        response: InferResponseType<T[K]>;
        endpoint: T[K];
      }
    : T[K] extends Contract
      ? InferContractTypes<T[K]>
      : never;
};

/**
 * Schema extraction utilities
 */
export class SchemaExtractor<T extends Contract> {
  constructor(private contract: T) {}

  /**
   * Get endpoint definition by path
   */
  getEndpoint<K extends keyof T>(path: K): T[K] extends EndpointDefinition ? T[K] : never {
    const endpoint = this.contract[path];
    if (this.isEndpointDefinition(endpoint)) {
      return endpoint as T[K] extends EndpointDefinition ? T[K] : never;
    }
    throw new Error(`Endpoint "${String(path)}" not found or is not a valid endpoint`);
  }

  /**
   * Get nested contract by path
   */
  getNested<K extends keyof T>(path: K): T[K] extends Contract ? SchemaExtractor<T[K]> : never {
    const nested = this.contract[path];
    if (this.isNestedContract(nested)) {
      return new SchemaExtractor(nested as T[K] & Contract) as T[K] extends Contract
        ? SchemaExtractor<T[K]>
        : never;
    }
    throw new Error(`Nested contract "${String(path)}" not found or is not a valid contract`);
  }

  /**
   * Get request schema for an endpoint
   */
  getRequestSchema<K extends keyof T>(
    path: K
  ): T[K] extends EndpointDefinition ? T[K]['request'] : never {
    const endpoint = this.getEndpoint(path);
    return endpoint.request as T[K] extends EndpointDefinition ? T[K]['request'] : never;
  }

  /**
   * Get response schema for an endpoint
   */
  getResponseSchema<K extends keyof T>(
    path: K
  ): T[K] extends EndpointDefinition ? T[K]['response'] : never {
    const endpoint = this.getEndpoint(path);
    return endpoint.response as T[K] extends EndpointDefinition ? T[K]['response'] : never;
  }

  /**
   * Get all schemas for an endpoint
   */
  getEndpointSchemas<K extends keyof T>(
    path: K
  ): T[K] extends EndpointDefinition
    ? { request: T[K]['request']; response: T[K]['response']; endpoint: T[K] }
    : never {
    const endpoint = this.getEndpoint(path);
    const result = {
      request: endpoint.request,
      response: endpoint.response,
      endpoint: endpoint as T[K] & EndpointDefinition,
    };
    return result as T[K] extends EndpointDefinition
      ? { request: T[K]['request']; response: T[K]['response']; endpoint: T[K] }
      : never;
  }

  /**
   * Get all endpoint paths in the contract
   */
  getEndpointPaths(): Array<keyof T> {
    return Object.keys(this.contract).filter((key) =>
      this.isEndpointDefinition(this.contract[key])
    ) as Array<keyof T>;
  }

  /**
   * Describe an endpoint using its public contract data.
   */
  describeEndpoint<K extends keyof T>(
    path: K
  ): T[K] extends EndpointDefinition
    ? {
        path: string;
        method: string;
        requestSchema: z.ZodType | undefined;
        responseSchema: z.ZodType | undefined;
      }
    : never {
    const endpoint = this.getEndpoint(path);

    const result = {
      path: endpoint.path,
      method: endpoint.method,
      requestSchema: endpoint.request,
      responseSchema: endpoint.response,
    };

    return result as T[K] extends EndpointDefinition
      ? {
          path: string;
          method: string;
          requestSchema: z.ZodType | undefined;
          responseSchema: z.ZodType | undefined;
        }
      : never;
  }

  /**
   * Check if a value is an endpoint definition
   */
  private isEndpointDefinition(value: unknown): value is EndpointDefinition {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      value !== null &&
      'path' in value &&
      'method' in value
    );
  }

  /**
   * Check if a value is a nested contract
   */
  private isNestedContract(value: unknown): value is Contract {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      value !== null &&
      !this.isEndpointDefinition(value)
    );
  }
}

/**
 * Utility to extract type information at runtime
 */
export function extractTypeInfo<T extends EndpointDefinition>(endpoint: T) {
  return {
    requestSchema: endpoint.request,
    responseSchema: endpoint.response,
    method: endpoint.method,
    path: endpoint.path,
    hasRequestSchema: Boolean(endpoint.request),
    hasResponseSchema: Boolean(endpoint.response),
  };
}
