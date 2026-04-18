# `ip`

Get information about your IP address. Open in a browser for a self-documenting HTML view, or use curl/scripts for plain text.

## Usage

```sh
# Get your IP
curl https://ip.mirio.dev

# Get a specific property
curl https://ip.mirio.dev/city

# Get all properties as key=value pairs (shell-friendly)
curl https://ip.mirio.dev?format=text

# Get JSON response
curl https://ip.mirio.dev?format=json
curl https://ip.mirio.dev/json

# Get a single property as JSON
curl -H 'Accept: application/json' https://ip.mirio.dev/city

# Force IPv4 or IPv6
curl -4 https://ip.mirio.dev
curl -6 https://ip.mirio.dev
```

## Endpoints

| Path | Description |
| --- | --- |
| `/` | Client IP address |
| `/<property>` | Value of a specific property |
| `/json` | IP and all Cloudflare request metadata as JSON |
| `/help` | Plain text usage information |

## Properties

| Property | Description | Example |
| --- | --- | --- |
| `asn` | ASN of the incoming request | `209` |
| `aso` | Organization which owns the ASN | `CenturyLink` |
| `city` | City of the incoming request | `Seattle` |
| `colo` | IATA airport code of the Cloudflare data center | `SEA` |
| `country` | Two-letter country code | `US` |
| `latlong` | Latitude and longitude (CSV) | `47.57410,-122.39750` |
| `region` | ISO 3166-2 region name | `Washington` |
| `tlsCipher` | TLS cipher used for the connection | `AEAD-AES128-GCM-SHA256` |
| `tlsVersion` | TLS version used for the connection | `TLSv1.3` |
| `timezone` | Timezone of the incoming request | `America/Los_Angeles` |

## Content Negotiation

All routes respond based on the `Accept` header:

- **`text/html`** (browsers): Rendered HTML page with navigation between properties
- **`application/json`**: JSON response (also available via `?format=json`)
- **`text/plain`** (default/curl): Plain text value

The root endpoint also supports `?format=text` for key=value output suitable for `eval` or `grep`.
