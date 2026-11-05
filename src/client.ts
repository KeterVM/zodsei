import {
  Contract,
  EndpointDefinition,
  ClientConfig,
  InternalClientConfig,
  RequestContext,
  RequestOptions,
  ResponseContext,
  ApiClient,
  EndpointMethodWithSchema,
  InferResponseType,
} from './types';
import { validateRequest, validateResponse } from './validation';
import { canceledBy } from './errors';
import { separateParams, replacePath, shouldHaveBody, isNativeBody } from './utils/path';
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
      const [data, options] = targetEndpoint.request ? args : [undefined, args[0]];
      return this.executeEndpoint(
        targetEndpoint,
        data,
        options as RequestOptions | undefined
      ) as Promise<InferResponseType<typeof targetEndpoint>>;
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
  private async executeEndpoint(
    endpoint: EndpointDefinition,
    data: unknown,
    options: RequestOptions | undefined
  ): Promise<unknown> {
    if (options?.signal?.aborted) {
      throw canceledBy(options.signal);
    }

    // Validate request data
    const validatedData = this.config.validateRequest
      ? validateRequest(endpoint.request, data)
      : data;

    // Build request context
    const requestContext = this.buildRequestContext(endpoint, validatedData, options);

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
  private buildRequestContext(
    endpoint: EndpointDefinition,
    data: unknown,
    options: RequestOptions | undefined
  ): RequestContext {
    const { path, method } = endpoint;

    const fields =
      typeof data === 'object' && data !== null && !Array.isArray(data) && !isNativeBody(data)
        ? (data as Record<string, unknown>)
        : undefined;
    const { pathParams, queryParams } = separateParams(path, fields);
    const finalPath = replacePath(path, pathParams);

    const usesBody = shouldHaveBody(method);
    const body = usesBody ? (fields ? queryParams : data) : undefined;

    return {
      // Keep query parameters in RequestContext so Axios serializes them exactly once.
      url: finalPath.startsWith('/') ? finalPath : `/${finalPath}`,
      method,
      headers: {
        ...(body === undefined || isNativeBody(body) ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
      body,
      params: Object.fromEntries(
        Object.entries(pathParams).map(([key, value]) => [key, String(value)])
      ),
      query: !usesBody && fields ? queryParams : undefined,
      signal: options?.signal,
      timeout: options?.timeout,
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
