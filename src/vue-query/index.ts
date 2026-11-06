import { markRaw, toValue, type MaybeRefOrGetter } from 'vue';
import {
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  type DataTag,
  type InfiniteData,
  type InfiniteQueryObserverOptions,
  type MutationOptions,
  type QueryClient,
  type QueryFunctionContext,
  type QueryObserverOptions,
  type SkipToken,
  type UseInfiniteQueryReturnType,
  type UseMutationReturnType,
  type UseQueryReturnType,
} from '@tanstack/vue-query';
import type { z } from 'zod';
import { contractOf, type ZodseiClient } from '../client';
import type { ZodseiError } from '../errors';
import {
  isEndpointDefinition,
  type Contract,
  type EndpointDefinition,
  type InferRequestType,
  type InferResponseType,
} from '../types';

export type ZodseiQueryKeyType = 'query' | 'infinite' | 'mutation';

/** `[path, { type, input }]`. The path array keeps zodsei keys apart from app keys. */
export type ZodseiQueryKey = readonly [
  path: readonly string[],
  meta?: { type?: ZodseiQueryKeyType; input?: unknown },
];

type Input<E extends EndpointDefinition> = InferRequestType<E>;
type Output<E extends EndpointDefinition> = InferResponseType<E>;
type Variables<E extends EndpointDefinition> = E['request'] extends z.ZodType ? Input<E> : void;
type TaggedKey<E extends EndpointDefinition, TData = Output<E>> = DataTag<
  ZodseiQueryKey,
  TData,
  ZodseiError
>;

export type QueryExtra<E extends EndpointDefinition, TData> = Omit<
  QueryObserverOptions<Output<E>, ZodseiError, TData, Output<E>, ZodseiQueryKey>,
  'queryKey' | 'queryFn' | 'enabled'
> & {
  /** vue-query's form: a value, ref or getter. It calls a getter without the query. */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
};

export type InfiniteExtra<E extends EndpointDefinition, TPageParam> = Omit<
  InfiniteQueryObserverOptions<
    Output<E>,
    ZodseiError,
    InfiniteData<Output<E>, TPageParam>,
    ZodseiQueryKey,
    TPageParam
  >,
  'queryKey' | 'queryFn'
> & {
  /** Builds the request from the page param; called with `initialPageParam` for the key. */
  input: (pageParam: TPageParam) => Input<E>;
};

export type MutationExtra<E extends EndpointDefinition, TOnMutateResult> = Omit<
  MutationOptions<Output<E>, ZodseiError, Variables<E>, TOnMutateResult>,
  'mutationKey' | 'mutationFn'
>;

type QueryArgs<E extends EndpointDefinition, TData> = E['request'] extends z.ZodType
  ? [input: Input<E> | SkipToken, extra?: QueryExtra<E, TData>]
  : [extra?: QueryExtra<E, TData>];

type ReactiveQueryArgs<E extends EndpointDefinition, TData> = E['request'] extends z.ZodType
  ? [input: MaybeRefOrGetter<Input<E> | SkipToken>, extra?: MaybeRefOrGetter<QueryExtra<E, TData>>]
  : [extra?: MaybeRefOrGetter<QueryExtra<E, TData>>];

export interface EndpointQueryUtils<E extends EndpointDefinition> {
  /** Partial key for invalidateQueries, cancelQueries and other filters. */
  key(filter?: { type?: ZodseiQueryKeyType; input?: Partial<Input<E>> }): ZodseiQueryKey;
  /** Exact key of a query, typed for getQueryData and setQueryData. */
  queryKey(...input: E['request'] extends z.ZodType ? [input: Input<E>] : []): TaggedKey<E>;
  queryOptions<TData = Output<E>>(
    ...args: QueryArgs<E, TData>
  ): QueryExtra<E, TData> & {
    queryKey: TaggedKey<E>;
    queryFn: ((context: QueryFunctionContext) => Promise<Output<E>>) | SkipToken;
  };
  infiniteOptions<TPageParam>(options: InfiniteExtra<E, TPageParam>): Omit<
    InfiniteExtra<E, TPageParam>,
    'input'
  > & {
    queryKey: TaggedKey<E, InfiniteData<Output<E>, TPageParam>>;
    queryFn: (context: QueryFunctionContext<ZodseiQueryKey, TPageParam>) => Promise<Output<E>>;
  };
  mutationOptions<TOnMutateResult = unknown>(
    extra?: MutationExtra<E, TOnMutateResult>
  ): MutationExtra<E, TOnMutateResult> & {
    mutationKey: ZodseiQueryKey;
    mutationFn: (variables: Variables<E>) => Promise<Output<E>>;
  };
  /** Must run inside setup(). Inputs may be refs or getters. */
  useQuery<TData = Output<E>>(
    ...args: ReactiveQueryArgs<E, TData>
  ): UseQueryReturnType<TData, ZodseiError>;
  useInfiniteQuery<TPageParam>(
    options: MaybeRefOrGetter<InfiniteExtra<E, TPageParam>>
  ): UseInfiniteQueryReturnType<InfiniteData<Output<E>, TPageParam>, ZodseiError>;
  useMutation<TOnMutateResult = unknown>(
    extra?: MaybeRefOrGetter<MutationExtra<E, TOnMutateResult>>
  ): UseMutationReturnType<Output<E>, ZodseiError, Variables<E>, TOnMutateResult>;
}

export type VueQueryUtils<C extends Contract> = {
  [K in keyof C]: C[K] extends EndpointDefinition
    ? EndpointQueryUtils<C[K]>
    : C[K] extends Contract
      ? VueQueryUtils<C[K]>
      : never;
} & {
  /** Partial key matching every query under this group. */
  key(): ZodseiQueryKey;
};

type Call = (...args: unknown[]) => Promise<unknown>;

function buildKey(path: readonly string[], type?: ZodseiQueryKeyType, input?: unknown) {
  const meta: { type?: ZodseiQueryKeyType; input?: unknown } = {};
  if (type) meta.type = type;
  if (input !== undefined) meta.input = input;
  return (Object.keys(meta).length > 0 ? [path, meta] : [path]) as ZodseiQueryKey;
}

function endpointNode(
  call: Call,
  endpoint: EndpointDefinition,
  path: readonly string[],
  queryClient: QueryClient | undefined
) {
  const hasInput = endpoint.request !== undefined;
  const split = (args: unknown[]) => (hasInput ? [args[0], args[1]] : [undefined, args[0]]);
  const fetch = (input: unknown, signal: AbortSignal) =>
    hasInput ? call(input, { signal }) : call({ signal });

  const queryOptions = (...args: unknown[]) => {
    const [input, extra] = split(args);
    return {
      ...(extra as object | undefined),
      queryKey: buildKey(path, 'query', input === skipToken ? undefined : input),
      // Read the input back from the key: vue-query clones keys, so a ref or reactive input
      // mutated later cannot leak into a refetch of an older key.
      queryFn:
        input === skipToken
          ? skipToken
          : ({ queryKey, signal }: QueryFunctionContext<ZodseiQueryKey>) =>
              fetch(queryKey[1]?.input, signal),
    };
  };
  const infiniteOptions = ({ input, ...rest }: InfiniteExtra<EndpointDefinition, unknown>) => ({
    ...rest,
    queryKey: buildKey(path, 'infinite', input(rest.initialPageParam)),
    queryFn: ({ pageParam, signal }: QueryFunctionContext<ZodseiQueryKey, unknown>) =>
      fetch(input(pageParam), signal),
  });
  const mutationOptions = (extra?: object) => ({
    ...extra,
    mutationKey: buildKey(path, 'mutation'),
    mutationFn: (variables: unknown) => (hasInput ? call(variables) : call()),
  });

  return markRaw({
    key: (filter?: { type?: ZodseiQueryKeyType; input?: unknown }) =>
      buildKey(path, filter?.type, filter?.input),
    queryKey: (input?: unknown) => buildKey(path, 'query', input),
    queryOptions,
    infiniteOptions,
    mutationOptions,
    // The getters run inside vue-query's own reactive effect, so refs read by toValue are tracked.
    useQuery: (...args: unknown[]) =>
      useQuery(() => queryOptions(...args.map((arg) => toValue(arg))) as never, queryClient),
    useInfiniteQuery: (options: MaybeRefOrGetter<InfiniteExtra<EndpointDefinition, unknown>>) =>
      useInfiniteQuery(() => infiniteOptions(toValue(options)) as never, queryClient),
    useMutation: (extra?: MaybeRefOrGetter<object | undefined>) =>
      useMutation(() => mutationOptions(toValue(extra)) as never, queryClient),
  });
}

function groupNode(
  clientNode: Record<string, unknown>,
  contract: Contract,
  path: readonly string[],
  queryClient: QueryClient | undefined
): object {
  // Only contract keys resolve to children, so Vue's __v_* probes and typos read undefined.
  return new Proxy(markRaw({ key: () => buildKey(path) }), {
    get(target, prop) {
      if (typeof prop !== 'string' || !Object.prototype.hasOwnProperty.call(contract, prop)) {
        return Reflect.get(target, prop) as unknown;
      }
      const child = contract[prop];
      const childPath = [...path, prop];
      return isEndpointDefinition(child)
        ? endpointNode(clientNode[prop] as Call, child, childPath, queryClient)
        : groupNode(clientNode[prop] as Record<string, unknown>, child, childPath, queryClient);
    },
  });
}

export interface VueQueryUtilsOptions {
  /** Prefix for every key path, so clients sharing a QueryClient never share keys. */
  scope?: readonly string[];
  /** Pass only in the browser; on the server let the composables inject it. */
  queryClient?: QueryClient;
}

/** TanStack Vue Query helpers for every endpoint of a zodsei client. */
export function createVueQueryUtils<C extends Contract>(
  client: ZodseiClient<C>,
  options?: VueQueryUtilsOptions
): VueQueryUtils<C>;
/** @deprecated Pass `{ queryClient }` instead. */
export function createVueQueryUtils<C extends Contract>(
  client: ZodseiClient<C>,
  queryClient: QueryClient
): VueQueryUtils<C>;
export function createVueQueryUtils<C extends Contract>(
  client: ZodseiClient<C>,
  options?: VueQueryUtilsOptions | QueryClient
): VueQueryUtils<C> {
  const { scope = [], queryClient }: VueQueryUtilsOptions =
    options && 'getQueryCache' in options ? { queryClient: options } : (options ?? {});
  return groupNode(
    client as unknown as Record<string, unknown>,
    contractOf(client),
    [...scope],
    queryClient
  ) as VueQueryUtils<C>;
}
