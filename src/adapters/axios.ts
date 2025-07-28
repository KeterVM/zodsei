import type { HttpAdapter } from './index';
import type { RequestContext, ResponseContext } from '../types';
import { HttpError, NetworkError, TimeoutError } from '../errors';
import type { CreateAxiosDefaults } from 'axios';

/**
 * Axios interceptor configuration
 */
export interface AxiosInterceptors {
  request?: {
    onFulfilled?: (config: any) => any | Promise<any>;
    onRejected?: (error: any) => any;
  }[];
  response?: {
    onFulfilled?: (response: any) => any | Promise<any>;
    onRejected?: (error: any) => any;
  }[];
}

/**
 * Axios adapter configuration
 */
export interface AxiosAdapterConfig extends CreateAxiosDefaults {
  interceptors?: AxiosInterceptors;
}

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
    this.setupInterceptors();
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

  /**
   * Setup interceptors
   */
  private async setupInterceptors() {
    if (!this.config.interceptors) {
      return;
    }

    // Import axios directly to avoid circular dependency
    try {
      const axiosModule = await import('axios');
      const axios = axiosModule.default || axiosModule;
      const instance = axios.create();

      // Setup request interceptors
      if (this.config.interceptors?.request) {
        for (const interceptor of this.config.interceptors.request) {
          instance.interceptors.request.use(interceptor.onFulfilled, interceptor.onRejected);
        }
      }

      // Setup response interceptors
      if (this.config.interceptors.response) {
        for (const interceptor of this.config.interceptors.response) {
          instance.interceptors.response.use(interceptor.onFulfilled, interceptor.onRejected);
        }
      }

      // Use the instance with configured interceptors
      this.axios = instance;
    } catch (_error) {
      throw new Error('axios is not installed. Please install it with: npm install axios');
    }
  }

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
