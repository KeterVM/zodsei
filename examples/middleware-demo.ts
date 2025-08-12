import { z } from 'zod';
import { createClient, defineContract } from '../src';

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
  const authMiddleware = async (req: any, next: any) => {
    req.headers = req.headers || {};
    req.headers.Authorization = 'Bearer demo-token';
    req.headers['X-Client'] = 'Zodsei';
    return next(req);
  };

  // 2) Timing + logging middleware
  const timingMiddleware = async (req: any, next: any) => {
    const start = Date.now();
    const res = await next(req);
    const duration = Date.now() - start;
    console.log(`⏱️  Request ${req.method} ${req.url} took ${duration}ms`);
    return res;
  };

  // 3) Error handling middleware
  const errorMiddleware = async (req: any, next: any) => {
    try {
      return await next(req);
    } catch (err: any) {
      console.error('❌ Request error:', err?.message || err);
      throw err;
    }
  };

  const client = createClient(contract, {
    baseUrl: 'https://jsonplaceholder.typicode.com',
    middleware: [authMiddleware, timingMiddleware, errorMiddleware],
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
