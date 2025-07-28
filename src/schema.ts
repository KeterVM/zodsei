import { z } from 'zod';
import type { Contract, EndpointDefinition } from './types';

/**
 * Schema inference and extraction utilities
 */

/**
 * Extract request type from endpoint definition
 */
export type InferRequestType<T extends EndpointDefinition> = z.infer<T['request']>;

/**
 * Extract response type from endpoint definition
 */
export type InferResponseType<T extends EndpointDefinition> = z.infer<T['response']>;

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
   * Get all nested contract paths
   */
  getNestedPaths(): Array<keyof T> {
    return Object.keys(this.contract).filter((key) =>
      this.isNestedContract(this.contract[key])
    ) as Array<keyof T>;
  }

  /**
   * Generate OpenAPI-like schema description
   */
  describeEndpoint<K extends keyof T>(
    path: K
  ): T[K] extends EndpointDefinition
    ? {
        path: string;
        method: string;
        requestSchema: z.ZodSchema;
        responseSchema: z.ZodSchema;
        requestType: string;
        responseType: string;
      }
    : never {
    const endpoint = this.getEndpoint(path);

    const result = {
      path: endpoint.path,
      method: endpoint.method,
      requestSchema: endpoint.request,
      responseSchema: endpoint.response,
      requestType: this.getSchemaDescription(endpoint.request),
      responseType: this.getSchemaDescription(endpoint.response),
    };

    return result as T[K] extends EndpointDefinition
      ? {
          path: string;
          method: string;
          requestSchema: z.ZodSchema;
          responseSchema: z.ZodSchema;
          requestType: string;
          responseType: string;
        }
      : never;
  }

  /**
   * Generate schema description for documentation
   */
  private getSchemaDescription(schema: z.ZodSchema): string {
    try {
      // Try to get a basic description of the schema
      if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const fields = Object.keys(shape).map((key) => {
          const field = shape[key] as z.ZodSchema;
          return `${key}: ${this.getZodTypeDescription(field)}`;
        });
        return `{ ${fields.join(', ')} }`;
      }
      return this.getZodTypeDescription(schema);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get basic Zod type description
   */
  private getZodTypeDescription(schema: z.ZodSchema): string {
    // Use the _def property to determine the type, which is more reliable
    const def = (schema as z.ZodSchema & { _def?: { typeName?: string; type?: z.ZodSchema; innerType?: z.ZodSchema; value?: unknown } })._def;
    if (def?.typeName) {
      switch (def.typeName) {
        case 'ZodString': return 'string';
        case 'ZodNumber': return 'number';
        case 'ZodBoolean': return 'boolean';
        case 'ZodArray': 
          return def.type ? `${this.getZodTypeDescription(def.type)}[]` : 'array';
        case 'ZodOptional': 
          return def.innerType ? `${this.getZodTypeDescription(def.innerType)}?` : 'optional';
        case 'ZodNullable': 
          return def.innerType ? `${this.getZodTypeDescription(def.innerType)} | null` : 'nullable';
        case 'ZodObject': return 'object';
        case 'ZodUnion': return 'union';
        case 'ZodLiteral': return `literal(${JSON.stringify(def.value)})`;
        case 'ZodEnum': return 'enum';
        default: return def.typeName.replace('Zod', '').toLowerCase();
      }
    }
    
    // Fallback to instanceof checks for older versions
    try {
      if (schema instanceof z.ZodString) return 'string';
      if (schema instanceof z.ZodNumber) return 'number';
      if (schema instanceof z.ZodBoolean) return 'boolean';
      if (schema instanceof z.ZodArray) {
        // Safe access to element property
        const element = (schema as z.ZodArray<z.ZodSchema>).element;
        return element ? `${this.getZodTypeDescription(element)}[]` : 'array';
      }
      if (schema instanceof z.ZodOptional) {
        // Safe access to unwrap method
        const inner = (schema as z.ZodOptional<z.ZodSchema>).unwrap();
        return inner ? `${this.getZodTypeDescription(inner)}?` : 'optional';
      }
      if (schema instanceof z.ZodNullable) {
        // Safe access to unwrap method
        const inner = (schema as z.ZodNullable<z.ZodSchema>).unwrap();
        return inner ? `${this.getZodTypeDescription(inner)} | null` : 'nullable';
      }
      if (schema instanceof z.ZodObject) return 'object';
    } catch {
      // Ignore errors and return unknown
    }
    return 'unknown';
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
      'method' in value &&
      'request' in value &&
      'response' in value
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
 * Create a schema extractor for a contract
 */
export function createSchemaExtractor<T extends Contract>(contract: T): SchemaExtractor<T> {
  return new SchemaExtractor(contract);
}

/**
 * Utility type to infer endpoint method signature
 */
export type InferEndpointMethod<T extends EndpointDefinition> = (
  data: InferRequestType<T>
) => Promise<InferResponseType<T>>;

/**
 * Utility to extract type information at runtime
 */
export function extractTypeInfo<T extends EndpointDefinition>(endpoint: T) {
  return {
    requestSchema: endpoint.request,
    responseSchema: endpoint.response,
    method: endpoint.method,
    path: endpoint.path,
  };
}
