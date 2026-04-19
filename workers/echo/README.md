# `echo`

Echo back the request you send. Useful for debugging HTTP clients, webhooks, and request inspection.

## Usage

```sh
# Plain text HTTP format (default for curl)
curl https://echo.mirio.dev/any/path

# JSON output
curl https://echo.mirio.dev/?format=json | jq

# Pretty-printed JSON
curl https://echo.mirio.dev/?format=json&pretty

# POST with JSON body
curl -X POST -d '{"key":"value"}' -H 'Content-Type: application/json' https://echo.mirio.dev/

# POST with form data
curl -X POST -d 'name=alice&age=30' https://echo.mirio.dev/

# Any method works
curl -X PUT https://echo.mirio.dev/
curl -X DELETE https://echo.mirio.dev/
```

## Content Negotiation

- **`text/html`** (browsers): Rendered HTML page showing method, headers, and body
- **`application/json`** or `?format=json`: JSON response with all request details
- **`text/plain`** (default/curl): HTTP-style text format

## Body Handling

| Content-Type | Encoding | Output |
| --- | --- | --- |
| `application/json` | `json` | Parsed JSON object |
| `text/*` | `text` | Raw text string |
| `application/x-www-form-urlencoded` | `form` | Parsed key-value object |
| Everything else | `base64` | Base64-encoded string |
