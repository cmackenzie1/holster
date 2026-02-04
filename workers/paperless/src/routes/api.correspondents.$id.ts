import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
	createDbFromHyperdrive,
	getCorrespondentById,
	updateCorrespondent,
	softDeleteCorrespondent,
} from "@/db";

export const Route = createFileRoute("/api/correspondents/$id")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/correspondents/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const correspondent = await getCorrespondentById(
						db,
						BigInt(params.id),
					);

					if (!correspondent) {
						wideEvent.correspondent = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Correspondent not found" }, { status: 404 });
					}

					wideEvent.correspondent = { id: params.id, found: true };
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json(correspondent);
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
									: "Failed to fetch correspondent",
						},
						{ status: 500 },
					);
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},

			PATCH: async ({
				params,
				request,
			}: {
				params: { id: string };
				request: Request;
			}) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "PATCH",
					path: "/api/correspondents/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const body = await request.json();
					const { name } = body as { name?: string };

					if (
						name !== undefined &&
						(typeof name !== "string" || name.trim() === "")
					) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "Name cannot be empty" };
						return json({ error: "Name cannot be empty" }, { status: 400 });
					}

					if (name === undefined) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "No fields to update" };
						return json({ error: "No fields to update" }, { status: 400 });
					}

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const updated = await updateCorrespondent(
						db,
						BigInt(params.id),
						name,
					);

					if (!updated) {
						wideEvent.correspondent = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Correspondent not found" }, { status: 404 });
					}

					wideEvent.correspondent = { id: params.id, found: true };
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

			DELETE: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "DELETE",
					path: "/api/correspondents/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const deleted = await softDeleteCorrespondent(db, BigInt(params.id));

					if (!deleted) {
						wideEvent.correspondent = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Correspondent not found" }, { status: 404 });
					}

					wideEvent.correspondent = { id: params.id, found: true };
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
									: "Failed to delete correspondent",
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
