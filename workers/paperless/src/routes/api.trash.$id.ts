import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
	createDbFromHyperdrive,
	restoreDocument,
	permanentlyDeleteDocument,
} from "@/db";

export const Route = createFileRoute("/api/trash/$id")({
	server: {
		handlers: {
			// POST /api/trash/:id - Restore a document from trash
			POST: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "POST",
					path: "/api/trash/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
					action: "restore",
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const restored = await restoreDocument(db, BigInt(params.id));

					if (!restored) {
						wideEvent.document = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json(
							{ error: "Document not found in trash" },
							{ status: 404 },
						);
					}

					wideEvent.document = { id: params.id, found: true, restored: true };
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
									: "Failed to restore document",
						},
						{ status: 500 },
					);
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},

			// DELETE /api/trash/:id - Permanently delete a document
			DELETE: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "DELETE",
					path: "/api/trash/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
					action: "permanent_delete",
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const result = await permanentlyDeleteDocument(db, BigInt(params.id));

					if (!result.success) {
						wideEvent.document = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Document not found" }, { status: 404 });
					}

					// Delete files from R2
					if (result.objectKeys.length > 0) {
						await Promise.all(
							result.objectKeys.map((key) => env.R2.delete(key)),
						);
					}

					wideEvent.document = {
						id: params.id,
						found: true,
						files_deleted: result.objectKeys.length,
					};
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json({
						success: true,
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
									: "Failed to delete document",
						},
						{ status: 500 },
					);
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},
		},
	},
});
