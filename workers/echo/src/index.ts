export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { url, method } = request;
    const headers: Record<string, string> = {};
    [...request.headers.entries()].forEach(([k, v]) => {
      headers[k] = v;
    });
    return Response.json({ headers, url, method });
  },
};
