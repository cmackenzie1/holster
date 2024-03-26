import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
// Could import any other source file/function here
import worker, { ResponseBody } from '../src';

describe('Echo worker', () => {
  it('get responds with 200 OK', async () => {
    const request = new Request('http://example.com?pretty=true');
    // Create an empty context to pass to `worker.fetch()`
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as ResponseBody;
    expect(responseBody).toBeDefined();
    expect(responseBody.headers).toBeDefined();
    expect(responseBody.body).toBeDefined();
    expect(responseBody.body).toBeNull();
    expect(responseBody.url).toBe('http://example.com?pretty=true');
    expect(responseBody.method).toBe('GET');
    expect(responseBody.query).toEqual({ pretty: 'true' });
  });

  it('post responds with 200 OK and body', async () => {
    const request = new Request('http://example.com', { method: 'POST', body: JSON.stringify({ hello: 'world' }) });
    // Create an empty context to pass to `worker.fetch()`
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as ResponseBody;
    expect(responseBody).toBeDefined();
    expect(responseBody.headers).toBeDefined();
    expect(responseBody.body).toBeDefined();
    expect(responseBody.body).toStrictEqual({ hello: 'world' });
    expect(responseBody.url).toBe('http://example.com');
    expect(responseBody.method).toBe('POST');
  });
});
