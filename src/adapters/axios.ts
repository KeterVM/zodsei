import type { RequestContext, ResponseContext } from '../types';
import { HttpError, NetworkError, TimeoutError } from '../errors';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { isAxiosError } from 'axios';

/**
 * Axios HTTP adapter
 */
export class AxiosAdapter {
  readonly name = 'axios';
  private axios: AxiosInstance;

  constructor(axiosInstance: AxiosInstance) {
    this.axios = axiosInstance;
  }

  // Interceptors are not supported. Use middleware in the client instead.

  async request(context: RequestContext): Promise<ResponseContext> {
    try {
      const axiosConfig = this.createAxiosConfig(context);

      const response = await this.axios.request(axiosConfig);

      const headers: Record<string, string> = (() => {
        const rh = (response.headers ?? {}) as Record<string, unknown>;
        if (!rh) return {};
        try {
          return Object.fromEntries(
            Object.entries(rh).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
          );
        } catch {
          return {};
        }
      })();

      const responseContext: ResponseContext = {
        status: response.status,
        statusText: response.statusText,
        headers,
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
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Handle Axios errors
      if (isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          const to = typeof error.config?.timeout === 'number' ? error.config.timeout : 0;
          throw new TimeoutError(to || 0);
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
          const message = typeof error.message === 'string' ? error.message : 'Request failed';
          throw new NetworkError(`Network request failed: ${message}`, error as Error);
        }

        const message = typeof error.message === 'string' ? error.message : 'Axios error';
        throw new NetworkError(`Axios request failed: ${message}`, error as Error);
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new NetworkError(
        `Axios request failed: ${message}`,
        (error as Error) ?? new Error(String(error))
      );
    }
  }

  private createAxiosConfig(context: RequestContext): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      url: context.url,
      method: context.method.toLowerCase() as AxiosRequestConfig['method'],
      headers: {
        'Content-Type': 'application/json',
        ...context.headers,
      },
    };

    // Add request body
    if (context.body !== undefined && !['GET', 'HEAD'].includes(context.method.toUpperCase())) {
      config.data = context.body;
    }

    // Add query parameters
    if (context.query && Object.keys(context.query).length > 0) {
      config.params = context.query as Record<string, unknown>;
    }

    return config;
  }
}
