import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	createComment,
	createDbFromHyperdrive,
	listCommentsByDocument,
} from "@/db";

export const Route = createFileRoute("/api/documents/$id/comments")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/documents/$id/comments",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const comments = await listCommentsByDocument(db, BigInt(params.id));

					wideEvent.comments_count = comments.length;
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json(comments);
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
									: "Failed to list comments",
						},
						{ status: 500 },
					);
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},

			POST: async ({
				params,
				request,
			}: {
				params: { id: string };
				request: Request;
			}) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "POST",
					path: "/api/documents/$id/comments",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const body = (await request.json()) as { content?: string };
					const content = body.content?.trim();

					if (!content) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "Content cannot be empty" };
						return json({ error: "Content cannot be empty" }, { status: 400 });
					}

					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const comment = await createComment(db, BigInt(params.id), content);

					wideEvent.comment = { id: comment.id };
					wideEvent.status_code = 201;
					wideEvent.outcome = "success";

					return json(comment, { status: 201 });
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
									: "Failed to create comment",
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
