# Holster

A collection of Cloudflare Workers, managed using PNPM Workspaces and Turborepo.

## Workers

| Name | Host | Description |
| ---- | ---- | ----------- |
| [echo](./workers/echo/) | [`echo.mirio.dev`](https://echo.mirio.dev) | Echos back the received HTTP request |
| [gradient](./workers/gradient/) | - | Gradient generator service |
| [hash](./workers/hash/) | [`hash.mirio.dev`](https://hash.mirio.dev) | Returns the hex digest of the payload. Supports `md5`, `sha1`, `sha256`, `sha384`, and `sha512` |
| [hello-world](./workers/hello-world/) | - | Hello World example with analytics |
| [ip](./workers/ip/) | [`ip.mirio.dev`](https://ip.mirio.dev) | Information about the client's IP address |
| [rand](./workers/rand/) | [`rand.mirio.dev`](https://rand.mirio.dev) | Get random values like UUIDs |
| [rdap](./workers/rdap/) | [`rdap.mirio.dev`](https://rdap.mirio.dev) | Query RDAP servers for domain registration information |
| [stocks](./workers/stocks/) | [`stocks.mirio.dev`](https://stocks.mirio.dev) | Get quick information about stock symbols |

## Packages

| Name | Description |
| ---- | ----------- |
| [@holster/typescript-config](./packages/typescript-config/) | Shared TypeScript configuration |
| [@mirio/analytics](./packages/analytics/) | Analytics utilities for workers |
| [@cmackenzie1/condition](./packages/condition/) | Generic data notifier for async conditions |

## Scripts

```bash
pnpm check-types  # Type check all packages
pnpm test         # Run tests
pnpm lint         # Lint with Biome
pnpm format       # Format with Biome
pnpm typegen      # Generate worker types from wrangler.toml
pnpm deploy       # Deploy all workers
pnpm dev          # Start dev servers
```

## Create a new Worker

```bash
npm create cloudflare@latest
```
