# Holster

A collection of Cloudflare Workers, managed using PNPM Workspaces.

## Apps

| Name                                   | Host                                                  | Description                                                                                                  |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [echo](./workers/echo/README.md)       | [`echo.mirio.dev`](https://echo.mirio.dev)            | Echos back the received HTTP request.                                                                        |
| [hash](./workers/hash/README.md)       | [`hash.mirio.dev`](https://hash.mirio.dev)            | Returns the hex digest of the payload. Supports `md5`, `sha1`, `sha256` `sha384` and `sha512`                |
| [ip](./workers/ip/README.md)           | [`ip.mirio.dev`](https://ip.mirio.dev)                | Information about the clients IP address.                                                                    |
| [paste](./workers/paste/README.md)     | [`paste.mirio.dev`](https://paste.mirio.dev)          | Share small snippets of code using the web! All Pastes expire after 7 days.                                  |
| [rand](./workers/rand/README.md)       | [`rand.mirio.dev`](https://rand.mirio.dev)            | Get random values, like UUID's!                                                                              |
| [rdap](./workers/rdap/README.md)       | [`rdap.mirio.dev`](https://rdap.mirio.dev)            | Query RDAP (Registration Data Access Protocol) servers for domain registration information.                  |
| [stocks](./workers/stocks/README.md)   | [`stocks.mirio.dev`](https://stocks.mirio.dev)        | Get quick information about your favorite stock symbols!                                                     |
| [tfstate](./workers/tfstate/README.md) | `tfstate.mirio.dev` </br> `apigw.eragon.xyz/tfstate/` | Manage terraform state using a HTTP backend. Use the `apigw` route to proxy basic auth to CF Access headers. |

## Create a new Worker

```bash
npm create cloudflare@latest
```
