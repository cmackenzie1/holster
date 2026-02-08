import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	acceptSuggestion,
	addDocumentTag,
	createCorrespondent,
	createDbFromHyperdrive,
	createTag,
	updateDocument,
	updateDocumentCorrespondent,
} from "@/db";

export const Route = createFileRoute(
	"/api/documents/$id/suggestions/$suggestionId/accept",
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
					path: "/api/documents/$id/suggestions/$suggestionId/accept",
					timestamp: new Date().toISOString(),
					params: { id: params.id, suggestionId: params.suggestionId },
				};

				try {
					const db = createDbFromHyperdrive(env.HYPERDRIVE);

					const suggestion = await acceptSuggestion(
						db,
						BigInt(params.suggestionId),
					);

					if (!suggestion) {
						wideEvent.status_code = 404;
						wideEvent.outcome = "not_found";
						return json({ error: "Suggestion not found" }, { status: 404 });
					}

					wideEvent.suggestion = {
						type: suggestion.type,
						name: suggestion.name,
					};

					if (suggestion.type === "tag") {
						let tagId = suggestion.tagId;
						if (!tagId) {
							const newTag = await createTag(db, suggestion.name);
							tagId = newTag.id;
							wideEvent.created_tag = tagId;
						}
						await addDocumentTag(db, BigInt(params.id), BigInt(tagId));
					} else if (suggestion.type === "correspondent") {
						let correspondentId = suggestion.correspondentId;
						if (!correspondentId) {
							const newCorrespondent = await createCorrespondent(
								db,
								suggestion.name,
							);
							correspondentId = newCorrespondent.id;
							wideEvent.created_correspondent = correspondentId;
						}
						await updateDocumentCorrespondent(
							db,
							BigInt(params.id),
							BigInt(correspondentId),
						);
					} else if (suggestion.type === "title") {
						await updateDocument(db, BigInt(params.id), {
							title: suggestion.name,
						});
					} else if (suggestion.type === "date") {
						await updateDocument(db, BigInt(params.id), {
							documentDate: suggestion.name,
						});
					}

					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					return json({ success: true, suggestion });
				} catch (error) {
					wideEvent.status_code = 500;
					wideEvent.outcome = "error";
					wideEvent.error = {
						message: error instanceof Error ? error.message : "Unknown error",
						type: error instanceof Error ? error.name : "UnknownError",
					};
					return json(
						{ error: "Failed to accept suggestion" },
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
