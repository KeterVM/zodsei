import { computed, ref } from 'vue';
import { QueryClient, skipToken } from '@tanstack/vue-query';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { createClient, type ZodseiError } from '../../src';
import { createVueQueryUtils } from '../../src/vue-query';

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
      response: z.object({ id: z.string(), name: z.string(), joinedAt: isoDate }),
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
} as const;

const api = createVueQueryUtils(createClient(contract, { axios: {} as AxiosInstance }));
const queryClient = new QueryClient();

export function composables(props: { id?: string }) {
  const user = api.users.get.useQuery(() => (props.id ? { id: props.id } : skipToken));
  const joinedAt: Date | undefined = user.data.value?.joinedAt;
  const error: ZodseiError | null = user.error.value;

  const id = ref('1');
  api.users.get.useQuery(computed(() => ({ id: id.value })));
  api.users.get.useQuery({ id: '1' }, { staleTime: 5_000, enabled: () => !!id.value });
  api.users.get.useQuery({ id: '1' }, { enabled: computed(() => !!id.value) });
  api.users.get.useQuery({ id: '1' }, { enabled: ref(true) });
  // @ts-expect-error vue-query calls enabled() without the query
  api.users.get.useQuery({ id: '1' }, { enabled: (query) => query.state.dataUpdateCount < 5 });

  const name = api.users.get.useQuery({ id: '1' }, { select: (u) => u.name });
  const nameValue: string | undefined = name.data.value;
  // @ts-expect-error select narrows data to string
  const wrongName: number | undefined = name.data.value;

  const health = api.health.useQuery();
  const ok: boolean | undefined = health.data.value?.ok;
  // @ts-expect-error health has no request schema
  api.health.useQuery({ id: '1' });
  // @ts-expect-error users.get requires its input
  api.users.get.useQuery();
  // @ts-expect-error the input is the app-side type
  api.users.get.useQuery({ id: 1 });

  const list = api.users.list.useInfiniteQuery({
    input: (cursor: number | undefined) => ({ cursor, limit: 20 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const firstItem: string | undefined = list.data.value?.pages[0]?.items[0];

  const pageSize = ref(20);
  const reactiveList = api.users.list.useInfiniteQuery(() => {
    const limit = pageSize.value;
    return {
      input: (cursor: number | undefined) => ({ cursor, limit }),
      initialPageParam: undefined,
      getNextPageParam: (last) => last.next ?? undefined,
    };
  });
  const pageCount: number | undefined = reactiveList.data.value?.pages.length;

  const create = api.users.create.useMutation({
    onSuccess: (data, variables) => {
      const createdId: string = data.id;
      const sentName: string = variables.name;
      return queryClient
        .invalidateQueries({ queryKey: api.users.key() })
        .then(() => [createdId, sentName]);
    },
  });
  create.mutate({ name: 'Ann' });
  // @ts-expect-error wrong mutation variables
  create.mutate({ nope: 1 });

  return { joinedAt, error, nameValue, wrongName, ok, firstItem, pageCount };
}

export async function outsideComponents() {
  await queryClient.query(api.users.get.queryOptions({ id: '1' }));
  const cached = queryClient.getQueryData(api.users.get.queryKey({ id: '1' }));
  const cachedDate: Date | undefined = cached?.joinedAt;
  // @ts-expect-error cached data is typed, not any
  const wrongCached: number | undefined = cached?.name;

  queryClient.setQueryData(api.users.get.queryKey({ id: '1' }), (old) =>
    old ? { ...old, name: 'renamed' } : old
  );
  await queryClient.invalidateQueries({ queryKey: api.users.get.key({ input: { id: '1' } }) });

  const health = await queryClient.query(api.health.queryOptions());
  const healthy: boolean = health.ok;

  // @ts-expect-error unknown endpoint
  api.users.remove.queryKey();

  return { cachedDate, wrongCached, healthy };
}
