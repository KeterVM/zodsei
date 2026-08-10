import {
  Contract,
  EndpointDefinition,
  ClientConfig,
  InternalClientConfig,
  RequestContext,
  ResponseContext,
  ApiClient,
  EndpointMethodWithSchema,
  InferResponseType,
} from './types';
import { validateRequest, validateResponse } from './validation';
import { separateParams, replacePath, shouldHaveBody } from './utils/path';
import { MiddlewareExecutor } from './middleware';
import { AxiosAdapter } from './adapters/axios';
import { SchemaExtractor } from './schema';

/**
 * Zodsei client core implementation
 */
export class ZodseiClient<T extends Contract> {
  private readonly contract: T;
  private readonly config: InternalClientConfig;
  private readonly middlewareExecutor: MiddlewareExecutor;
  private readonly adapter: AxiosAdapter;
  public readonly $schema: SchemaExtractor<T>;

  constructor(contract: T, config: ClientConfig) {
    this.contract = contract;
    this.config = {
      validateRequest: config.validateRequest ?? true,
      validateResponse: config.validateResponse ?? true,
      middleware: config.middleware ?? [],
      axios: config.axios,
    };
    this.middlewareExecutor = new MiddlewareExecutor(this.config.middleware);
    this.adapter = new AxiosAdapter(this.config.axios);
    this.$schema = new SchemaExtractor(contract);

    // Create proxy object for dynamic method calls with nested support
    return new Proxy(this, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          // Check if it's a direct endpoint
          if (prop in this.contract && this.isEndpointDefinition(this.contract[prop])) {
            return this.createEndpointMethod(this.contract[prop] as EndpointDefinition);
          }

          // Check if it's a nested contract
          if (prop in this.contract && this.isNestedContract(this.contract[prop])) {
            return this.createNestedClient(this.contract[prop] as Contract);
          }
        }
        return Reflect.get(target as object, prop) as unknown;
      },
    }) as ZodseiClient<T> & ApiClient<T>;
  }

  /**
   * Check if a value is an endpoint definition
   */
  private isEndpointDefinition(value: unknown): value is EndpointDefinition {
    return typeof value === 'object' && value !== null && 'path' in value && 'method' in value;
  }

  /**
   * Check if a value is a nested contract
   */
  private isNestedContract(value: unknown): value is Contract {
    return typeof value === 'object' && value !== null && !this.isEndpointDefinition(value);
  }

  /**
   * Create nested client for sub-contracts
   */
  private createNestedClient(nestedContract: Contract): ApiClient<Contract> {
    return new Proxy(
      {},
      {
        get: (_target, prop: string | symbol) => {
          if (typeof prop === 'string') {
            // Check if it's a direct endpoint in nested contract
            if (prop in nestedContract && this.isEndpointDefinition(nestedContract[prop])) {
              return this.createEndpointMethod(nestedContract[prop] as EndpointDefinition);
            }

            // Check if it's further nested
            if (prop in nestedContract && this.isNestedContract(nestedContract[prop])) {
              return this.createNestedClient(nestedContract[prop] as Contract);
            }
          }
          return undefined as unknown;
        },
      }
    ) as ApiClient<Contract>;
  }

  /**
   * Create endpoint method with schema access
   */
  private createEndpointMethod(targetEndpoint: EndpointDefinition) {
    const method = async (...args: unknown[]) => {
      // 如果有 request schema，取第一个参数；否则传 undefined
      const data = targetEndpoint.request ? args[0] : undefined;
      return this.executeEndpoint(targetEndpoint, data) as Promise<
        InferResponseType<typeof targetEndpoint>
      >;
    };

    // Attach schema information to the method
    (method as EndpointMethodWithSchema<typeof targetEndpoint>).schema = {
      request: targetEndpoint.request,
      response: targetEndpoint.response,
      endpoint: targetEndpoint,
    };

    return method as EndpointMethodWithSchema<typeof targetEndpoint>;
  }

  /**
   * Execute endpoint request
   */
  private async executeEndpoint(endpoint: EndpointDefinition, data: unknown): Promise<unknown> {
    // Validate request data
    const validatedData = this.config.validateRequest
      ? validateRequest(endpoint.request, data)
      : data;

    // Build request context
    const requestContext = this.buildRequestContext(endpoint, validatedData);

    // Execute middleware chain
    const response = await this.middlewareExecutor.execute(requestContext, (ctx) =>
      this.adapter.request(ctx)
    );

    // Validate response data
    const validatedResponse = this.config.validateResponse
      ? validateResponse(endpoint.response, response.data)
      : response.data;

    return validatedResponse;
  }

  /**
   * Build request context
   */
  private buildRequestContext(endpoint: EndpointDefinition, data: unknown): RequestContext {
    const { path, method } = endpoint;

    // Separate path params and query params
    const { pathParams, queryParams } = separateParams(
      path,
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined
    );

    // Replace path parameters
    const finalPath = replacePath(path, pathParams);

    const usesBody = shouldHaveBody(method);
    const isRecord = typeof data === 'object' && data !== null && !Array.isArray(data);
    const requestData = isRecord ? queryParams : data;

    return {
      // Keep query parameters in RequestContext so Axios serializes them exactly once.
      url: finalPath.startsWith('/') ? finalPath : `/${finalPath}`,
      method,
      headers: {},
      body: usesBody ? requestData : undefined,
      params: pathParams,
      query: !usesBody && isRecord ? queryParams : undefined,
    };
  }

  /**
   * Add middleware
   */
  public use(
    middleware: (
      request: RequestContext,
      next: (request: RequestContext) => Promise<ResponseContext>
    ) => Promise<ResponseContext>
  ): void {
    this.middlewareExecutor.use(middleware);
  }
}

/**
 * Create client with enhanced schema support
 */
export function createClient<T extends Contract>(
  contract: T,
  config: ClientConfig
): ZodseiClient<T> & ApiClient<T> {
  return new ZodseiClient(contract, config) as ZodseiClient<T> & ApiClient<T>;
}
