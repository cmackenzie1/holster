import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { eq, and, isNull } from "drizzle-orm";
import { createDbFromHyperdrive, documents, files } from "@/db";

export const Route = createFileRoute("/api/documents/$id/process")({
	server: {
		handlers: {
			POST: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "POST",
					path: "/api/documents/$id/process",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					// Look up document
					const [doc] = await db
						.select({ id: documents.id })
						.from(documents)
						.where(
							and(
								eq(documents.id, BigInt(params.id)),
								isNull(documents.deletedAt),
							),
						)
						.limit(1);

					if (!doc) {
						wideEvent.document = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json(
							{ error: "Document not found" },
							{ status: 404 },
						);
					}

					// Get the primary file
					const [file] = await db
						.select({
							objectKey: files.objectKey,
							mimeType: files.mimeType,
						})
						.from(files)
						.where(
							and(
								eq(files.documentId, doc.id),
								isNull(files.deletedAt),
							),
						)
						.limit(1);

					if (!file) {
						wideEvent.document = { id: params.id, found: true };
						wideEvent.status_code = 404;
						wideEvent.outcome = "no_file";
						return json(
							{ error: "No file found for document" },
							{ status: 404 },
						);
					}

					wideEvent.document = { id: params.id, found: true };
					wideEvent.file = {
						objectKey: file.objectKey,
						mimeType: file.mimeType,
					};

					// Enqueue async document processing
					await env.DOCUMENT_PROCESS_QUEUE.send({
						documentId: doc.id.toString(),
						objectKey: file.objectKey,
						mimeType: file.mimeType,
					});
					wideEvent.queued = true;

					wideEvent.status_code = 202;
					wideEvent.outcome = "success";

					return json(
						{ success: true, queued: true },
						{ status: 202 },
					);
				} catch (error) {
					wideEvent.status_code = 500;
					wideEvent.outcome = "error";
					wideEvent.error = {
						message:
							error instanceof Error
								? error.message
								: "Processing failed",
						type:
							error instanceof Error
								? error.name
								: "UnknownError",
					};
					return json(
						{
							error:
								error instanceof Error
									? error.message
									: "Processing failed",
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
