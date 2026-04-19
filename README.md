# Holster

A collection of Cloudflare Workers, managed using Bun Workspaces and Turborepo.

## Workers

| Name | Host | Description |
| ---- | ---- | ----------- |
| [echo](./workers/echo/) | [`echo.mirio.dev`](https://echo.mirio.dev) | Echo back HTTP requests — headers, body, method. Supports text, JSON, and HTML output |
| [gradient](./workers/gradient/) | [`gradient.mirio.dev`](https://gradient.mirio.dev) | Deterministic gradient SVGs from any string. Supports radial, multi-stop, noise texture, and initials |
| [hash](./workers/hash/) | [`hash.mirio.dev`](https://hash.mirio.dev) | Hex digest of a payload. Supports `md5`, `sha1`, `sha256`, `sha384`, and `sha512` |
| [hello-world](./workers/hello-world/) | - | Hello World example with analytics |
| [ip](./workers/ip/) | [`ip.mirio.dev`](https://ip.mirio.dev) | Your public IP address and geolocation properties |
| [rand](./workers/rand/) | [`rand.mirio.dev`](https://rand.mirio.dev) | Random value generator — UUID v4, UUID v7, and ULID |
| [rdap](./workers/rdap/) | [`rdap.mirio.dev`](https://rdap.mirio.dev) | Query RDAP servers for domain registration information |
| [stocks](./workers/stocks/) | [`stocks.mirio.dev`](https://stocks.mirio.dev) | Quick stock quote lookup by symbol |

## Packages

| Name | Description |
| ---- | ----------- |
| [@holster/html](./packages/html/) | Shared HTML page shell, nav, and utilities for worker landing pages |
| [@holster/typescript-config](./packages/typescript-config/) | Shared TypeScript configuration |
| [@mirio/analytics](./packages/analytics/) | Analytics utilities for workers |
| [@cmackenzie1/condition](./packages/condition/) | Generic data notifier for async conditions |

## Scripts

```bash
bun run check-types  # Type check all packages
bun run test         # Run tests
bun run lint         # Lint with Biome
bun run format       # Format with Biome
bun run typegen      # Generate worker types
bun run deploy       # Deploy all workers
bun run dev          # Start dev servers
```
