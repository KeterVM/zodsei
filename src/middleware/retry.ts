import { Middleware } from '../types';
import { HttpError } from '../errors';

/**
 * Retry middleware configuration
 */
export interface RetryConfig {
  retries: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

// Default retry condition
function defaultRetryCondition(error: Error): boolean {
  if (error instanceof HttpError) {
    // Retry server errors and some client errors
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  // Retry network errors
  return true;
}

// Calculate delay time
function calculateDelay(attempt: number, baseDelay: number, backoff: 'linear' | 'exponential'): number {
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
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create retry middleware
 */
export function retryMiddleware(config: RetryConfig): Middleware {
  const {
    retries,
    delay: baseDelay,
    backoff = 'exponential',
    retryCondition = defaultRetryCondition,
    onRetry
  } = config;

  return async (request, next) => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await next(request);
      } catch (error) {
        lastError = error as Error;
        
        // If it's the last attempt, throw error directly
        if (attempt === retries) {
          throw lastError;
        }
        
        // Check if should retry
        if (!retryCondition(lastError)) {
          throw lastError;
        }
        
        // Call retry callback
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        // Calculate delay and wait
        const delayTime = calculateDelay(attempt, baseDelay, backoff);
        await delay(delayTime);
      }
    }
    
    throw lastError!;
  };
}

/**
 * Create simple retry middleware
 */
export function simpleRetry(retries: number, delay: number = 1000): Middleware {
  return retryMiddleware({
    retries,
    delay,
    backoff: 'exponential'
  });
}
