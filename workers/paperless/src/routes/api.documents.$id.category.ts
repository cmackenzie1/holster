import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createDbFromHyperdrive, updateDocumentCategory } from "@/db";

export const Route = createFileRoute("/api/documents/$id/category")({
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
					path: "/api/documents/$id/category",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const body = await request.json();
					const { categoryId } = body as {
						categoryId?: string | null;
					};

					wideEvent.category_id = categoryId;

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const result = await updateDocumentCategory(
						db,
						BigInt(params.id),
						categoryId ? BigInt(categoryId) : null,
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
									: "Failed to update category",
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
