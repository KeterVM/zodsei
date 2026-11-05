import type { RequestContext, ResponseContext } from '../types';
import { CanceledError, HttpError, NetworkError, TimeoutError } from '../errors';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { AxiosError, isAxiosError, isCancel } from 'axios';

function toZodseiError(error: unknown): Error {
  if (isCancel(error)) {
    return new CanceledError(error as Error);
  }
  if (!isAxiosError(error)) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NetworkError(
      `Axios request failed: ${message}`,
      error instanceof Error ? error : Object.assign(new Error(message), { cause: error })
    );
  }
  if (error.code === AxiosError.ETIMEDOUT) {
    return new TimeoutError(error.config?.timeout ?? 0);
  }
  if (error.response) {
    return new HttpError(
      `HTTP ${error.response.status}: ${error.response.statusText}`,
      error.response.status,
      error.response.statusText,
      error.response.data
    );
  }
  const prefix = error.request ? 'Network request failed' : 'Axios request failed';
  return new NetworkError(`${prefix}: ${error.message}`, error);
}

/**
 * Axios HTTP adapter
 */
export class AxiosAdapter {
  readonly name = 'axios';
  private axios: AxiosInstance;

  constructor(axiosInstance: AxiosInstance) {
    this.axios = axiosInstance;
  }

  // Interceptors configured on the provided Axios instance run normally.
  // Zodsei does not register or manage them.

  async request(context: RequestContext): Promise<ResponseContext> {
    let response: AxiosResponse;
    try {
      response = await this.axios.request(this.createAxiosConfig(context));
    } catch (error: unknown) {
      throw toZodseiError(error);
    }

    // axios has already applied validateStatus, so any response that resolves was accepted.
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(
        Object.entries(response.headers ?? {}).map(([k, v]) => [
          k,
          typeof v === 'string' ? v : String(v),
        ])
      ),
      data: response.data,
    };
  }

  private createAxiosConfig(context: RequestContext): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      url: context.url,
      method: context.method.toLowerCase() as AxiosRequestConfig['method'],
      headers: context.headers,
      // Without this axios reports timeouts as ECONNABORTED, the same code as a browser abort.
      transitional: { clarifyTimeoutError: true },
    };

    if (context.signal) {
      config.signal = context.signal;
    }
    if (context.timeout !== undefined) {
      config.timeout = context.timeout;
    }

    // Add request body
    if (context.body !== undefined) {
      config.data = context.body;
    }

    // Add query parameters
    if (context.query && Object.keys(context.query).length > 0) {
      config.params = context.query as Record<string, unknown>;
    }

    return config;
  }
}
