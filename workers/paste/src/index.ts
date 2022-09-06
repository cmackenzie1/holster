import { Router, Request as IttyRequest } from 'itty-router';
import baseX from 'base-x';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62 = baseX(BASE62);
const newId = (): string => base62.encode(crypto.getRandomValues(new Uint8Array(6)));

const ALLOWED_CONTENT_TYPES = new Set(['application/json', 'text/plain', 'text/csv']);
const TTL = 7 * 24 * 60 * 60; // 7 days

export interface Env {
  PASTES: KVNamespace;
}

interface Metadata {
  'content-type'?: string | null;
  'content-length'?: string | null;
  'paste-id'?: string | null;
  'paste-create-time'?: string | null;
  'paste-expire-time'?: string | null;
  'paste-create-ip'?: string | null;
}

const router = Router();

router.post('/p', async (request: Request, env: Env) => {
  const url = new URL(request.url);
  let id = newId();
  while ((await env.PASTES.get(id)) !== null) {
    id = newId();
  }

  const contentType = request.headers.get('content-type') || 'text/plain';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return new Response('Unsupported content type!', { status: 400 });
  }

  const contentLength = request.headers.get('content-length');
  if (!contentLength || parseInt(contentLength, 10) > 25 * 1e6) {
    return new Response('Entity too large!', { status: 413 });
  }

  const created = new Date(Date.now());
  const expiration = new Date(Date.now() + TTL);
  const metadata: Metadata = {
    'content-type': contentType || 'text/plain',
    'content-length': contentLength,
    'paste-id': id,
    'paste-create-time': `${created.toISOString()}`,
    'paste-expire-time': `${expiration.toISOString()}`,
    'paste-create-ip': request.headers.get('cf-connecting-ip') || '',
  };

  await env.PASTES.put(id, await request.arrayBuffer(), {
    metadata,
    expiration: Math.floor(Date.parse(expiration.toISOString()) / 1000), // unix epoch (seconds)
  });

  url.pathname = url.pathname + `/${id}/raw`;
  return new Response(null, { status: 303, headers: { location: url.toString() } });
});

router.get('/p/:id/raw', async (request: Request, env: Env) => {
  const { params } = request as IttyRequest;
  const { value, metadata } = await env.PASTES.getWithMetadata<Metadata>(params!.id);
  if (!value) return new Response('Not found.\n', { status: 404 });
  return new Response(value, {
    headers: {
      'content-type': metadata?.['content-type'] || 'text/plain',
      'content-disposition': 'inline',
      ...(metadata?.['paste-id'] && { 'paste-id': metadata?.['paste-id'] }),
    },
  });
});

router.get('/p/:id/metadata', async (request: Request, env: Env) => {
  const { params } = request as IttyRequest;
  const { value, metadata } = await env.PASTES.getWithMetadata<Metadata>(params!.id);
  if (!value) return new Response('Not found.\n', { status: 404 });
  metadata?.['paste-create-ip'] && delete metadata?.['paste-create-ip'];
  return new Response(JSON.stringify(metadata), {
    headers: { 'content-type': 'application/json' },
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env);
  },
};
