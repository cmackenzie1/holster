import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createDbFromHyperdrive, softDeleteComment } from "@/db";

export const Route = createFileRoute("/api/documents/$id/comments/$commentId")({
	server: {
		handlers: {
			DELETE: async ({
				params,
			}: {
				params: { id: string; commentId: string };
			}) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "DELETE",
					path: "/api/documents/$id/comments/$commentId",
					timestamp: new Date().toISOString(),
					params: { id: params.id, commentId: params.commentId },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const deleted = await softDeleteComment(db, BigInt(params.commentId));

					if (!deleted) {
						wideEvent.comment = {
							id: params.commentId,
							found: false,
						};
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Comment not found" }, { status: 404 });
					}

					wideEvent.comment = { id: params.commentId, found: true };
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
									: "Failed to delete comment",
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
