import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	createCorrespondent,
	createDbFromHyperdrive,
	listCorrespondents,
} from "@/db";

export const Route = createFileRoute("/api/correspondents")({
	server: {
		handlers: {
			GET: async () => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/correspondents",
					timestamp: new Date().toISOString(),
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const results = await listCorrespondents(db);

					wideEvent.correspondents_count = results.length;
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json({ correspondents: results });
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
									: "Failed to fetch correspondents",
						},
						{ status: 500 },
					);
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},

			POST: async ({ request }: { request: Request }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "POST",
					path: "/api/correspondents",
					timestamp: new Date().toISOString(),
				};

				try {
					const body = await request.json();
					const { name } = body as { name?: string };

					if (!name || typeof name !== "string" || name.trim() === "") {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "Name is required" };
						return json({ error: "Name is required" }, { status: 400 });
					}

					wideEvent.correspondent_name = name;

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const newCorrespondent = await createCorrespondent(db, name);

					wideEvent.correspondent_id = newCorrespondent.id;
					wideEvent.status_code = 201;
					wideEvent.outcome = "success";

					return json(newCorrespondent, { status: 201 });
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
									: "Failed to create correspondent",
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
