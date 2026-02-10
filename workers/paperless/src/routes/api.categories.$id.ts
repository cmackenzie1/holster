import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	createDbFromHyperdrive,
	getCategoryById,
	softDeleteCategory,
	updateCategory,
} from "@/db";

export const Route = createFileRoute("/api/categories/$id")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/categories/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const category = await getCategoryById(db, BigInt(params.id));

					if (!category) {
						wideEvent.category = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Category not found" }, { status: 404 });
					}

					wideEvent.category = { id: params.id, found: true };
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json(category);
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
									: "Failed to fetch category",
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
					path: "/api/categories/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const body = await request.json();
					const { name, color } = body as {
						name?: string;
						color?: string | null;
					};

					if (
						name !== undefined &&
						(typeof name !== "string" || name.trim() === "")
					) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "Name cannot be empty" };
						return json({ error: "Name cannot be empty" }, { status: 400 });
					}

					if (name === undefined && color === undefined) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "No fields to update" };
						return json({ error: "No fields to update" }, { status: 400 });
					}

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const updates: { name?: string; color?: string | null } = {};
					if (name !== undefined) updates.name = name;
					if (color !== undefined) updates.color = color;

					const updated = await updateCategory(db, BigInt(params.id), updates);

					if (!updated) {
						wideEvent.category = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Category not found" }, { status: 404 });
					}

					wideEvent.category = { id: params.id, found: true };
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

			DELETE: async ({ params }: { params: { id: string } }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "DELETE",
					path: "/api/categories/$id",
					timestamp: new Date().toISOString(),
					params: { id: params.id },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const deleted = await softDeleteCategory(db, BigInt(params.id));

					if (!deleted) {
						wideEvent.category = { id: params.id, found: false };
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Category not found" }, { status: 404 });
					}

					wideEvent.category = { id: params.id, found: true };
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
									: "Failed to delete category",
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
