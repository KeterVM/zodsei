import { Middleware, RequestContext, ResponseContext } from '../types';

/**
 * Middleware system
 */

// Middleware executor
export class MiddlewareExecutor {
  constructor(private middleware: Middleware[] = []) {}

  // Execute middleware chain
  async execute(
    request: RequestContext,
    finalHandler: (request: RequestContext) => Promise<ResponseContext>
  ): Promise<ResponseContext> {
    if (this.middleware.length === 0) {
      return finalHandler(request);
    }

    let index = 0;

    const next = async (req: RequestContext): Promise<ResponseContext> => {
      if (index >= this.middleware.length) {
        return finalHandler(req);
      }

      const middleware = this.middleware[index++];
      return middleware(req, next);
    };

    return next(request);
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

// Create middleware executor
export function createMiddlewareExecutor(middleware: Middleware[] = []): MiddlewareExecutor {
  return new MiddlewareExecutor(middleware);
}

// Compose multiple middleware
export function composeMiddleware(...middleware: Middleware[]): Middleware {
  return async (request, next) => {
    const executor = new MiddlewareExecutor(middleware);
    return executor.execute(request, next);
  };
}
