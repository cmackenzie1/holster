# `rand`

Random value generator. Open in a browser for an HTML view, or use curl/scripts for plain text.

## Usage

```sh
# Get a random UUID v4
curl https://rand.mirio.dev/uuid

# Get a time-sortable UUID v7
curl https://rand.mirio.dev/uuidv7

# Get a ULID
curl https://rand.mirio.dev/ulid

# Get multiple values
curl https://rand.mirio.dev/uuid?n=5

# Get JSON response
curl https://rand.mirio.dev/ulid?format=json

# List available endpoints
curl https://rand.mirio.dev/
```

## Endpoints

| Path | Description | Options |
| --- | --- | --- |
| `/` | List available endpoints | |
| `/uuid` | Random UUID v4 | `?n=`, `?count=`, `?limit=` (max 1000) |
| `/uuidv7` | Time-sortable UUID v7 | `?n=`, `?count=`, `?limit=` (max 1000) |
| `/ulid` | ULID | `?n=`, `?count=`, `?limit=` (max 1000) |

## Content Negotiation

All routes respond based on the `Accept` header:

- **`text/html`** (browsers): Rendered HTML page
- **`application/json`**: JSON response (also available via `?format=json`)
- **`text/plain`** (default/curl): Plain text, one value per line
