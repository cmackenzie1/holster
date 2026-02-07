# Paperless Worker

A Paperless-ngx clone built on Cloudflare Workers, R2, and PostgreSQL via Hyperdrive.

## Tech Stack

- **Framework**: TanStack React Start (SSR-capable React framework)
- **Routing**: TanStack Router (file-based routing)
- **Runtime**: Cloudflare Workers
- **Database**: PostgreSQL via Hyperdrive (Drizzle ORM)
- **Storage**: Cloudflare R2 for document files
- **Styling**: Tailwind CSS 4.0

## Project Structure

```
src/
├── components/        # React components (Header, etc.)
├── db/
│   ├── index.ts      # DB connection factory (createDbFromHyperdrive)
│   └── schema/       # Drizzle ORM schemas
│       ├── documents.ts
│       ├── files.ts
│       ├── tags.ts
│       ├── correspondents.ts
│       └── incoming-emails.ts
├── routes/           # File-based routes (TanStack Router)
│   ├── __root.tsx    # Root layout
│   ├── index.tsx     # Dashboard
│   ├── documents.$id.tsx
│   ├── api.upload.ts
│   ├── api.files.$key.ts
│   ├── api.documents.$id.ts
│   ├── api.documents.$id.tags.ts
│   ├── api.tags.ts
│   └── api.tags.$id.ts
├── router.tsx        # Router configuration
└── routeTree.gen.ts  # Auto-generated route tree
drizzle/              # Database migrations
```

## SSR Architecture: Server vs Client Code

This is an SSR application. **Cloudflare bindings (HYPERDRIVE, R2) are only available in server-side code.**

### Server-Side Only (Can Access Bindings)

Use these patterns when you need database or R2 access:

**1. Server Functions (`createServerFn`)**
```typescript
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

const getDocuments = createServerFn({ method: "GET" }).handler(async () => {
  const db = createDbFromHyperdrive(env.HYPERDRIVE);
  return db.select().from(documents);
});
```

**Server Functions with Input Validation**

Use `createMiddleware` with `inputValidator` - NOT `.validator()` on the server function:

```typescript
import { createServerFn, createMiddleware } from "@tanstack/react-start";

const myMiddleware = createMiddleware({ type: "function" })
  .inputValidator((data: { id: string }) => data)
  .server(({ next }) => next());

const getDocument = createServerFn({ method: "GET" })
  .middleware([myMiddleware])
  .handler(async ({ data }) => {
    // data.id is typed
  });

// Call with: getDocument({ data: { id: "123" } })
```

**2. Route Loaders**
```typescript
export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: () => getDocuments(), // Executes on server
});
```

**3. API Route Handlers**
```typescript
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Access env.HYPERDRIVE, env.R2 here
        return json({ success: true });
      }
    }
  }
});
```

### Client-Side Only

- React component interactivity (useState, useEffect, event handlers)
- Browser APIs (localStorage, fetch to API routes)
- Client-side navigation

### Hydrated (Runs Both)

- React components render on server first, then hydrate on client
- Route components with `useLoaderData()` - data comes from server

## Cloudflare Bindings

Configured in `wrangler.jsonc`:

| Binding | Type | Description |
|---------|------|-------------|
| `HYPERDRIVE` | Hyperdrive | PostgreSQL connection proxy |
| `R2` | R2 Bucket | Document file storage (`paperless-documents`) |
| `EMAIL` | SendEmail | Email sending capability (for future use) |
| `CF_VERSION_METADATA` | WorkerVersionMetadata | Worker version ID and tag (git SHA) |

**Environment Variables**:

| Variable | Description |
|----------|-------------|
| `ALLOWED_EMAIL_SENDERS` | Comma-separated list of allowed sender email addresses for email import. Empty = allow all. |

Access via:
```typescript
import { env } from "cloudflare:workers";
// Use env.HYPERDRIVE, env.R2, env.ALLOWED_EMAIL_SENDERS, etc. directly
```

## Database

**ORM**: Drizzle with PostgreSQL dialect

**Key Tables**:
- `documents` - Document metadata (title, content, ASN, dates)
- `files` - File records linked to documents (R2 object keys, hashes)
- `tags` - Categorization tags with colors
- `document_tags` - Many-to-many join table
- `correspondents` - Sender/source entities
- `incoming_emails` - Email import audit log (sender, status, documents created)

**Commands**:
```bash
pnpm db:generate  # Generate migrations from schema changes
pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio
```

## R2 Storage Pattern

Files are stored with keys like: `documents/{timestamp}/{filename}`

```typescript
// Upload
await env.R2.put(objectKey, file, {
  httpMetadata: { contentType: file.type }
});

// Retrieve
const object = await env.R2.get(objectKey);
```

## Email Import

The worker supports importing documents via email. Emails are processed by the `email()` handler in `server.ts`.

**How it works:**
1. Email arrives at configured address (set up via Cloudflare Email Routing)
2. Sender is checked against `ALLOWED_EMAIL_SENDERS` (rejected if not allowed)
3. Raw email is stored in R2 at `emails/{timestamp}/{sender}.eml`
4. Attachments are extracted using `postal-mime`
5. Each attachment becomes a document with its filename as the title
6. Import is logged to `incoming_emails` table with status (processed/ignored/failed)

**Configuration:**
```jsonc
// wrangler.jsonc
"vars": {
  "ALLOWED_EMAIL_SENDERS": "scanner@example.com,noreply@geniusscan.com"
}
```

**Database table**: `incoming_emails` tracks all incoming emails with:
- `from`, `to`, `subject` - Email metadata
- `rawEmailKey` - R2 key for the original `.eml` file
- `status` - `processed`, `ignored`, or `failed`
- `documentsCreated` - Count of documents created from attachments
- `errorMessage` - Error details if failed

## Development

```bash
pnpm dev          # Start dev server on port 3000
pnpm build        # Build for production
pnpm deploy       # Build, upload version tagged with git SHA, and deploy
```

## Key Patterns

1. **Soft Deletes**: All entities have `deletedAt` column
2. **File Integrity**: MD5 hashes stored for uploaded files
3. **Type Safety**: End-to-end TypeScript with Drizzle type inference
4. **File-Based Routing**: Routes auto-generated from `src/routes/` structure

## Logging (Wide Events)

Use wide event logging - emit ONE context-rich JSON log per request in a `finally` block:

```typescript
const handler = async () => {
  const startTime = Date.now();
  const wideEvent: Record<string, unknown> = {
    function: "myFunction",
    timestamp: new Date().toISOString(),
  };

  try {
    // ... business logic, add context as you go
    wideEvent.document = { id, found: true };
    wideEvent.outcome = "success";
    return result;
  } catch (error) {
    wideEvent.outcome = "error";
    wideEvent.error = { message: error.message, type: error.name };
    throw error;
  } finally {
    wideEvent.duration_ms = Date.now() - startTime;
    console.log(JSON.stringify(wideEvent));
  }
};
```

## Anti-Patterns to Avoid

1. **Scattered logs**: Don't use multiple `console.log()` calls. Use one wide event per request.
2. **Fake `.validator()` on server functions**: `createServerFn().validator()` does NOT exist. Use `createMiddleware` with `inputValidator` instead (see Server Functions with Input Validation above).
