import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
	createDbFromHyperdrive,
	getTagById,
	updateTag,
	softDeleteTag,
} from "@/db";

export const Route = createFileRoute("/api/tags/$id")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/tags/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const tag = await getTagById(db, BigInt(params.id));

					if (!tag) {
						wideEvent.tag = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Tag not found" }, { status: 404 });
					}

					wideEvent.tag = { id: params.id, found: true };
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json(tag);
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
								error instanceof Error ? error.message : "Failed to fetch tag",
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
					path: "/api/tags/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const body = await request.json();
					const { name, color } = body as { name?: string; color?: string };

					if (
						name !== undefined &&
						(typeof name !== "string" || name.trim() === "")
					) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "Name cannot be empty" };
						return json({ error: "Name cannot be empty" }, { status: 400 });
					}

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const updated = await updateTag(db, BigInt(params.id), {
						name,
						color,
					});

					if (!updated) {
						wideEvent.tag = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Tag not found" }, { status: 404 });
					}

					wideEvent.tag = { id: params.id, found: true };
					wideEvent.updated_fields = Object.keys({ name, color }).filter(
						(k) => (body as Record<string, unknown>)[k] !== undefined,
					);
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
								error instanceof Error ? error.message : "Failed to update tag",
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
					path: "/api/tags/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const deleted = await softDeleteTag(db, BigInt(params.id));

					if (!deleted) {
						wideEvent.tag = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Tag not found" }, { status: 404 });
					}

					wideEvent.tag = { id: params.id, found: true };
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
								error instanceof Error ? error.message : "Failed to delete tag",
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
