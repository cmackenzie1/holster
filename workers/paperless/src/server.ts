import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import PostalMime from "postal-mime";
import { verifyCloudflareAccess } from "./utils/cloudflare-access";
import { createDbFromHyperdrive, documents, files, incomingEmails } from "./db";

interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(to: string, headers?: Headers): Promise<void>;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Skip auth for static assets
    const isStaticAsset =
      url.pathname.startsWith("/_build/") ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".map") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".woff") ||
      url.pathname.endsWith(".woff2");

    if (!isStaticAsset) {
      const result = await verifyCloudflareAccess(request);

      if (!result.valid) {
        console.log(
          JSON.stringify({
            event: "cloudflare_access_denied",
            path: url.pathname,
            error: result.error,
            timestamp: new Date().toISOString(),
          })
        );

        return new Response("Unauthorized", {
          status: 401,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      }
    }

    return handler.fetch(request);
  },

  async email(message: EmailMessage): Promise<void> {
    const startTime = Date.now();
    const wideEvent: Record<string, unknown> = {
      event: "email_received",
      timestamp: new Date().toISOString(),
      from: message.from,
      to: message.to,
      rawSize: message.rawSize,
    };

    try {
      // Check if sender is allowed
      const allowedSenders = (env.ALLOWED_EMAIL_SENDERS as string)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const senderEmail = message.from.toLowerCase();
      const isAllowed =
        allowedSenders.length === 0 ||
        allowedSenders.some(
          (allowed) =>
            senderEmail === allowed || senderEmail.endsWith(`<${allowed}>`)
        );

      if (!isAllowed) {
        wideEvent.status = "ignored";
        wideEvent.reason = "sender_not_allowed";
        message.setReject("Sender not authorized");
        return;
      }

      // Read raw email stream
      const rawEmail = await streamToArrayBuffer(message.raw);
      wideEvent.rawEmailBytes = rawEmail.byteLength;

      // Store raw email in R2
      const timestamp = Date.now();
      const rawEmailKey = `emails/${timestamp}/${sanitizeFilename(message.from)}.eml`;
      await env.R2.put(rawEmailKey, rawEmail, {
        httpMetadata: { contentType: "message/rfc822" },
      });
      wideEvent.rawEmailKey = rawEmailKey;

      // Parse email with postal-mime
      const parsed = await PostalMime.parse(rawEmail);
      wideEvent.subject = parsed.subject;
      wideEvent.attachmentCount = parsed.attachments?.length ?? 0;

      const db = createDbFromHyperdrive(env.HYPERDRIVE);

      // Filter to valid attachments (with filename and content)
      const validAttachments = (parsed.attachments ?? []).filter(
        (att) =>
          att.filename &&
          att.content &&
          (typeof att.content === "string"
            ? att.content.length > 0
            : att.content.byteLength > 0)
      );

      if (validAttachments.length === 0) {
        // No valid attachments - record as ignored
        await db.insert(incomingEmails).values({
          from: message.from,
          to: message.to,
          subject: parsed.subject ?? null,
          rawEmailKey,
          rawEmailSize: BigInt(rawEmail.byteLength),
          status: "ignored",
          documentsCreated: 0,
          errorMessage: "No valid attachments found",
        });

        wideEvent.status = "ignored";
        wideEvent.reason = "no_attachments";
        return;
      }

      // Process each attachment as a document
      const createdDocuments: { id: string; title: string }[] = [];

      for (const attachment of validAttachments) {
        const filename = attachment.filename!;
        // Handle both ArrayBuffer and string content from postal-mime
        const content =
          typeof attachment.content === "string"
            ? new TextEncoder().encode(attachment.content)
            : new Uint8Array(attachment.content);

        // Generate R2 key
        const objectKey = `documents/${timestamp}/${filename}`;

        // Calculate MD5 hash
        const hashBuffer = await crypto.subtle.digest("MD5", content);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const md5Hash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Upload to R2
        await env.R2.put(objectKey, content, {
          httpMetadata: {
            contentType: attachment.mimeType || "application/octet-stream",
          },
        });

        // Extract title from filename (remove extension)
        const title = filename.replace(/\.[^/.]+$/, "");

        // Create document record
        const [newDocument] = await db
          .insert(documents)
          .values({ title })
          .returning({ id: documents.id });

        // Create file record
        await db.insert(files).values({
          documentId: newDocument.id,
          objectKey,
          mimeType: attachment.mimeType || "application/octet-stream",
          sizeBytes: BigInt(content.byteLength),
          md5Hash,
        });

        createdDocuments.push({
          id: newDocument.id.toString(),
          title,
        });
      }

      // Record successful import
      await db.insert(incomingEmails).values({
        from: message.from,
        to: message.to,
        subject: parsed.subject ?? null,
        rawEmailKey,
        rawEmailSize: BigInt(rawEmail.byteLength),
        status: "processed",
        documentsCreated: createdDocuments.length,
      });

      wideEvent.status = "processed";
      wideEvent.documentsCreated = createdDocuments;
    } catch (error) {
      wideEvent.status = "failed";
      wideEvent.error = {
        message: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.name : "UnknownError",
      };

      // Try to record the failure
      try {
        const db = createDbFromHyperdrive(env.HYPERDRIVE);
        await db.insert(incomingEmails).values({
          from: message.from,
          to: message.to,
          subject: null,
          rawEmailKey: `emails/${Date.now()}/failed.eml`,
          rawEmailSize: BigInt(message.rawSize),
          status: "failed",
          documentsCreated: 0,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      } catch {
        // Ignore secondary failure
      }
    } finally {
      wideEvent.duration_ms = Date.now() - startTime;
      console.log(JSON.stringify(wideEvent));
    }
  },
};

async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}
