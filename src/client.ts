import {
  Contract,
  EndpointDefinition,
  ClientConfig,
  InternalClientConfig,
  RequestContext,
  ResponseContext,
  ApiClient,
  EndpointMethodWithSchema,
  InferRequestType,
  InferResponseType,
} from './types';
import { validateRequest, validateResponse } from './validation';
import { separateParams, buildUrl, replacePath, shouldHaveBody } from './utils/path';
import { createMiddlewareExecutor, MiddlewareExecutor } from './middleware';
import { createAdapter, HttpAdapter } from './adapters';
import { SchemaExtractor, createSchemaExtractor } from './schema';

/**
 * Zodsei client core implementation
 */
export class ZodseiClient<T extends Contract> {
  private readonly contract: T;
  private readonly config: InternalClientConfig;
  private readonly middlewareExecutor: MiddlewareExecutor;
  private adapter: HttpAdapter | null = null;
  public readonly $schema: SchemaExtractor<T>;

  constructor(contract: T, config: ClientConfig) {
    this.contract = contract;
    this.config = this.normalizeConfig(config);
    this.middlewareExecutor = createMiddlewareExecutor(this.config.middleware);
    this.$schema = createSchemaExtractor(contract);

    // Create proxy object for dynamic method calls with nested support
    return new Proxy(this, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          // Check if it's a direct endpoint
          if (prop in this.contract && this.isEndpointDefinition(this.contract[prop])) {
            return this.createEndpointMethod(prop);
          }

          // Check if it's a nested contract
          if (prop in this.contract && this.isNestedContract(this.contract[prop])) {
            return this.createNestedClient(this.contract[prop] as Contract);
          }
        }
        return (target as any)[prop];
      },
    }) as ZodseiClient<T> & ApiClient<T>;
  }

  /**
   * Normalize configuration
   */
  private normalizeConfig(config: ClientConfig): InternalClientConfig {
    return {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      validateRequest: config.validateRequest ?? true,
      validateResponse: config.validateResponse ?? true,
      headers: config.headers ?? {},
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 0,
      middleware: config.middleware ?? [],
      adapter: config.adapter ?? 'fetch',
      adapterConfig: config.adapterConfig ?? {},
    };
  }

  /**
   * Check if a value is an endpoint definition
   */
  private isEndpointDefinition(value: any): value is EndpointDefinition {
    return (
      value &&
      typeof value === 'object' &&
      'path' in value &&
      'method' in value
    );
  }

  /**
   * Check if a value is a nested contract
   */
  private isNestedContract(value: any): value is Contract {
    return value && typeof value === 'object' && !this.isEndpointDefinition(value);
  }

  /**
   * Create nested client for sub-contracts
   */
  private createNestedClient(nestedContract: Contract): any {
    return new Proxy(
      {},
      {
        get: (_target, prop: string | symbol) => {
          if (typeof prop === 'string') {
            // Check if it's a direct endpoint in nested contract
            if (prop in nestedContract && this.isEndpointDefinition(nestedContract[prop])) {
              return this.createEndpointMethod(
                `${prop}`,
                nestedContract[prop] as EndpointDefinition
              );
            }

            // Check if it's further nested
            if (prop in nestedContract && this.isNestedContract(nestedContract[prop])) {
              return this.createNestedClient(nestedContract[prop] as Contract);
            }
          }
          return undefined;
        },
      }
    );
  }

  /**
   * Create endpoint method with schema access
   */
  private createEndpointMethod(endpointName: string, endpoint?: EndpointDefinition) {
    const targetEndpoint = endpoint || (this.contract[endpointName] as EndpointDefinition);

    const method = async (...args: any[]) => {
      // 如果有 request schema，取第一个参数；否则传 undefined
      const data = targetEndpoint.request ? args[0] : undefined;
      return this.executeEndpoint(targetEndpoint, data) as Promise<InferResponseType<typeof targetEndpoint>>;
    };

    // Attach schema information to the method
    (method as EndpointMethodWithSchema<typeof targetEndpoint>).schema = {
      request: targetEndpoint.request,
      response: targetEndpoint.response,
      endpoint: targetEndpoint,
    };

    // Attach type inference helpers (for development/debugging)
    (method as EndpointMethodWithSchema<typeof targetEndpoint>).infer = {
      request: (targetEndpoint.request ? {} : undefined) as InferRequestType<typeof targetEndpoint>,
      response: (targetEndpoint.response ? {} : {}) as InferResponseType<typeof targetEndpoint>,
    };

    return method as EndpointMethodWithSchema<typeof targetEndpoint>;
  }

  /**
   * Execute endpoint request
   */
  private async executeEndpoint(endpoint: EndpointDefinition, data: any): Promise<any> {
    // Validate request data
    const validatedData = this.config.validateRequest
      ? validateRequest(endpoint.request, data)
      : data;

    // Build request context
    const requestContext = this.buildRequestContext(endpoint, validatedData);

    // Execute middleware chain
    const response = await this.middlewareExecutor.execute(requestContext, (ctx) =>
      this.executeHttpRequest(ctx)
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
  private buildRequestContext(endpoint: EndpointDefinition, data: any): RequestContext {
    const { path, method } = endpoint;

    // Separate path params and query params
    const { pathParams, queryParams } = separateParams(path, data);

    // Replace path parameters
    const finalPath = replacePath(path, pathParams);

    // Build URL
    const url =
      method.toLowerCase() === 'get'
        ? buildUrl(this.config.baseUrl, finalPath, queryParams)
        : buildUrl(this.config.baseUrl, finalPath);

    // Determine request body
    const body = shouldHaveBody(method)
      ? method.toLowerCase() === 'get'
        ? undefined
        : data
      : undefined;

    return {
      url,
      method,
      headers: { ...this.config.headers },
      body,
      params: pathParams,
      query: method.toLowerCase() === 'get' ? queryParams : undefined,
    };
  }

  /**
   * Get adapter
   */
  private async getAdapter(): Promise<HttpAdapter> {
    if (!this.adapter) {
      const adapterConfig = {
        timeout: this.config.timeout,
        ...this.config.adapterConfig,
      };

      if (typeof this.config.adapter === 'string') {
        this.adapter = await createAdapter(this.config.adapter, adapterConfig);
      } else {
        // Default to fetch adapter
        this.adapter = await createAdapter('fetch', adapterConfig);
      }
    }
    return this.adapter;
  }

  /**
   * Execute HTTP request
   */
  private async executeHttpRequest(context: RequestContext): Promise<ResponseContext> {
    const adapter = await this.getAdapter();
    return adapter.request(context);
  }

  /**
   * Get configuration
   */
  public getConfig(): Readonly<InternalClientConfig> {
    return { ...this.config };
  }

  /**
   * Get contract
   */
  public getContract(): Readonly<T> {
    return { ...this.contract };
  }

  /**
   * Add middleware
   */
  public use(middleware: any): void {
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
