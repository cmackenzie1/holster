import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createDbFromHyperdrive, getDocumentForProcessing } from "@/db";

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

					// Look up document and its primary file
					const docInfo = await getDocumentForProcessing(db, BigInt(params.id));

					if (!docInfo) {
						wideEvent.document = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json(
							{ error: "Document or file not found" },
							{ status: 404 },
						);
					}

					wideEvent.document = { id: params.id, found: true };
					wideEvent.file = {
						objectKey: docInfo.objectKey,
						mimeType: docInfo.mimeType,
					};

					// Enqueue async document processing
					await env.DOCUMENT_PROCESS_QUEUE.send({
						documentId: docInfo.id,
						objectKey: docInfo.objectKey,
						mimeType: docInfo.mimeType,
					});
					wideEvent.queued = true;

					wideEvent.status_code = 202;
					wideEvent.outcome = "success";

					return json({ success: true, queued: true }, { status: 202 });
				} catch (error) {
					wideEvent.status_code = 500;
					wideEvent.outcome = "error";
					wideEvent.error = {
						message:
							error instanceof Error ? error.message : "Processing failed",
						type: error instanceof Error ? error.name : "UnknownError",
					};
					return json(
						{
							error:
								error instanceof Error ? error.message : "Processing failed",
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
