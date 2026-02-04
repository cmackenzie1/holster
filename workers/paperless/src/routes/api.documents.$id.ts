import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
  createDbFromHyperdrive,
  getDocumentById,
  updateDocument,
  softDeleteDocument,
} from "@/db";

export const Route = createFileRoute("/api/documents/$id")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const startTime = Date.now();
        const wideEvent: Record<string, unknown> = {
          method: "GET",
          path: "/api/documents/$id",
          timestamp: new Date().toISOString(),
          params: { id: params.id },
        };

        try {
          const db = createDbFromHyperdrive(env.HYPERDRIVE);

          const doc = await getDocumentById(db, BigInt(params.id));

          if (!doc) {
            wideEvent.document = { id: params.id, found: false };
            wideEvent.status_code = 404;
            wideEvent.outcome = "not_found";
            return json({ error: "Document not found" }, { status: 404 });
          }

          wideEvent.document = {
            id: params.id,
            found: true,
            files_count: doc.files.length,
            tags_count: doc.tags.length,
            has_correspondent: !!doc.correspondent,
          };
          wideEvent.status_code = 200;
          wideEvent.outcome = "success";

          return json(doc);
        } catch (error) {
          wideEvent.status_code = 500;
          wideEvent.outcome = "error";
          wideEvent.error = {
            message: error instanceof Error ? error.message : "Unknown error",
            type: error instanceof Error ? error.name : "UnknownError",
          };
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch document",
            },
            { status: 500 }
          );
        } finally {
          wideEvent.duration_ms = Date.now() - startTime;
          console.log(JSON.stringify(wideEvent));
        }
      },

      PATCH: async ({
        params,
        request,
      }: {
        params: { id: string };
        request: Request;
      }) => {
        const startTime = Date.now();
        const wideEvent: Record<string, unknown> = {
          method: "PATCH",
          path: "/api/documents/$id",
          timestamp: new Date().toISOString(),
          params: { id: params.id },
        };

        try {
          const body = await request.json();
          const { title, content, archiveSerialNumber } = body as {
            title?: string;
            content?: string | null;
            archiveSerialNumber?: number | null;
          };

          // Validate title if provided
          if (
            title !== undefined &&
            (typeof title !== "string" || title.trim() === "")
          ) {
            wideEvent.status_code = 400;
            wideEvent.outcome = "validation_error";
            wideEvent.error = { message: "Title cannot be empty" };
            return json({ error: "Title cannot be empty" }, { status: 400 });
          }

          const db = createDbFromHyperdrive(env.HYPERDRIVE);

          const updated = await updateDocument(db, BigInt(params.id), {
            title,
            content,
            archiveSerialNumber,
          });

          if (!updated) {
            wideEvent.document = { id: params.id, found: false };
            wideEvent.status_code = 404;
            wideEvent.outcome = "not_found";
            return json({ error: "Document not found" }, { status: 404 });
          }

          wideEvent.document = { id: params.id, found: true };
          wideEvent.updated_fields = Object.keys(body).filter(
            (k) => (body as Record<string, unknown>)[k] !== undefined
          );
          wideEvent.status_code = 200;
          wideEvent.outcome = "success";

          return json({ success: true });
        } catch (error) {
          wideEvent.status_code = 500;
          wideEvent.outcome = "error";
          wideEvent.error = {
            message: error instanceof Error ? error.message : "Unknown error",
            type: error instanceof Error ? error.name : "UnknownError",
          };
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update document",
            },
            { status: 500 }
          );
        } finally {
          wideEvent.duration_ms = Date.now() - startTime;
          console.log(JSON.stringify(wideEvent));
        }
      },

      DELETE: async ({ params }: { params: { id: string } }) => {
        const startTime = Date.now();
        const wideEvent: Record<string, unknown> = {
          method: "DELETE",
          path: "/api/documents/$id",
          timestamp: new Date().toISOString(),
          params: { id: params.id },
        };

        try {
          const db = createDbFromHyperdrive(env.HYPERDRIVE);

          const deleted = await softDeleteDocument(db, BigInt(params.id));

          if (!deleted) {
            wideEvent.document = { id: params.id, found: false };
            wideEvent.status_code = 404;
            wideEvent.outcome = "not_found";
            return json({ error: "Document not found" }, { status: 404 });
          }

          wideEvent.document = { id: params.id, found: true };
          wideEvent.status_code = 200;
          wideEvent.outcome = "success";

          return json({ success: true });
        } catch (error) {
          wideEvent.status_code = 500;
          wideEvent.outcome = "error";
          wideEvent.error = {
            message: error instanceof Error ? error.message : "Unknown error",
            type: error instanceof Error ? error.name : "UnknownError",
          };
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to delete document",
            },
            { status: 500 }
          );
        } finally {
          wideEvent.duration_ms = Date.now() - startTime;
          console.log(JSON.stringify(wideEvent));
        }
      },
    },
  },
});
