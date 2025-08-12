import type { HttpAdapter } from './index';
import type { RequestContext, ResponseContext } from '../types';
import { HttpError, NetworkError, TimeoutError } from '../errors';
import type { CreateAxiosDefaults } from 'axios';

/**
 * Axios adapter configuration
 */
export type AxiosAdapterConfig = CreateAxiosDefaults;

/**
 * Axios HTTP adapter
 */
export class AxiosAdapter implements HttpAdapter {
  readonly name = 'axios';
  private config: AxiosAdapterConfig;
  private axios: any;

  constructor(config: AxiosAdapterConfig = {}) {
    this.config = {
      timeout: 30000,
      validateStatus: () => true, // We handle status validation ourselves
      ...config,
    };
  }

  private async getAxios() {
    if (!this.axios) {
      try {
        const axiosModule = await import('axios');
        this.axios = axiosModule.default || axiosModule;
      } catch (_error) {
        throw new Error('axios is not installed. Please install it with: npm install axios');
      }
    }
    return this.axios;
  }

  // Interceptors are not supported. Use middleware in the client instead.

  async request(context: RequestContext): Promise<ResponseContext> {
    try {
      const axios = await this.getAxios();
      const axiosConfig = this.createAxiosConfig(context);

      const response = await axios.request(axiosConfig);

      const responseContext: ResponseContext = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers || {},
        data: response.data,
      };

      // Check HTTP status
      if (response.status >= 400) {
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          response.data
        );
      }

      return responseContext;
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Handle Axios errors
      if (error.isAxiosError) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new TimeoutError(this.config.timeout || 0);
        }

        if (error.response) {
          // Server responded with error status code
          throw new HttpError(
            `HTTP ${error.response.status}: ${error.response.statusText}`,
            error.response.status,
            error.response.statusText,
            error.response.data
          );
        } else if (error.request) {
          // Request was made but no response received
          throw new NetworkError(`Network request failed: ${error.message}`, error);
        }
      }

      throw new NetworkError(`Axios request failed: ${error.message}`, error);
    }
  }

  private createAxiosConfig(context: RequestContext): any {
    const config: any = {
      url: context.url,
      method: context.method.toLowerCase(),
      headers: {
        'Content-Type': 'application/json',
        ...context.headers,
      },
      timeout: this.config.timeout,
      maxRedirects: this.config.maxRedirects,
      validateStatus: this.config.validateStatus,
      maxContentLength: this.config.maxContentLength,
      maxBodyLength: this.config.maxBodyLength,
      withCredentials: this.config.withCredentials,
      auth: this.config.auth,
      proxy: this.config.proxy,
    };

    // Add request body
    if (context.body !== undefined && !['GET', 'HEAD'].includes(context.method.toUpperCase())) {
      config.data = context.body;
    }

    // Add query parameters
    if (context.query && Object.keys(context.query).length > 0) {
      config.params = context.query;
    }

    return config;
  }
}
