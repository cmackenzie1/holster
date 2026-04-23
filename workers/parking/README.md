# `parking`

Minimal domain-parking worker. Returns a simple page stating the requested
domain is parked and points inquiries to `domains@mirio.dev`.

Also serves:

- `GET /robots.txt` → `User-agent: *` / `Disallow: /`
- `GET /favicon.ico` → `204 No Content`
- `GET /llms.txt` → plain-text summary for LLM/agent consumption
- `GET /.well-known/parked` → JSON status payload
- `GET /?format=json` or `Accept: application/json` → JSON status payload

All requests are recorded to the `http_requests` Analytics Engine dataset
(hostname-indexed) via the `@mirio/analytics` Hono middleware.

## Adding a parked domain

Adding a new zone is a three-step process: route it, harden its DNS, deploy.

### 1. Add the zone to Cloudflare

The zone must exist on the Cloudflare account `f5686db3c4f5b3e38b8f15b0561a28a8`
with its nameservers pointed at Cloudflare. Until that's in place, workers
can't attach routes to it.

### 2. Route traffic to this worker

Append to the `routes` array in [`wrangler.toml`](./wrangler.toml):

```toml
routes = [
  { pattern = "example.com/*",     zone_name = "example.com" },
  { pattern = "www.example.com/*", zone_name = "example.com" },
  # add both apex and www — and any other subdomains you want parked
]
```

Patterns are glob-style. To park every subdomain of a zone at once, use a
wildcard:

```toml
{ pattern = "*.example.com/*", zone_name = "example.com" }
```

### 3. Harden the zone's DNS

A parked domain with default DNS can be used to spoof email and for
subdomain takeovers. Before the first deploy, publish these records on the
new zone:

| Name              | Type  | Value                                                        | Purpose                                           |
| ----------------- | ----- | ------------------------------------------------------------ | ------------------------------------------------- |
| `@`               | MX    | `0 .`                                                        | Null MX — RFC 7505, explicitly refuses all mail   |
| `@`               | TXT   | `v=spf1 -all`                                                | SPF hard-fail for any sender claiming this domain |
| `_dmarc`          | TXT   | `v=DMARC1; p=reject; rua=mailto:domains@mirio.dev`           | DMARC reject for all unaligned mail               |
| `*._domainkey`    | TXT   | `v=DKIM1; p=`                                                | Null DKIM — invalidates every selector            |
| `@`               | CAA   | `0 issue ";"`                                                | No CA is authorized to issue certs for this name  |

Once these are in place, the only thing the domain publishes is: "don't send
mail as me, don't issue certs for me, and there's a parked page at /".

If you plan to actually use Cloudflare-issued certs for the worker route,
drop the CAA row or replace it with `0 issue "pki.goog"` / `0 issue "letsencrypt.org"`
as appropriate — Cloudflare uses whichever CA is configured on the zone.

### 4. Deploy

```sh
bun run deploy
```

Or deploy only this worker:

```sh
bun --filter parking deploy
```

## Removing a parked domain

Delete the matching `routes` entries from `wrangler.toml`, remove the DNS
hardening records if the domain is going into real use, and redeploy.

## Content negotiation

| Accept / query              | Response                         |
| --------------------------- | -------------------------------- |
| `application/json` / `?format=json` | JSON status payload      |
| `text/html`                 | Minimal HTML parked page         |
| *(default)*                 | Plain-text parked notice         |

## Agent / LLM endpoints

The JSON payload (from `/?format=json` or `/.well-known/parked`) is:

```json
{
  "status": "parked",
  "domain": "example.com",
  "contact": {
    "email": "domains@mirio.dev",
    "inquiry_email": "domains+example.com@mirio.dev",
    "mailto": "mailto:domains+example.com@mirio.dev?subject=Inquiry%20about%20example.com"
  }
}
```

`/llms.txt` is a plain-text version following the [llmstxt.org](https://llmstxt.org)
convention, listing the status, tagged contact address, and pointers to the
JSON endpoints.

## Analytics

Queries against the `http_requests` dataset can isolate parking traffic by
filtering on `index1` (hostname). Field layout is documented in
[`@mirio/analytics`](../../packages/analytics/README.md).
