---
title: 'Echo: httpbin on Cloudflare Workers'
date: 2022-09-13T20:04:03-07:00
slug: 'echo-httpbin-on-workers'
draft: false
---

As a developer you may have come across the site [httpbin.org](https://httpbin.org). The purpose of the website is to
provide a simple request and response service. For example, issuing a simple HTTP GET request "echos" back the request
as the response, using JSON as the format.

```bash
curl https://httpbin.org/get
{
  "args": {},
  "headers": {
    "Accept": "*/*",
    "Host": "httpbin.org",
    "User-Agent": "curl/7.79.1",
  },
  "origin": "127.0.0.1",
  "url": "https://httpbin.org/get"
}
```

You can often find usages of `httpbin` in the wild, and given it is a really simple app it is a great candidate for
being
built on Workers.

The API for our implementation on Workers will very much like the example above.
Given a request, the Worker will echo back the contents of the request in JSON format. The name of the project will
be `echo`.

`wrangler.toml`

```toml
name = "echo"
main = "src/index.ts"
compatibility_date = "2022-09-13"

routes = [
    { pattern = "echo.mirio.dev", custom_domain = true }
]
```

`src/index.ts`

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { url, method } = request;
    const headers = Object.fromEntries(request.headers);
    return Response.json({ headers, url, method });
  },
};
```

Deploy it using `wrangler publish`, and give it a try!

```bash
curl -s https://echo.mirio.dev | jq
{
  "headers": {
    "accept": "*/*",
    "accept-encoding": "gzip",
    "cf-connecting-ip": "[redacted]",
    "cf-ipcountry": "US",
    "cf-ray": "74a607da58e20889",
    "cf-visitor": "{\"scheme\":\"https\"}",
    "connection": "Keep-Alive",
    "host": "echo.mirio.dev",
    "user-agent": "curl/7.79.1",
    "x-forwarded-proto": "https",
    "x-real-ip": "[redacted]"
  },
  "url": "https://echo.mirio.dev/",
  "method": "GET"
}
```

That all it is. You now have yourself your very own `httbin` that supports all the HTTP verbs and deployed in over
200 cities around the globe. 🤯

You can browse the code and wrangler config in
the [`holster`](https://github.com/cmackenzie1/holster/tree/main/workers/echo) repo on GitHub.
