# Holster

A collection of Cloudflare Workers, managed using NPM Workspaces.

## Apps

| Name                                   | Host                                                  | Description                                                                                                  |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [echo](./workers/echo/README.md)       | [`echo.mirio.dev`](https://echo.mirio.dev)            | Echos back the received HTTP request.                                                                        |
| [hash](./workers/hash/README.md)       | `hash.mirio.dev`                                      | Returns the hex digest of the payload. Supports `md5`, `sha1`, `sha256` `sha384` and `sha512`                |
| [ip](./workers/ip/README.md)           | [`ip.mirio.dev`](https://ip.mirio.dev)                | Information about the clients IP address.                                                                    |
| [paste](./workers/paste/README.md)     | [`paste.mirio.dev`](https://ip.mirio.dev)             | Share small snippets of code using the web! All Pastes expire after 7 days.                                  |
| [rand](./workers/rand/README.md)       | `rand.mirio.dev`                                      | Get random values, like UUID's!                                                                              |
| [stocks](./workers/stocks/README.md)   | `stocks.mirio.dev`                                    | Get quick information about your favorite stock symbols!                                                     |
| [tfstate](./workers/tfstate/README.md) | `tfstate.mirio.dev` </br> `apigw.eragon.xyz/tfstate/` | Manage terraform state using a HTTP backend. Use the `apigw` route to proxy basic auth to CF Access headers. |

## Create a new Worker

```bash
wrangler generate my-worker [template]
# pick a template from the list https://github.com/cloudflare/workers-sdk/tree/main/templates
```
