export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { url, method } = request;
    const headers = Object.fromEntries(request.headers);
    return Response.json({ headers, url, method });
  },
};
