export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ip = request.headers.get('cf-connecting-ip') || '';
    return new Response(`${ip}\n`, {
      headers: {
        'content-type': 'text/plain',
      },
    });
  },
};
