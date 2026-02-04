import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createDbFromHyperdrive, updateDocumentCorrespondent } from "@/db";

export const Route = createFileRoute("/api/documents/$id/correspondent")({
	server: {
		handlers: {
			PUT: async ({
				params,
				request,
			}: {
				params: { id: string };
				request: Request;
			}) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "PUT",
					path: "/api/documents/$id/correspondent",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const body = await request.json();
					const { correspondentId } = body as {
						correspondentId?: string | null;
					};

					wideEvent.correspondent_id = correspondentId;

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const result = await updateDocumentCorrespondent(
						db,
						BigInt(params.id),
						correspondentId ? BigInt(correspondentId) : null,
					);

					if (!result.success) {
						if (result.error === "Document not found") {
							wideEvent.document = { id: params.id, found: false };
							wideEvent.status_code = 404;
							wideEvent.outcome = "not_found";
							return json({ error: result.error }, { status: 404 });
						}

						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: result.error };
						return json({ error: result.error }, { status: 400 });
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
									: "Failed to update correspondent",
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
