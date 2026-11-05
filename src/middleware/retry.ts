import { isAxiosError, isCancel } from 'axios';
import type { HttpMethod, Middleware, RequestContext } from '../types';
import { HttpError, NetworkError, TimeoutError } from '../errors';

/**
 * Retry middleware configuration
 */
export interface RetryConfig {
  retries: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
  /** Replaces the default policy entirely, including the idempotent-method check. */
  retryCondition?: (error: Error, request: RequestContext) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

const IDEMPOTENT_METHODS: ReadonlySet<HttpMethod> = new Set([
  'get',
  'head',
  'options',
  'put',
  'delete',
]);

function defaultRetryCondition(error: Error, request: RequestContext): boolean {
  if (!IDEMPOTENT_METHODS.has(request.method.toLowerCase() as HttpMethod)) {
    return false;
  }
  if (error instanceof HttpError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  // Errors thrown by interceptors or user code are wrapped as NetworkError too, but only
  // transport failures from axios itself are worth repeating.
  return (
    error instanceof NetworkError &&
    isAxiosError(error.originalError) &&
    !isCancel(error.originalError)
  );
}

// Calculate delay time
function calculateDelay(
  attempt: number,
  baseDelay: number,
  backoff: 'linear' | 'exponential'
): number {
  switch (backoff) {
    case 'exponential':
      return baseDelay * Math.pow(2, attempt);
    case 'linear':
    default:
      return baseDelay * (attempt + 1);
  }
}

// Delay function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create retry middleware
 */
export function retryMiddleware(config: RetryConfig): Middleware {
  const {
    delay: baseDelay,
    backoff = 'exponential',
    retryCondition = defaultRetryCondition,
    onRetry,
  } = config;
  // NaN would never satisfy `attempt >= retries` and retry forever.
  const retries = Math.max(0, Math.trunc(config.retries) || 0);

  return async (request, next) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await next(request);
      } catch (caught) {
        const error = caught as Error;
        if (attempt >= retries || !retryCondition(error, request)) {
          throw error;
        }

        onRetry?.(attempt + 1, error);
        await delay(calculateDelay(attempt, baseDelay, backoff));
      }
    }
  };
}

/**
 * Create simple retry middleware
 * @deprecated Use retryMiddleware for explicit retry behavior.
 */
export function simpleRetry(retries: number, delay: number = 1000): Middleware {
  return retryMiddleware({
    retries,
    delay,
    backoff: 'exponential',
  });
}
