import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createCategory, createDbFromHyperdrive, listCategories } from "@/db";

export const Route = createFileRoute("/api/categories")({
	server: {
		handlers: {
			GET: async () => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "GET",
					path: "/api/categories",
					timestamp: new Date().toISOString(),
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const results = await listCategories(db);

					wideEvent.categories_count = results.length;
					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json({ categories: results });
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
									: "Failed to fetch categories",
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
					path: "/api/categories",
					timestamp: new Date().toISOString(),
				};

				try {
					const body = await request.json();
					const { name, color } = body as {
						name?: string;
						color?: string;
					};

					if (!name || typeof name !== "string" || name.trim() === "") {
						wideEvent.status_code = 400;
						wideEvent.outcome = "validation_error";
						wideEvent.error = { message: "Name is required" };
						return json({ error: "Name is required" }, { status: 400 });
					}

					wideEvent.category_name = name;

					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const newCategory = await createCategory(db, name, color);

					wideEvent.category_id = newCategory.id;
					wideEvent.status_code = 201;
					wideEvent.outcome = "success";

					return json(newCategory, { status: 201 });
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
									: "Failed to create category",
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
