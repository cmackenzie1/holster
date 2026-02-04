import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
  createDbFromHyperdrive,
  listDeletedDocuments,
  permanentlyDeleteOldDocuments,
} from "@/db";

export const Route = createFileRoute("/api/trash")({
  server: {
    handlers: {
      // GET /api/trash - List deleted documents
      GET: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        const url = new URL(request.url);
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limit = url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!, 10)
          : 50;

        const wideEvent: Record<string, unknown> = {
          method: "GET",
          path: "/api/trash",
          timestamp: new Date().toISOString(),
          cursor,
          limit,
        };

        try {
          const db = createDbFromHyperdrive(env.HYPERDRIVE);
          const result = await listDeletedDocuments(db, { cursor, limit });

          wideEvent.trash = {
            count: result.items.length,
            has_more: result.hasMore,
          };
          wideEvent.status_code = 200;
          wideEvent.outcome = "success";

          return json(result);
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
                  : "Failed to fetch trash",
            },
            { status: 500 }
          );
        } finally {
          wideEvent.duration_ms = Date.now() - startTime;
          console.log(JSON.stringify(wideEvent));
        }
      },

      // POST /api/trash - Cleanup old items (can be called by cron)
      POST: async () => {
        const startTime = Date.now();
        const wideEvent: Record<string, unknown> = {
          method: "POST",
          path: "/api/trash",
          timestamp: new Date().toISOString(),
          action: "cleanup",
        };

        try {
          const db = createDbFromHyperdrive(env.HYPERDRIVE);
          const result = await permanentlyDeleteOldDocuments(db);

          // Delete files from R2
          if (result.objectKeys.length > 0) {
            await Promise.all(
              result.objectKeys.map((key) => env.R2.delete(key))
            );
          }

          wideEvent.cleanup = {
            deleted_count: result.deletedCount,
            files_deleted: result.objectKeys.length,
          };
          wideEvent.status_code = 200;
          wideEvent.outcome = "success";

          return json({
            success: true,
            deletedCount: result.deletedCount,
            filesDeleted: result.objectKeys.length,
          });
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
                  : "Failed to cleanup trash",
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
