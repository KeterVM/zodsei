import type { Middleware, RequestContext, ResponseContext } from '../types';

/**
 * Middleware system
 */

// Middleware executor
export class MiddlewareExecutor {
  private readonly middleware: Middleware[];

  // Copied so use() never grows an array the caller still owns or shares between clients.
  constructor(middleware: Middleware[] = []) {
    this.middleware = [...middleware];
  }

  // Execute middleware chain
  async execute(
    request: RequestContext,
    finalHandler: (request: RequestContext) => Promise<ResponseContext>
  ): Promise<ResponseContext> {
    if (this.middleware.length === 0) {
      return finalHandler(request);
    }

    const dispatch = async (index: number, req: RequestContext): Promise<ResponseContext> => {
      if (index >= this.middleware.length) {
        return finalHandler(req);
      }

      const middleware = this.middleware[index];
      return middleware(req, (nextRequest) => dispatch(index + 1, nextRequest));
    };

    return dispatch(0, request);
  }

  // Add middleware
  use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  // Get middleware list
  getMiddleware(): Middleware[] {
    return [...this.middleware];
  }
}

/** @deprecated Middleware execution is managed by createClient. */
export function createMiddlewareExecutor(middleware: Middleware[] = []): MiddlewareExecutor {
  return new MiddlewareExecutor(middleware);
}

/** @deprecated Pass middleware directly through ClientConfig.middleware. */
export function composeMiddleware(...middleware: Middleware[]): Middleware {
  return async (request, next) => {
    const executor = new MiddlewareExecutor(middleware);
    return executor.execute(request, next);
  };
}
