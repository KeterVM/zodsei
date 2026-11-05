import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { createApp, effectScope, isReactive, reactive, ref, type EffectScope } from 'vue';
import { QueryClient, VueQueryPlugin, skipToken } from '@tanstack/vue-query';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { createClient, isTransientError, ValidationError } from '../src';
import { httpFailure } from './helpers';
import { createVueQueryUtils } from '../src/vue-query';

const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});

const contract = {
  users: {
    get: {
      path: '/users/:id',
      method: 'get',
      request: z.object({ id: z.string() }),
      response: z.object({ id: z.string(), joinedAt: isoDate }),
    },
    list: {
      path: '/users',
      method: 'get',
      request: z.object({ cursor: z.number().optional(), limit: z.number() }),
      response: z.object({ items: z.array(z.string()), next: z.number().nullable() }),
    },
    create: {
      path: '/users',
      method: 'post',
      request: z.object({ name: z.string() }),
      response: z.object({ id: z.string() }),
    },
  },
  health: { path: '/health', method: 'get', response: z.object({ ok: z.boolean() }) },
  events: {
    path: '/events',
    method: 'get',
    request: z.object({ at: isoDate }),
    response: z.object({ ok: z.boolean() }),
  },
} as const;

function respond(config: AxiosRequestConfig) {
  const url = config.url ?? '';
  const data = url.startsWith('/users/')
    ? { id: url.split('/')[2], joinedAt: '2026-01-01T00:00:00.000Z' }
    : url === '/users' && config.method === 'post'
      ? { id: 'new' }
      : url === '/users'
        ? (() => {
            const cursor = (config.params as { cursor?: number }).cursor ?? 0;
            return { items: [`u${cursor}`], next: cursor < 2 ? cursor + 1 : null };
          })()
        : { ok: true };
  return Promise.resolve({ status: 200, statusText: 'OK', headers: {}, data });
}

describe('zodsei/vue-query', () => {
  let axiosMock: AxiosInstance & { request: ReturnType<typeof vi.fn> };
  let queryClient: QueryClient;
  let scope: EffectScope;
  let api: ReturnType<typeof createVueQueryUtils<typeof contract>>;

  const sent = () => axiosMock.request.mock.calls.map(([c]) => c as AxiosRequestConfig);
  const inSetup = <T>(fn: () => T): T => {
    const app = createApp({});
    app.use(VueQueryPlugin, { queryClient });
    return app.runWithContext(() => scope.run(fn)!);
  };

  beforeEach(() => {
    axiosMock = { request: vi.fn(respond), defaults: {} } as unknown as typeof axiosMock;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    scope = effectScope();
    api = createVueQueryUtils(createClient(contract, { axios: axiosMock }));
  });
  afterEach(() => {
    scope.stop();
    queryClient.clear();
  });

  describe('keys', () => {
    it('builds path-scoped keys that partially match for invalidation', async () => {
      expect(api.users.get.queryKey({ id: '1' })).toEqual([
        ['users', 'get'],
        { type: 'query', input: { id: '1' } },
      ]);
      expect(api.users.key()).toEqual([['users']]);

      await queryClient.query(api.users.get.queryOptions({ id: '1' }));
      await queryClient.query(api.users.get.queryOptions({ id: '2' }));
      await queryClient.query(api.health.queryOptions());
      const count = (queryKey: readonly unknown[]) =>
        queryClient.getQueryCache().findAll({ queryKey }).length;

      expect(count(api.users.key())).toBe(2);
      expect(count(api.users.get.key({ input: { id: '1' } }))).toBe(1);
      expect(count(api.health.key())).toBe(1);
      expect(count(['users'])).toBe(0);
    });
  });

  describe('options', () => {
    it('fetches through the client, decodes codecs and passes the query signal', async () => {
      const user = await queryClient.query(api.users.get.queryOptions({ id: '7' }));

      expect(user.joinedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(sent()[0].url).toBe('/users/7');
      expect(sent()[0].signal).toBeInstanceOf(AbortSignal);
      expect(queryClient.getQueryData(api.users.get.queryKey({ id: '7' }))).toBe(user);
    });

    it('turns skipToken into a disabled query', () => {
      const options = api.users.get.queryOptions(skipToken);

      expect(options.queryFn).toBe(skipToken);
      expect(options.queryKey).toEqual([['users', 'get'], { type: 'query' }]);
    });

    it('spreads extra query options', () => {
      const select = (u: { id: string }) => u.id;
      const options = api.users.get.queryOptions({ id: '1' }, { staleTime: 5, select });

      expect(options).toMatchObject({ staleTime: 5, select });
    });

    it('aborts the request when the query is cancelled', async () => {
      axiosMock.request.mockImplementationOnce(
        (config: AxiosRequestConfig) =>
          new Promise((_, reject) =>
            config.signal?.addEventListener?.('abort', () => reject(new Error('aborted')))
          )
      );
      const pending = queryClient.query(api.users.get.queryOptions({ id: 'slow' }));
      await vi.waitFor(() => expect(sent()).toHaveLength(1));

      await queryClient.cancelQueries({ queryKey: api.users.get.key() });

      await expect(pending).rejects.toThrow();
      expect((sent()[0].signal as AbortSignal).aborted).toBe(true);
    });

    it('feeds pageParam into the input for infinite queries', async () => {
      const options = api.users.list.infiniteOptions({
        input: (cursor: number | undefined) => ({ cursor, limit: 1 }),
        initialPageParam: undefined,
        getNextPageParam: (last) => last.next ?? undefined,
      });

      const data = await queryClient.infiniteQuery({ ...options, pages: 3 });

      expect(options.queryKey).toEqual([
        ['users', 'list'],
        { type: 'infinite', input: { cursor: undefined, limit: 1 } },
      ]);
      expect(data.pages.map((p) => p.items[0])).toEqual(['u0', 'u1', 'u2']);
    });

    it('builds mutation options that call the endpoint', async () => {
      const options = api.users.create.mutationOptions();

      expect(options.mutationKey).toEqual([['users', 'create'], { type: 'mutation' }]);
      await expect(options.mutationFn({ name: 'Ann' })).resolves.toEqual({ id: 'new' });
      expect(sent()[0]).toMatchObject({ method: 'post', data: { name: 'Ann' } });
    });

    it('works for endpoints without a request schema', async () => {
      await expect(queryClient.query(api.health.queryOptions())).resolves.toEqual({
        ok: true,
      });
    });
  });

  describe('composables', () => {
    it('useQuery follows a reactive input and skips while it is skipToken', async () => {
      const id = ref<string>();
      const user = inSetup(() =>
        api.users.get.useQuery(() => (id.value ? { id: id.value } : skipToken))
      );
      await new Promise((r) => setTimeout(r, 20));
      expect(axiosMock.request).not.toHaveBeenCalled();

      id.value = '1';
      await vi.waitFor(() => expect(user.data.value?.id).toBe('1'));
      id.value = '2';
      await vi.waitFor(() => expect(user.data.value?.id).toBe('2'));

      expect(sent().map((c) => c.url)).toEqual(['/users/1', '/users/2']);
    });

    it('useQuery applies extra options such as select', async () => {
      const name = inSetup(() =>
        api.users.get.useQuery({ id: '3' }, { select: (u) => `user ${u.id}` })
      );

      await vi.waitFor(() => expect(name.data.value).toBe('user 3'));
    });

    it('useQuery surfaces zodsei errors', async () => {
      const bad = inSetup(() => api.users.get.useQuery({ id: 1 as unknown as string }));

      await vi.waitFor(() => expect(bad.error.value).toBeInstanceOf(ValidationError));
    });

    it('useInfiniteQuery loads further pages', async () => {
      const list = inSetup(() =>
        api.users.list.useInfiniteQuery({
          input: (cursor: number | undefined) => ({ cursor, limit: 1 }),
          initialPageParam: undefined,
          getNextPageParam: (last) => last.next ?? undefined,
        })
      );
      await vi.waitFor(() => expect(list.data.value?.pages).toHaveLength(1));

      await list.fetchNextPage();

      expect(list.data.value?.pages.map((p) => p.items[0])).toEqual(['u0', 'u1']);
    });

    it('useMutation accepts mutation options', async () => {
      const onSuccess = vi.fn();
      const create = inSetup(() => api.users.create.useMutation({ onSuccess }));

      await create.mutateAsync({ name: 'Ann' });

      expect(onSuccess).toHaveBeenCalledWith(
        { id: 'new' },
        { name: 'Ann' },
        undefined,
        expect.anything()
      );
    });
  });

  describe('reactive arguments', () => {
    it('accepts a ref input and refetches an old key with the input it was created for', async () => {
      const params = ref({ id: '1' });
      const user = inSetup(() => api.users.get.useQuery(params));
      await vi.waitFor(() => expect(user.data.value?.id).toBe('1'));

      params.value.id = '2';
      await vi.waitFor(() => expect(user.data.value?.id).toBe('2'));
      await queryClient.refetchQueries({ queryKey: api.users.get.key() });

      const urls = sent().map((c) => c.url);
      expect(urls.slice(0, 2)).toEqual(['/users/1', '/users/2']);
      expect(urls.slice(2)).toHaveLength(2);
      expect(urls.slice(2)).toEqual(expect.arrayContaining(['/users/1', '/users/2']));
      expect(queryClient.getQueryData(api.users.get.queryKey({ id: '1' }))?.id).toBe('1');
    });

    it('encodes a codec value from a reactive input', async () => {
      const at = ref(new Date('2026-03-01T00:00:00.000Z'));
      inSetup(() => api.events.useQuery(() => ({ at: at.value })));

      await vi.waitFor(() => expect(sent()[0]?.params).toEqual({ at: '2026-03-01T00:00:00.000Z' }));
    });

    it('reads extra options from a getter and Vue-style enabled', async () => {
      const on = ref(false);
      inSetup(() => api.users.get.useQuery({ id: '1' }, () => ({ enabled: on.value })));
      inSetup(() => api.users.get.useQuery({ id: '2' }, { enabled: () => on.value }));
      await new Promise((r) => setTimeout(r, 20));
      expect(axiosMock.request).not.toHaveBeenCalled();

      on.value = true;

      await vi.waitFor(() =>
        expect(sent().map((c) => c.url)).toEqual(expect.arrayContaining(['/users/1', '/users/2']))
      );
    });

    it('runs useQuery for endpoints without a request schema', async () => {
      const health = inSetup(() => api.health.useQuery({ staleTime: 1_000 }));

      await vi.waitFor(() => expect(health.data.value).toEqual({ ok: true }));
    });

    it('reads mutation options from a getter', async () => {
      const onSuccess = vi.fn();
      const create = inSetup(() => api.users.create.useMutation(() => ({ onSuccess })));

      await create.mutateAsync({ name: 'Ann' });

      expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('uses an explicitly passed QueryClient instead of the injected one', async () => {
      const own = new QueryClient();
      const ownApi = createVueQueryUtils(createClient(contract, { axios: axiosMock }), own);

      const user = inSetup(() => ownApi.users.get.useQuery({ id: '9' }));
      await vi.waitFor(() => expect(user.data.value?.id).toBe('9'));

      expect(own.getQueryData(ownApi.users.get.queryKey({ id: '9' }))?.id).toBe('9');
      expect(queryClient.getQueryData(api.users.get.queryKey({ id: '9' }))).toBeUndefined();
      own.clear();
    });
  });

  describe('retry policy', () => {
    it('isTransientError lets TanStack retry 5xx but not validation errors', async () => {
      const retryingClient = new QueryClient({
        defaultOptions: {
          queries: { retry: (n, e) => n < 2 && isTransientError(e), retryDelay: 0 },
        },
      });
      axiosMock.request
        .mockRejectedValueOnce(httpFailure(503, 'Service Unavailable'))
        .mockImplementationOnce(respond);

      await expect(
        retryingClient.query(api.users.get.queryOptions({ id: '1' }))
      ).resolves.toMatchObject({ id: '1' });
      expect(axiosMock.request).toHaveBeenCalledTimes(2);

      await expect(
        retryingClient.query(api.users.get.queryOptions({ id: 1 as unknown as string }))
      ).rejects.toBeInstanceOf(ValidationError);
      expect(axiosMock.request).toHaveBeenCalledTimes(2);
      retryingClient.clear();
    });
  });

  describe('as a plain object', () => {
    it('is not mistaken for reactive state and returns undefined for unknown keys', () => {
      expect(isReactive(api)).toBe(false);
      expect((api as unknown as Record<string, unknown>).typo).toBeUndefined();
      expect((api.users as unknown as Record<string, unknown>).typo).toBeUndefined();

      const state = reactive({ api });
      expect(state.api.users.get.queryKey({ id: '1' })).toEqual(
        api.users.get.queryKey({ id: '1' })
      );
    });
  });
});
