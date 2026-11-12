import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { z } from 'zod';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { createClient, defineContract, NetworkError, ValidationError, ZodseiError } from '../src';

function createAxiosMock() {
  const request = vi
    .fn()
    .mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: 1 });
  return { request, defaults: {} } as unknown as AxiosInstance & { request: typeof request };
}

describe('Contract edge cases', () => {
  let axiosMock: ReturnType<typeof createAxiosMock>;
  beforeEach(() => {
    axiosMock = createAxiosMock();
  });

  it('should treat a group with endpoints named path and method as a group', async () => {
    const contract = defineContract({
      files: {
        path: { path: '/files/path', method: 'get' },
        method: { path: '/files/method', method: 'get' },
      },
    });
    const client = createClient(contract, { axios: axiosMock });

    await client.files.path();
    await client.files.method();

    expect(axiosMock.request.mock.calls.map(([config]) => config.url)).toEqual([
      '/files/path',
      '/files/method',
    ]);
    expect(client.$schema.getNested('files').getEndpointPaths()).toEqual(['path', 'method']);
  });

  it('should resolve only own contract keys', () => {
    const contract = defineContract({ users: { get: { path: '/users', method: 'get' } } });
    const client = createClient(contract, { axios: axiosMock }) as unknown as Record<
      string,
      Record<string, unknown>
    >;

    expect(client.__proto__).toBe(Object.getPrototypeOf(client));
    expect(client.users.__proto__).toBeUndefined();
    expect(client.users.constructor).toBeUndefined();
  });

  it('should reject request data a bodyless method cannot carry', async () => {
    const contract = defineContract({
      list: { path: '/list', method: 'get', request: z.array(z.string()) },
    });
    const client = createClient(contract, { axios: axiosMock });

    await expect(client.list(['a', 'b'])).rejects.toBeInstanceOf(ValidationError);
    expect(axiosMock.request).not.toHaveBeenCalled();
  });

  it('should send a string request as a JSON string', async () => {
    const contract = defineContract({
      rename: { path: '/name', method: 'post', request: z.string() },
    });
    const client = createClient(contract, { axios: axiosMock });

    await client.rename('123');

    const config = axiosMock.request.mock.calls[0][0];
    expect(config.data).toBe('"123"');
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('should send a string request as-is under a caller Content-Type', async () => {
    const contract = defineContract({
      note: { path: '/note', method: 'post', request: z.string() },
    });
    const client = createClient(contract, { axios: axiosMock });

    await client.note('plain', { headers: { 'content-type': 'text/plain' } });

    const config = axiosMock.request.mock.calls[0][0];
    expect(config.data).toBe('plain');
    expect(config.headers).toEqual({ 'content-type': 'text/plain' });
  });

  it('should reject a request schema with a one-way transform as a ZodseiError', async () => {
    const contract = defineContract({
      save: {
        path: '/save',
        method: 'post',
        request: z.object({ n: z.string().transform((value) => Number(value)) }),
      },
    });
    const client = createClient(contract, { axios: axiosMock });

    await expect(client.save({ n: 1 })).rejects.toBeInstanceOf(ZodseiError);
    expect(axiosMock.request).not.toHaveBeenCalled();
  });

  it('should keep request headers out of a serialized NetworkError', async () => {
    const instance = axios.create({
      baseURL: 'https://api.example.com',
      headers: { Authorization: 'Bearer SECRET' },
      adapter: async (config) => {
        throw new AxiosError('boom', AxiosError.ERR_NETWORK, config, {});
      },
    });
    const contract = defineContract({ ping: { path: '/ping', method: 'get' } });
    const client = createClient(contract, { axios: instance });

    const error = await client.ping().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NetworkError);
    expect(JSON.stringify(error)).not.toContain('SECRET');
    expect((error as NetworkError).originalError).toBeInstanceOf(AxiosError);
  });
});
