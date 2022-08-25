export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { url, method } = request;
    const headers: Record<string, string> = {};
    [...request.headers.entries()].forEach(([k, v]) => {
      headers[k] = v;
    });
    return new Response(
      JSON.stringify({
        headers,
        url,
        method,
      }) + '\n',
      { headers: { 'content-type': 'appliction/json' } },
    );
  },
};
