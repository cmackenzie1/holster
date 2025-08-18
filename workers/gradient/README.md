# gradient

Generate a deterministic gradient image from a value. Useful for generating unique, consistent images for avatars.

## Usage

Simply perform a GET request with the `from` URL parameter.

```bash
curl https://gradient.mirio.dev/?from=hello
```

![Gradient Image](https://gradient.mirio.dev/?from=hello)

## Development

```bash
npm install
npm run dev
```

```bash
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
