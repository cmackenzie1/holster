export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { url, method, headers } = request;
    const parsedUrl = new URL(url);

    const body = request.body ? await request.json() : null;
    const result = {
      headers: Object.fromEntries(headers),
      body,
      url,
      method,
      query: Object.fromEntries(parsedUrl.searchParams),
    };
    const responseBody = parsedUrl.searchParams.get('pretty')
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);

    return new Response(responseBody, {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    });
  },
};
