import { HttpAdapter, AdapterConfig } from './index';
import { RequestContext, ResponseContext } from '../types';
import { HttpError, NetworkError, TimeoutError } from '../errors';

/**
 * Fetch adapter configuration
 */
export interface FetchAdapterConfig extends AdapterConfig {
  timeout?: number;
  credentials?: RequestCredentials;
  mode?: RequestMode;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
}

/**
 * Fetch HTTP adapter
 */
export class FetchAdapter implements HttpAdapter {
  readonly name = 'fetch';
  private config: FetchAdapterConfig;

  constructor(config: FetchAdapterConfig = {}) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  async request(context: RequestContext): Promise<ResponseContext> {
    try {
      const init = this.createRequestInit(context);
      const response = await fetch(context.url, init);

      // Parse response data
      const data = await this.parseResponseData(response);

      // Build response context
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
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
        throw HttpError.fromResponse(response, data);
      }

      return responseContext;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(this.config.timeout || 0);
        }
        throw new NetworkError(`Fetch request failed: ${error.message}`, error);
      }

      throw new NetworkError('Unknown fetch error', error as Error);
    }
  }

  private createRequestInit(context: RequestContext): RequestInit {
    const init: RequestInit = {
      method: context.method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...context.headers,
      },
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
        init.body = JSON.stringify(context.body);
      } else {
        init.body = context.body;
      }
    }

    // Add timeout control
    if (this.config.timeout && this.config.timeout > 0) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), this.config.timeout);
      init.signal = controller.signal;
    }

    return init;
  }

  private async parseResponseData(response: Response): Promise<any> {
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
