# Holster

A collection of Cloudflare Workers, managed by Lerna.

## Create a new Worker

```
npx wrangler init packages/<name>
⛅️ wrangler 2.0.27
--------------------
Using npm as package manager.
✨ Created packages/rand/wrangler.toml
No package.json found. Would you like to create one? (y/n)
✨ Created packages/rand/package.json
Would you like to use TypeScript? (y/n)
✨ Created packages/rand/tsconfig.json
Would you like to create a Worker at packages/rand/src/index.ts?
  None
❯ Fetch handler
  Scheduled handler
✨ Created packages/rand/src/index.ts
```

```toml
# wrangler toml
routes = [
	{ pattern = "<name>.mirio.dev", custom_domain = true }
]
```

## `echo`

Echo back the request received

```
curl https://echo.mirio.dev | jq

{
  "headers": {
    "accept": "*/*",
    "accept-encoding": "gzip",
    "cf-connecting-ip": "63.229.18.140",
    "cf-ipcountry": "US",
    "cf-ray": "7401e028faf53089",
    "cf-visitor": "{\"scheme\":\"https\"}",
    "connection": "Keep-Alive",
    "host": "echo.mirio.dev",
    "user-agent": "curl/7.79.1",
    "x-forwarded-proto": "https",
    "x-real-ip": "63.229.18.140"
  },
  "url": "https://echo.mirio.dev/",
  "method": "GET"
}
```

## `ip`

- `/`: returns the clients IP Address
- `/<property>`: returns the value for the requested property.

| property     | description                                                                                                      | example                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `asn`        | ASN of the incoming request.                                                                                     | `209`                    |
| `aso`        | The organization which owns the ASN of the incoming request.                                                     | `CenturyLink`            |
| `city`       | City of the incoming request.                                                                                    | `Seattle`                |
| `colo`       | The three-letter IATA airport code of the Cloudflare data center that the request hit.                           | `SEA`                    |
| `country`    | The two-letter country code of the incoming request.                                                             | `US`                     |
| `latlong`    | The latitude and longitude of the incoming request, separated by a comma.                                        | `47.57410,-122.39750`    |
| `region`     | If known, the ISO 3166-2 name for the first level region associated with the IP address of the incoming request. | `Washington`             |
| `tlsCipher`  | The tls cipher used for the connection to Cloudflare.                                                            | `AEAD-AES128-GCM-SHA256` |
| `tlsVersion` | The tls verson used for the connection to Cloudflare.                                                            | `TLSv1.3 `               |
| `timezone`   | Timezone of the incoming request.                                                                                | `America/Los_Angeles`    |

## `rand`

Get random values!

```
curl https://rand.mirio.dev/uuid
cf17cfa2-32c5-4182-b81b-983b28cb9fa8

curl https://rand.mirio.dev/uuid?n=2
cf17cfa2-32c5-4182-b81b-983b28cb9fa8
4610fb40-1e70-426e-807f-2a036df4be73
```

## `hash`

POST data and get the `sha256`, `md5` or other supported hash back! Data is returned as the hex encoding of the final digest.

{% note %}

**Note:** When using `curl`, be sure to use `--data-binary` to prevent `curl` from transforming the data before sending it.

{% endnote %}

```
curl -XPOST https://hash.mirio.dev/md5 --data-binary @data.bin
c27830b0f2af9af174da9b25e56be6ff

curl -XPOST https://hash.mirio.dev/sha256 --data-binary @data.bin
d457d2a4c60670d56b6cf5ed36a362d99041f37cc68b91297eecd06de5870301
```

### Supported algorithms

- `md5`
- `sha1`
- `sha256`
- `sha384`
- `sha512`

## Upcoming / Planned

- `stocks`: GET your favorite symbols current price
- `public`: Static assests, public and cached 😎
- `send`: End-to-End encrypted file sharing. Limit 25MB, 48 hr TTL.
