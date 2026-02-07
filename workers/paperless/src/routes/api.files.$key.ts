import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/$key")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { key: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/files/$key",
					timestamp: new Date().toISOString(),
				};

				let response: Response;

				try {
					const r2 = env.R2;

					// The key is URL-encoded, decode it
					const objectKey = decodeURIComponent(params.key);
					wideEvent.file = { key: objectKey };

					const object = await r2.get(objectKey);

					if (!object) {
						wideEvent.status_code = 404;
						wideEvent.outcome = "error";
						wideEvent.error = {
							message: "File not found",
							type: "NotFoundError",
						};
						response = new Response("File not found", { status: 404 });
						return response;
					}

					const contentType =
						object.httpMetadata?.contentType || "application/octet-stream";
					const fileSize = object.size;

					// Add business context to wide event
					wideEvent.file = {
						key: objectKey,
						contentType,
						size: fileSize,
					};

					const headers = new Headers();
					headers.set("Content-Type", contentType);
					headers.set("Content-Length", fileSize.toString());
					// Allow browser to display PDF inline
					headers.set("Content-Disposition", "inline");
					// Cache for 1 hour
					headers.set("Cache-Control", "private, max-age=3600");

					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					response = new Response(object.body, { headers });
					return response;
				} catch (error) {
					wideEvent.status_code = 500;
					wideEvent.outcome = "error";
					wideEvent.error = {
						message: error instanceof Error ? error.message : String(error),
						type: error instanceof Error ? error.name : "UnknownError",
					};
					throw error;
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},
		},
	},
});
