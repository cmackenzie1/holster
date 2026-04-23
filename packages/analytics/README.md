# `@mirio/analytics`

HTTP analytics helpers for Cloudflare [Workers Analytics Engine].

Two shapes — pick one:

- **`HTTPAnalytics.observe(request)`** — low-level, works in any `fetch`
  handler. Writes request-side fields only (no response status or duration).
- **`httpAnalytics(binding)`** — Hono middleware. Wraps the handler so it can
  also record response status and handler duration.

Both write to the same dataset schema so queries are portable between them.

## Dataset

Bind an Analytics Engine dataset in `wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "HTTP_REQUESTS"
dataset = "http_requests"
```

## Usage

### Plain `fetch` handler

```ts
import { HTTPAnalytics } from "@mirio/analytics";

interface Env { HTTP_REQUESTS?: AnalyticsEngineDataset }

export default {
  fetch(request: Request, env: Env) {
    new HTTPAnalytics(env.HTTP_REQUESTS).observe(request);
    return new Response("ok");
  },
};
```

### Hono

```ts
import { httpAnalytics } from "@mirio/analytics";
import { Hono } from "hono";

interface Env { HTTP_REQUESTS?: AnalyticsEngineDataset }

const app = new Hono<{ Bindings: Env }>();
app.use("*", (c, next) => httpAnalytics(c.env.HTTP_REQUESTS)(c, next));
app.get("/", (c) => c.text("ok"));

export default app;
```

## Schema (`http_requests` dataset)

Analytics Engine stores fields **positionally** as `blob1..blob20` and
`double1..double20`. SQL queries must use these indexes. This table is the
authoritative translation.

### Index

| column  | field    | meaning                                            |
| ------- | -------- | -------------------------------------------------- |
| `index1` | hostname | Request hostname, used as the sampling key         |

### Blobs (strings)

| column   | field             | meaning                                                 |
| -------- | ----------------- | ------------------------------------------------------- |
| `blob1`  | `method`          | HTTP method (`GET`, `POST`, ...)                        |
| `blob2`  | `url`             | Full request URL                                        |
| `blob3`  | `ip`              | Client IP from `cf-connecting-ip` (IPv4 or IPv6)        |
| `blob4`  | `user_agent`      | `user-agent` request header                             |
| `blob5`  | `referer`         | `referer` request header                                |
| `blob6`  | `http_protocol`   | `HTTP/1.1`, `HTTP/2`, `HTTP/3`                          |
| `blob7`  | `country`         | ISO-3166 alpha-2 code (`XX` = unknown, `T1` = Tor)      |
| `blob8`  | `colo`            | Cloudflare data center IATA code (`SJC`, `YYZ`, ...)    |
| `blob9`  | `as_organization` | Client ASN organization name (`Comcast Cable`, ...)     |
| `blob10` | `tls_version`     | TLS version (`TLSv1.2`, `TLSv1.3`, `none` for plain HTTP) |

### Doubles (numbers)

| column    | field         | meaning                                                         |
| --------- | ------------- | --------------------------------------------------------------- |
| `double1` | `status`      | HTTP response status. `0` when response was not captured.       |
| `double2` | `duration_ms` | Handler duration in milliseconds. `0` when not captured.        |
| `double3` | `asn`         | Client autonomous system number                                 |
| `double4` | `latitude`    | Approximate client latitude                                     |
| `double5` | `longitude`   | Approximate client longitude                                    |

Missing strings are written as `""`, missing numerics as `0`. To filter out
`observe()`-captured rows (which have no response data), use `double1 > 0`.

## Example queries

Top parked domains by request count (last 24h):

```sql
SELECT index1 AS hostname, COUNT() AS hits
FROM http_requests
WHERE timestamp > NOW() - INTERVAL '1' DAY
GROUP BY hostname
ORDER BY hits DESC
```

Bot vs browser traffic by ASN org:

```sql
SELECT blob9 AS as_org, COUNT() AS hits
FROM http_requests
WHERE timestamp > NOW() - INTERVAL '1' DAY
GROUP BY as_org
ORDER BY hits DESC
LIMIT 20
```

Error rate (middleware-captured rows only):

```sql
SELECT
  SUM(IF(double1 >= 500, 1, 0)) / COUNT() AS error_rate
FROM http_requests
WHERE double1 > 0
  AND timestamp > NOW() - INTERVAL '1' HOUR
```

[Workers Analytics Engine]: https://developers.cloudflare.com/analytics/analytics-engine/
