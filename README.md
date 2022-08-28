# Holster

A collection of Cloudflare Workers, managed by Lerna.

## Apps

| Name  | Host              | Description                                                                                   |
| ----- | ----------------- | --------------------------------------------------------------------------------------------- |
| echo  | `echo.mirio.dev`  | Echos back the received HTTP request.                                                         |
| hash  | `hash.mirio.dev`  | Returns the hex digest of the payload. Supports `md5`, `sha1`, `sha256` `sha384` and `sha512` |
| ip    | `ip.mirio.dev     | Information about the clients IP address.                                                     |
| paste | `paste.mirio.dev` | Share small snippets of code using the web! All Pastes expire after 7 days.                   |
| rand  | `rand.mirio.dev`  | Get random values, like UUID's!                                                               |

### Upcoming / Planned

- `stocks`: GET your favorite symbols current price
- `public`: Static assests, public and cached 😎
- `send`: End-to-End encrypted file sharing. Limit 25MB, 48 hr TTL.
- `paste`: Share code and text snippets! Just like gists

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
