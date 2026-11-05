import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createClient, ValidationError } from '../src';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

function createAxiosMock() {
  return {
    request: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: {} }),
    defaults: {},
  } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
}

const sentConfig = (mock: ReturnType<typeof createAxiosMock>): AxiosRequestConfig =>
  mock.request.mock.calls[0][0] as AxiosRequestConfig;

const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});

const numericString = z.codec(z.string().regex(/^\d+$/), z.number(), {
  decode: (s) => Number(s),
  encode: (n) => String(n),
});

describe('Request building', () => {
  let axiosMock: ReturnType<typeof createAxiosMock>;
  beforeEach(() => {
    axiosMock = createAxiosMock();
  });

  describe('bodies', () => {
    it('sends FormData unchanged and lets axios pick the Content-Type', async () => {
      const client = createClient(
        { upload: { path: '/upload', method: 'post', request: z.instanceof(FormData) } },
        { axios: axiosMock }
      );
      const form = new FormData();
      form.append('file', 'content');

      await client.upload(form);

      const config = sentConfig(axiosMock);
      expect(config.data).toBe(form);
      expect(config.headers?.['Content-Type']).toBeUndefined();
    });

    it('sends binary data unchanged', async () => {
      const client = createClient(
        { put: { path: '/blob', method: 'put', request: z.instanceof(Uint8Array) } },
        { axios: axiosMock }
      );
      const bytes = new Uint8Array([7, 8]);

      await client.put(bytes);

      expect(sentConfig(axiosMock).data).toBe(bytes);
    });

    it('still sends plain objects as JSON', async () => {
      const client = createClient(
        { create: { path: '/users', method: 'post', request: z.object({ name: z.string() }) } },
        { axios: axiosMock }
      );

      await client.create({ name: 'Ann' });

      const config = sentConfig(axiosMock);
      expect(config.data).toEqual({ name: 'Ann' });
      expect(config.headers?.['Content-Type']).toBe('application/json');
    });

    it('sends no Content-Type on requests without a body', async () => {
      const client = createClient(
        { list: { path: '/users', method: 'get', request: z.object({ q: z.string() }) } },
        { axios: axiosMock }
      );

      await client.list({ q: 'x' });

      const config = sentConfig(axiosMock);
      expect(config.params).toEqual({ q: 'x' });
      expect(config.headers?.['Content-Type']).toBeUndefined();
    });
  });

  describe('path params', () => {
    it('substitutes params whose names share a prefix', async () => {
      const client = createClient(
        {
          get: {
            path: '/a/:idx/:id',
            method: 'get',
            request: z.object({ id: z.string(), idx: z.string() }),
          },
        },
        { axios: axiosMock }
      );

      await client.get({ id: '1', idx: '2' });

      expect(sentConfig(axiosMock).url).toBe('/a/2/1');
    });

    it('ends a param name at a non-identifier character', async () => {
      const client = createClient(
        {
          file: {
            path: '/files/:name.json',
            method: 'get',
            request: z.object({ name: z.string() }),
          },
        },
        { axios: axiosMock }
      );

      await client.file({ name: 'report' });

      const config = sentConfig(axiosMock);
      expect(config.url).toBe('/files/report.json');
      expect(config.params).toBeUndefined();
    });

    it('keeps a colon after an identifier literal (custom methods)', async () => {
      const client = createClient(
        {
          batch: { path: '/users:batchGet', method: 'get', request: z.object({ ids: z.string() }) },
          cancel: {
            path: '/ops/:name:cancel',
            method: 'post',
            request: z.object({ name: z.string() }),
          },
        },
        { axios: axiosMock }
      );

      await client.batch({ ids: 'a' });
      await client.cancel({ name: 'op1' });

      const [first, second] = axiosMock.request.mock.calls.map(
        ([config]) => config as AxiosRequestConfig
      );
      expect(first.url).toBe('/users:batchGet');
      expect(first.params).toEqual({ ids: 'a' });
      expect(second.url).toBe('/ops/op1:cancel');
    });

    it('still splits class instances into path and query fields', async () => {
      class Query {
        constructor(
          public id: string,
          public q: string
        ) {}
      }
      const client = createClient(
        { search: { path: '/users/:id/search', method: 'get', request: z.instanceof(Query) } },
        { axios: axiosMock }
      );

      await client.search(new Query('1', 'x'));

      const config = sentConfig(axiosMock);
      expect(config.url).toBe('/users/1/search');
      expect(config.params).toEqual({ q: 'x' });
    });

    it.each(['..', '.', ''])('rejects %j as a whole path segment', async (id) => {
      const client = createClient(
        {
          get: { path: '/users/:id/profile', method: 'get', request: z.object({ id: z.string() }) },
        },
        { axios: axiosMock }
      );

      await expect(client.get({ id })).rejects.toBeInstanceOf(ValidationError);
      expect(axiosMock.request).not.toHaveBeenCalled();
    });

    it('allows dots inside a segment', async () => {
      const client = createClient(
        { get: { path: '/files/:name', method: 'get', request: z.object({ name: z.string() }) } },
        { axios: axiosMock }
      );

      await client.get({ name: '..hidden' });

      expect(sentConfig(axiosMock).url).toBe('/files/..hidden');
    });

    it('rejects a missing path param instead of sending "undefined"', async () => {
      const client = createClient(
        {
          get: {
            path: '/users/:id',
            method: 'get',
            request: z.object({ id: z.string().optional() }),
          },
        },
        { axios: axiosMock }
      );

      await expect(client.get({})).rejects.toBeInstanceOf(ValidationError);
      expect(axiosMock.request).not.toHaveBeenCalled();
    });

    it('rejects an object path param instead of stringifying it', async () => {
      const client = createClient(
        { get: { path: '/days/:day', method: 'get', request: z.object({ day: z.date() }) } },
        { axios: axiosMock }
      );

      await expect(client.get({ day: new Date() })).rejects.toBeInstanceOf(ValidationError);
      expect(axiosMock.request).not.toHaveBeenCalled();
    });
  });

  describe('codecs', () => {
    const contract = {
      update: {
        path: '/items/:id',
        method: 'post',
        request: z.object({ id: numericString, at: isoDate }),
        response: z.object({ updatedAt: isoDate }),
      },
    } as const;

    it('encodes request values to their wire form', async () => {
      const client = createClient(contract, { axios: axiosMock });
      axiosMock.request.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { updatedAt: '2026-01-02T00:00:00.000Z' },
      });

      const result = await client.update({ id: 42, at: new Date('2026-01-01T00:00:00.000Z') });

      const config = sentConfig(axiosMock);
      expect(config.url).toBe('/items/42');
      expect(config.data).toEqual({ at: '2026-01-01T00:00:00.000Z' });
      expect(result.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    });

    it('rejects a decoded-direction value with a ValidationError', async () => {
      const client = createClient(contract, { axios: axiosMock });

      await expect(
        client.update({ id: '42', at: '2026-01-01T00:00:00.000Z' } as never)
      ).rejects.toBeInstanceOf(ValidationError);
      expect(axiosMock.request).not.toHaveBeenCalled();
    });

    it('surfaces zod’s error for one-way transforms in request schemas', async () => {
      const client = createClient(
        {
          search: {
            path: '/search',
            method: 'get',
            request: z.object({ q: z.string().transform((s) => s.trim()) }),
          },
        },
        { axios: axiosMock }
      );

      await expect(client.search({ q: ' x ' })).rejects.toThrow(/unidirectional transform/);
    });
  });
});
