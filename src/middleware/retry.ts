import { isAxiosError } from 'axios';
import type { HttpMethod, Middleware, RequestContext } from '../types';
import { canceledBy, HttpError, NetworkError, TimeoutError } from '../errors';

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
  return (
    IDEMPOTENT_METHODS.has(request.method.toLowerCase() as HttpMethod) && isTransientError(error)
  );
}

/**
 * Whether a zodsei error is worth retrying: 5xx/408/429, timeouts and axios transport failures.
 * Validation errors, other 4xx, cancellations and errors from your own code are not.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  // Errors thrown by interceptors or user code are wrapped as NetworkError too, but only
  // transport failures from axios itself are worth repeating.
  return error instanceof NetworkError && isAxiosError(error.originalError);
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
function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(canceledBy(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(canceledBy(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
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
        await delay(calculateDelay(attempt, baseDelay, backoff), request.signal);
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
