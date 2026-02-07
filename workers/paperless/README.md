# Paperless

A self-hosted document management system built on Cloudflare Workers. Upload, organize, search, and classify documents with AI-powered suggestions — all running on the edge.

Inspired by [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx), rebuilt from scratch for Cloudflare's developer platform.

## Architecture

```mermaid
graph TD
    User([Browser]) -->|HTTPS| CFA[Cloudflare Access]
    CFA --> Worker[Worker<br/>TanStack Start SSR]

    Email([Incoming Email]) -->|Email Routing| Worker

    Worker -->|Store / retrieve files| R2[(R2 Bucket)]
    Worker -->|Read / write| HD[Hyperdrive]
    HD --> PG[(PostgreSQL)]

    Worker -->|Enqueue| Queue[Queue]
    Queue -->|Consume| Worker

    Worker -->|Extract text| Tika[Apache Tika<br/>Container]
    Worker -->|Classify documents| AI[Workers AI<br/>Llama 3.1 8B]
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| **Framework** | [TanStack Start](https://tanstack.com/start) (React SSR) |
| **Routing** | [TanStack Router](https://tanstack.com/router) (file-based) |
| **Database** | PostgreSQL via [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) |
| **ORM** | [Drizzle](https://orm.drizzle.team/) |
| **Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| **Auth** | [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (JWT) |
| **Text Extraction** | [Apache Tika](https://tika.apache.org/) 3.2 via [Cloudflare Containers](https://developers.cloudflare.com/containers/) |
| **AI** | [Workers AI](https://developers.cloudflare.com/workers-ai/) (`@cf/meta/llama-3.1-8b-instruct`) |
| **Queue** | [Cloudflare Queues](https://developers.cloudflare.com/queues/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) 4.0 |

## Features

### Document Management

- Upload documents through the web UI or via email
- Full-text search powered by PostgreSQL `tsvector` with English stemming
- Organize with color-coded tags and correspondents
- Archive Serial Numbers (ASN) for physical document tracking
- Soft-delete with trash and restore
- Inline file preview for PDFs and images

### Document Processing Pipeline

When a document is uploaded or received via email, it enters an asynchronous processing pipeline:

1. **Store** — File is uploaded to R2 with an MD5 hash for integrity verification
2. **Queue** — A processing message is enqueued (max 3 retries, dead-letter queue for failures)
3. **Extract** — [Apache Tika](https://tika.apache.org/), running in a [Cloudflare Container](https://developers.cloudflare.com/containers/), extracts text content from the document
4. **Post-process** — Extracted text is cleaned through a multi-stage pipeline: control character removal, HTML stripping, hyphenation repair, Unicode normalization, and whitespace cleanup
5. **Classify** — Workers AI analyzes the content and suggests tags and a correspondent from the existing set, each scored with a confidence value
6. **Review** — Suggestions appear on the document detail page for the user to accept or dismiss

### Email Ingestion

Documents can be imported by forwarding emails to the worker via [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/):

- Sender allowlist via the `ALLOWED_EMAIL_SENDERS` environment variable
- Raw `.eml` files are archived in R2 for auditability
- Each attachment becomes a separate document and enters the processing pipeline
- All imports are logged to the `incoming_emails` table with status tracking

### AI-Powered Suggestions

After text extraction, Workers AI classifies each document:

- Suggests tags from the existing tag set
- Suggests a correspondent from existing correspondents
- Each suggestion includes a confidence score (0–1) with a 50% minimum threshold
- Names are matched against existing entities (case-insensitive)
- Already-assigned tags and correspondents are filtered out to avoid duplicates
- Users accept or dismiss suggestions from the document detail page

## Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `HYPERDRIVE` | Hyperdrive | PostgreSQL connection pooling and caching |
| `R2` | R2 Bucket | Document and email file storage |
| `AI` | Workers AI | Document classification |
| `TIKA_CONTAINER` | Durable Object | Apache Tika container orchestration |
| `DOCUMENT_PROCESS_QUEUE` | Queue | Async document processing pipeline |
| `EMAIL` | Send Email | Outbound email (reserved) |
| `CF_VERSION_METADATA` | Version Metadata | Deployed version ID and git SHA tag |

## Database

Managed with [Drizzle ORM](https://orm.drizzle.team/) and PostgreSQL. Migrations live in `drizzle/`.

| Table | Purpose |
|-------|---------|
| `documents` | Document metadata, extracted content, and a generated `tsvector` search index |
| `files` | File records with R2 object keys, MIME types, and checksums |
| `tags` | Color-coded categorization labels |
| `document_tags` | Many-to-many join between documents and tags |
| `correspondents` | Sender and source entities |
| `document_suggestions` | AI-generated tag/correspondent suggestions with confidence scores |
| `incoming_emails` | Audit log for email imports |

All tables use soft deletes (`deleted_at` column) and timestamp tracking (`created_at`, `updated_at`).

## Project Structure

```
src/
├── components/        # React components (Header, sidebar, search)
├── db/
│   ├── index.ts       # DB connection factory and repository re-exports
│   ├── repositories/  # Data access layer
│   └── schema/        # Drizzle table definitions and relations
├── queue/
│   └── types.ts       # Queue message type definitions
├── routes/            # File-based routes
│   ├── __root.tsx     # Root layout with version metadata
│   ├── index.tsx      # Dashboard
│   ├── documents.$id.tsx
│   ├── tags.tsx
│   ├── correspondents.tsx
│   ├── trash.tsx
│   └── api.*.ts       # REST API endpoints
├── utils/
│   ├── ai-suggestions.ts      # AI classification logic
│   ├── cloudflare-access.ts   # JWT verification
│   ├── format.ts              # Formatting helpers
│   ├── pdf-thumbnail.ts       # Client-side PDF thumbnails
│   ├── post-process.ts        # Text extraction cleanup
│   ├── tika.ts                # Tika HTTP client
│   └── tika-container.ts      # Cloudflare Container definition
├── server.ts          # Worker entry (fetch, email, queue handlers)
└── styles.css         # Tailwind CSS entry point
drizzle/               # SQL migration files
```

## Development

### Prerequisites

- Node.js and [pnpm](https://pnpm.io/)
- PostgreSQL running locally (default: `postgres://postgres:postgres@localhost:5432/paperless-dev`)

### Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server on port 3000
pnpm test             # Run tests with Vitest
pnpm db:generate      # Generate migrations from schema changes
pnpm db:push          # Push schema directly to database
pnpm db:studio        # Open Drizzle Studio
pnpm cf-typegen       # Regenerate Cloudflare binding types
```

## Deployment

```bash
pnpm deploy
```

This builds the project, uploads a new worker version tagged with the current git short SHA, and deploys it to 100% traffic. The git SHA is displayed in the application footer via the `CF_VERSION_METADATA` binding.

## Observability

All request handlers use a **wide event** logging pattern — one structured JSON log line emitted per request in a `finally` block. Each log includes timing, outcome, and business context (document IDs, file sizes, AI suggestion counts, error details), making it straightforward to query and aggregate in any log analysis tool.
