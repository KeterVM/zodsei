import { z } from 'zod';
import {
  Contract,
  EndpointDefinition,
  ClientConfig,
  ApiClient,
  HttpMethod,
  RequestContext,
  ResponseContext
} from './types';
import { ConfigError } from './errors';
import { validateRequest, validateResponse } from './validation';
import { separateParams, buildUrl, replacePath, shouldHaveBody } from './utils/path';
import { createMiddlewareExecutor } from './middleware';
import { createAdapter, getDefaultAdapter, HttpAdapter } from './adapters';

/**
 * Zodsei client core implementation
 */
export class ZodseiClient<T extends Contract> {
  private readonly contract: T;
  private readonly config: Required<ClientConfig>;
  private readonly middlewareExecutor;
  private adapter: HttpAdapter | null = null;

  constructor(contract: T, config: ClientConfig) {
    this.contract = contract;
    this.config = this.normalizeConfig(config);
    this.middlewareExecutor = createMiddlewareExecutor(this.config.middleware);
    
    // Validate configuration
    this.validateConfig();
    
    // Create proxy object for dynamic method calls
    return new Proxy(this, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string' && prop in this.contract) {
          return this.createEndpointMethod(prop);
        }
        return (target as any)[prop];
      }
    }) as ZodseiClient<T> & ApiClient<T>;
  }

  /**
   * Normalize configuration
   */
  private normalizeConfig(config: ClientConfig): Required<ClientConfig> {
    return {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      validateRequest: config.validateRequest ?? true,
      validateResponse: config.validateResponse ?? true,
      headers: config.headers ?? {},
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 0,
      middleware: config.middleware ?? [],
      adapter: config.adapter ?? 'fetch',
      adapterConfig: config.adapterConfig ?? {}
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new ConfigError('baseUrl is required');
    }

    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new ConfigError('baseUrl must be a valid URL');
    }

    if (this.config.timeout < 0) {
      throw new ConfigError('timeout must be non-negative');
    }

    if (this.config.retries < 0) {
      throw new ConfigError('retries must be non-negative');
    }
  }

  /**
   * Create endpoint method
   */
  private createEndpointMethod(endpointName: string) {
    const endpoint = this.contract[endpointName];
    
    return async (data: any) => {
      return this.executeEndpoint(endpoint, data);
    };
  }

  /**
   * Execute endpoint request
   */
  private async executeEndpoint(
    endpoint: EndpointDefinition,
    data: any
  ): Promise<any> {
    // Validate request data
    const validatedData = this.config.validateRequest 
      ? validateRequest(endpoint.request, data)
      : data;

    // Build request context
    const requestContext = this.buildRequestContext(endpoint, validatedData);

    // Execute middleware chain
    const response = await this.middlewareExecutor.execute(
      requestContext,
      (ctx) => this.executeHttpRequest(ctx)
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
    data: any
  ): RequestContext {
    const { path, method } = endpoint;
    
    // Separate path params and query params
    const { pathParams, queryParams } = separateParams(path, data);
    
    // Replace path parameters
    const finalPath = replacePath(path, pathParams);
    
    // Build URL
    const url = method.toLowerCase() === 'get' 
      ? buildUrl(this.config.baseUrl, finalPath, queryParams)
      : buildUrl(this.config.baseUrl, finalPath);

    // Determine request body
    const body = shouldHaveBody(method) 
      ? (method.toLowerCase() === 'get' ? undefined : data)
      : undefined;

    return {
      url,
      method,
      headers: { ...this.config.headers },
      body,
      params: pathParams,
      query: method.toLowerCase() === 'get' ? queryParams : undefined
    };
  }

  /**
   * Get adapter
   */
  private async getAdapter(): Promise<HttpAdapter> {
    if (!this.adapter) {
      const adapterConfig = {
        timeout: this.config.timeout,
        ...this.config.adapterConfig
      };
      
      if (typeof this.config.adapter === 'string') {
        this.adapter = await createAdapter(this.config.adapter, adapterConfig);
      } else {
        this.adapter = this.config.adapter;
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
  public getConfig(): Readonly<Required<ClientConfig>> {
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
 * Create client
 */
export function createClient<T extends Contract>(
  contract: T,
  config: ClientConfig
): ZodseiClient<T> & ApiClient<T> {
  return new ZodseiClient(contract, config) as ZodseiClient<T> & ApiClient<T>;
}
