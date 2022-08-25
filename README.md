# Holster

A collection of Cloudflare Workers, managed by Lerna.

## echo

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
