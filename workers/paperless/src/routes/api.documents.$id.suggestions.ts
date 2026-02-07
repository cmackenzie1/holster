import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createDbFromHyperdrive, listSuggestionsByDocument } from "@/db";

export const Route = createFileRoute("/api/documents/$id/suggestions")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/documents/$id/suggestions",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const suggestions = await listSuggestionsByDocument(
						db,
						BigInt(params.id),
					);

					wideEvent.suggestions_count = suggestions.length;
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json({ suggestions });
				} catch (error) {
					wideEvent.status_code = 500;
					wideEvent.outcome = "error";
					wideEvent.error = {
						message: error instanceof Error ? error.message : "Unknown error",
						type: error instanceof Error ? error.name : "UnknownError",
					};
					return json(
						{ error: "Failed to fetch suggestions" },
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
