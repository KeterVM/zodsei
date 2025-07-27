import { HttpAdapter, AdapterConfig } from './index';
import { RequestContext, ResponseContext } from '../types';
import { HttpError, NetworkError, TimeoutError } from '../errors';

/**
 * Ky adapter configuration
 */
export interface KyAdapterConfig extends AdapterConfig {
  timeout?: number;
  retry?: number | {
    limit: number;
    methods: string[];
    statusCodes: number[];
    backoffLimit: number;
  };
  throwHttpErrors?: boolean;
  credentials?: RequestCredentials;
  mode?: RequestMode;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
}

/**
 * Ky HTTP adapter
 */
export class KyAdapter implements HttpAdapter {
  readonly name = 'ky';
  private config: KyAdapterConfig;
  private ky: any;

  constructor(config: KyAdapterConfig = {}) {
    this.config = {
      timeout: 30000,
      throwHttpErrors: false, // We handle errors ourselves
      ...config
    };
  }

  private async getKy() {
    if (!this.ky) {
      try {
        const kyModule = await import('ky');
        this.ky = kyModule.default || kyModule;
      } catch (error) {
        throw new Error('ky is not installed. Please install it with: npm install ky');
      }
    }
    return this.ky;
  }

  async request(context: RequestContext): Promise<ResponseContext> {
    try {
      const ky = await this.getKy();
      const kyOptions = this.createKyOptions(context);
      
      const response = await ky(context.url, kyOptions);

      // Parse response data
      const data = await this.parseResponseData(response);

      // Build response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });

      const responseContext: ResponseContext = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
      };

      // Check HTTP status
      if (!response.ok) {
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          data
        );
      }

      return responseContext;
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Handle Ky errors
      if (error.name === 'HTTPError') {
        const response = error.response;
        const data = await this.parseResponseData(response).catch(() => null);
        
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          data
        );
      }

      if (error.name === 'TimeoutError') {
        throw new TimeoutError(this.config.timeout || 0);
      }

      throw new NetworkError(`Ky request failed: ${error.message}`, error);
    }
  }

  private createKyOptions(context: RequestContext): any {
    const options: any = {
      method: context.method.toLowerCase(),
      headers: {
        'Content-Type': 'application/json',
        ...context.headers,
      },
      timeout: this.config.timeout,
      retry: this.config.retry,
      throwHttpErrors: this.config.throwHttpErrors,
      credentials: this.config.credentials,
      mode: this.config.mode,
      cache: this.config.cache,
      redirect: this.config.redirect,
      referrer: this.config.referrer,
      referrerPolicy: this.config.referrerPolicy,
      integrity: this.config.integrity,
    };

    // Add request body
    if (context.body !== undefined && !['GET', 'HEAD'].includes(context.method.toUpperCase())) {
      if (typeof context.body === 'object') {
        options.json = context.body;
      } else {
        options.body = context.body;
      }
    }

    // Add query parameters
    if (context.query && Object.keys(context.query).length > 0) {
      options.searchParams = context.query;
    }

    return options;
  }

  private async parseResponseData(response: any): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return response.json();
    } else if (contentType?.includes('text/')) {
      return response.text();
    } else if (contentType?.includes('application/octet-stream') || contentType?.includes('application/pdf')) {
      return response.blob();
    } else {
      // Try to parse as JSON, fallback to text
      try {
        return await response.json();
      } catch {
        return response.text();
      }
    }
  }
}
