# Holster

A collection of Cloudflare Workers, managed by Lerna.

## Apps

| Name                                    | Host                | Description                                                                                   |
| --------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| [echo](./packages/echo/README.md)       | `echo.mirio.dev`    | Echos back the received HTTP request.                                                         |
| [hash](./packages/hash/README.md)       | `hash.mirio.dev`    | Returns the hex digest of the payload. Supports `md5`, `sha1`, `sha256` `sha384` and `sha512` |
| [ip](./packages/ip/README.md)           | `ip.mirio.dev`      | Information about the clients IP address.                                                     |
| [paste](./packages/paste/README.md)     | `paste.mirio.dev`   | Share small snippets of code using the web! All Pastes expire after 7 days.                   |
| [rand](./packages/rand/README.md)       | `rand.mirio.dev`    | Get random values, like UUID's!                                                               |
| [stocks](./packages/stocks/README.md)   | `stocks.mirio.dev`  | Get quick information about your favorite stock symbols!                                      |
| [tfstate](./packages/tfstate/README.md) | `tfstate.mirio.dev` | Manage terraform state using a HTTP backend.                                                  |

### Upcoming / Planned

- `public`: Static assets, public and cached 😎
- `send`: End-to-End encrypted file sharing. Limit 25MB, 48 hr TTL.

## Create a new Worker

```bash
./create_app.sh <name>
```
