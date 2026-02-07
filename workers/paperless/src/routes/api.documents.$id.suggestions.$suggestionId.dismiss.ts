import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createDbFromHyperdrive, dismissSuggestion } from "@/db";

export const Route = createFileRoute(
	"/api/documents/$id/suggestions/$suggestionId/dismiss",
)({
	server: {
		handlers: {
			POST: async ({
				params,
			}: {
				params: { id: string; suggestionId: string };
			}) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "POST",
					path: "/api/documents/$id/suggestions/$suggestionId/dismiss",
					timestamp: new Date().toISOString(),
					params: { id: params.id, suggestionId: params.suggestionId },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const dismissed = await dismissSuggestion(
						db,
						BigInt(params.suggestionId),
					);

					if (!dismissed) {
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Suggestion not found" }, { status: 404 });
					}

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
						{ error: "Failed to dismiss suggestion" },
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
