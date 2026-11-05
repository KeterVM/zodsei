import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { AxiosError, CanceledError as AxiosCanceledError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { httpFailure } from './helpers';
import {
  createClient,
  cacheMiddleware,
  retryMiddleware,
  CanceledError,
  NetworkError,
  TimeoutError,
  type Middleware,
} from '../src';

function createAxiosMock() {
  return {
    request: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: {} }),
    defaults: {},
  } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
}

const sentConfig = (mock: ReturnType<typeof createAxiosMock>): AxiosRequestConfig =>
  mock.request.mock.calls[0][0] as AxiosRequestConfig;

const contract = {
  getUser: { path: '/users/:id', method: 'get', request: z.object({ id: z.string() }) },
  ping: { path: '/ping', method: 'get' },
} as const;

describe('Transport', () => {
  let axiosMock: ReturnType<typeof createAxiosMock>;
  beforeEach(() => {
    axiosMock = createAxiosMock();
  });

  describe('cancellation', () => {
    it('reports an aborted signal as CanceledError, not NetworkError', async () => {
      const original = new AxiosCanceledError();
      axiosMock.request.mockRejectedValueOnce(original);
      const client = createClient(contract, { axios: axiosMock });

      const error = await client.getUser({ id: '1' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(CanceledError);
      expect(error).not.toBeInstanceOf(NetworkError);
      expect((error as CanceledError).originalError).toBe(original);
    });

    it('is not retried by the default policy', async () => {
      axiosMock.request.mockRejectedValue(new AxiosCanceledError());
      const client = createClient(contract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: 3, delay: 0 })],
      });

      await expect(client.getUser({ id: '1' })).rejects.toBeInstanceOf(CanceledError);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('per-call options', () => {
    it('passes signal, timeout and headers after the request data', async () => {
      const client = createClient(contract, { axios: axiosMock });
      const controller = new AbortController();

      await client.getUser(
        { id: '1' },
        { signal: controller.signal, timeout: 500, headers: { 'X-Trace': 't1' } }
      );

      const config = sentConfig(axiosMock);
      expect(config.signal).toBe(controller.signal);
      expect(config.timeout).toBe(500);
      expect(config.headers).toMatchObject({ 'X-Trace': 't1' });
    });

    it('takes options as the only argument when the endpoint has no request schema', async () => {
      const client = createClient(contract, { axios: axiosMock });
      const controller = new AbortController();

      await client.ping({ signal: controller.signal });

      expect(sentConfig(axiosMock).signal).toBe(controller.signal);
    });

    it('exposes the options to middleware through the request context', async () => {
      const seen: unknown[] = [];
      const spy: Middleware = (request, next) => {
        seen.push({ signal: request.signal, timeout: request.timeout });
        return next(request);
      };
      const client = createClient(contract, { axios: axiosMock, middleware: [spy] });
      const controller = new AbortController();

      await client.getUser({ id: '1' }, { signal: controller.signal, timeout: 50 });

      expect(seen).toEqual([{ signal: controller.signal, timeout: 50 }]);
    });

    it('leaves axios defaults alone when no options are given', async () => {
      const client = createClient(contract, { axios: axiosMock });

      await client.getUser({ id: '1' });

      const config = sentConfig(axiosMock);
      expect('signal' in config).toBe(false);
      expect('timeout' in config).toBe(false);
    });
  });

  describe('timeouts and aborts', () => {
    it('asks axios to report timeouts as ETIMEDOUT', async () => {
      const client = createClient(contract, { axios: axiosMock });

      await client.getUser({ id: '1' });

      expect(sentConfig(axiosMock).transitional).toMatchObject({ clarifyTimeoutError: true });
    });

    it('maps ETIMEDOUT to TimeoutError', async () => {
      axiosMock.request.mockRejectedValueOnce(
        new AxiosError(
          'timeout of 100ms exceeded',
          AxiosError.ETIMEDOUT,
          { timeout: 100 } as never,
          {}
        )
      );
      const client = createClient(contract, { axios: axiosMock });

      await expect(client.getUser({ id: '1' })).rejects.toBeInstanceOf(TimeoutError);
    });

    it('does not report a browser abort (ECONNABORTED) as a timeout', async () => {
      axiosMock.request.mockRejectedValueOnce(
        new AxiosError('Request aborted', AxiosError.ECONNABORTED, {} as never, {})
      );
      const client = createClient(contract, { axios: axiosMock });

      const error = await client.getUser({ id: '1' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NetworkError);
      expect(error).not.toBeInstanceOf(TimeoutError);
    });
  });

  describe('status handling', () => {
    it('accepts any response axios resolved, honouring a custom validateStatus', async () => {
      axiosMock.request.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: { found: false },
      });
      const client = createClient(contract, { axios: axiosMock });

      await expect(client.getUser({ id: '1' })).resolves.toEqual({ found: false });
    });
  });

  describe('interaction with middleware', () => {
    it('keys the cache by per-call headers so users do not share entries', async () => {
      axiosMock.request.mockImplementation((config: AxiosRequestConfig) =>
        Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { auth: (config.headers as Record<string, string>).Authorization },
        })
      );
      const client = createClient(contract, {
        axios: axiosMock,
        middleware: [cacheMiddleware({ ttl: 60_000 })],
      });

      const a = await client.ping({ headers: { Authorization: 'Bearer a' } });
      const b = await client.ping({ headers: { Authorization: 'Bearer b' } });

      expect([a, b]).toEqual([{ auth: 'Bearer a' }, { auth: 'Bearer b' }]);
      expect(axiosMock.request).toHaveBeenCalledTimes(2);
    });

    it('rejects an already-aborted call before middleware, even on a cache hit', async () => {
      const client = createClient(contract, {
        axios: axiosMock,
        middleware: [cacheMiddleware({ ttl: 60_000 })],
      });
      await client.ping();
      const controller = new AbortController();
      controller.abort();

      await expect(client.ping({ signal: controller.signal })).rejects.toBeInstanceOf(
        CanceledError
      );
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });

    it('stops waiting between retries as soon as the call is aborted', async () => {
      axiosMock.request.mockRejectedValue(httpFailure(503, 'Service Unavailable'));
      const onRetry = vi.fn();
      const client = createClient(contract, {
        axios: axiosMock,
        middleware: [retryMiddleware({ retries: 3, delay: 10_000, onRetry })],
      });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 20);
      const started = Date.now();

      await expect(client.ping({ signal: controller.signal })).rejects.toBeInstanceOf(
        CanceledError
      );
      expect(Date.now() - started).toBeLessThan(1_000);
      expect(axiosMock.request).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps a non-Error thrown value as the cause', async () => {
    const thrown = { reason: 'token expired' };
    axiosMock.request.mockRejectedValueOnce(thrown);
    const client = createClient(contract, { axios: axiosMock });

    const error = await client.ping().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).originalError.cause).toBe(thrown);
  });
});
