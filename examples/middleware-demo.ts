import { z } from 'zod';
import { createClient, defineContract, type Middleware } from '../src';
import { HttpError } from '../src';
import axios from 'axios';

// Simple API contract
const contract = defineContract({
  getUser: {
    path: '/users/:id',
    method: 'get' as const,
    request: z.object({
      id: z.string(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
});

// Demonstrate middleware functionality
async function demonstrateMiddleware() {
  console.log('🚀 Middleware Demo\n');

  // 1) Auth middleware
  const authMiddleware: Middleware = async (req, next) => {
    req.headers = req.headers || {};
    req.headers.Authorization = 'Bearer demo-token';
    req.headers['X-Client'] = 'Zodsei';
    return next(req);
  };

  // 2) Timing + logging middleware
  const timingMiddleware: Middleware = async (req, next) => {
    const start = Date.now();
    const res = await next(req);
    const duration = Date.now() - start;
    console.log(`⏱️  Request ${req.method} ${req.url} took ${duration}ms`);
    return res;
  };

  // 3) Error handling middleware
  const errorMiddleware: Middleware = async (req, next) => {
    try {
      return await next(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('❌ Request error:', message);
      throw err as unknown;
    }
  };

  // 4) Response envelope unwrapping middleware
  // Handles typical server response: { msg?: string, error?: string, data?: T, code?: number }
  // - If `error` present (truthy), throws HttpError with message
  // - Optionally treats non-success `code` as error (configurable)
  // - Otherwise, unwraps to inner `data` so downstream validation uses the actual payload
  interface Envelope<T = unknown> {
    msg?: string;
    error?: string;
    data?: T;
    code?: number;
  }
  function isEnvelope(value: unknown): value is Envelope<unknown> {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return 'data' in v || 'error' in v || 'msg' in v || 'code' in v;
  }

  function responseEnvelopeMiddleware(options?: {
    treatNonSuccessCodeAsError?: boolean;
    successCode?: number;
  }): Middleware {
    const treatNonSuccess = options?.treatNonSuccessCodeAsError ?? true;
    const successCode = options?.successCode ?? 1; // customize to your backend contract
    return async (req, next) => {
      const res = await next(req);
      const payload = res.data;
      if (isEnvelope(payload)) {
        // Error by explicit error field
        if (payload.error && payload.error.length > 0) {
          throw new HttpError(payload.error, res.status, res.statusText, payload);
        }
        // Error by code mismatch (optional)
        if (treatNonSuccess && typeof payload.code === 'number' && payload.code !== successCode) {
          const msg = payload.msg || 'Request failed';
          throw new HttpError(msg, res.status, res.statusText, payload);
        }
        // Unwrap inner data when present
        if ('data' in payload) {
          res.data = payload.data as unknown;
        }
      }
      return res;
    };
  }
  const axiosInstance = axios.create({ baseURL: 'https://jsonplaceholder.typicode.com' });
  const client = createClient(contract, {
    axios: axiosInstance,
    middleware: [
      authMiddleware,
      timingMiddleware,
      // Unwrap typical response envelope; adjust successCode to match your backend
      responseEnvelopeMiddleware({ treatNonSuccessCodeAsError: true, successCode: 1 }),
      errorMiddleware,
    ],
  });

  try {
    console.log('  🔄 Sending request...');
    const user = await client.getUser({ id: '1' });
    console.log('  ✅ User data:', user);
  } catch (error) {
    console.log('  ⚠️  Request failed (this may be normal in demo environments)');
  }

  console.log('\n🎉 Middleware demo completed!');
}

export { demonstrateMiddleware };

if (require.main === module) {
  demonstrateMiddleware().catch(console.error);
}
