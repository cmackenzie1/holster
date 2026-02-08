import { env } from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";
import { eq } from "drizzle-orm";
import PostalMime from "postal-mime";
import {
	createDbFromHyperdrive,
	createDocumentWithFile,
	createSuggestions,
	deletePendingSuggestionsForDocument,
	documents,
	documentTags,
	findFileByMd5Hash,
	listCorrespondents,
	listTags,
	permanentlyDeleteOldDocuments,
	recordIncomingEmail,
	updateDocumentContent,
} from "./db";
import type { NewDocumentSuggestion } from "./db/schema/document-suggestions";
import type { DocumentProcessMessage } from "./queue/types";
import { generateSuggestions } from "./utils/ai-suggestions";
import { verifyCloudflareAccess } from "./utils/cloudflare-access";
import { postProcessContent } from "./utils/post-process";
import { extractWithTika } from "./utils/tika";

export { TikaContainer } from "./utils/tika-container";

interface EmailMessage {
	readonly from: string;
	readonly to: string;
	readonly headers: Headers;
	readonly raw: ReadableStream<Uint8Array>;
	readonly rawSize: number;
	setReject(reason: string): void;
	forward(to: string, headers?: Headers): Promise<void>;
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Skip auth for static assets
		const isStaticAsset =
			url.pathname.startsWith("/_build/") ||
			url.pathname.startsWith("/assets/") ||
			url.pathname.endsWith(".css") ||
			url.pathname.endsWith(".js") ||
			url.pathname.endsWith(".map") ||
			url.pathname.endsWith(".ico") ||
			url.pathname.endsWith(".png") ||
			url.pathname.endsWith(".jpg") ||
			url.pathname.endsWith(".svg") ||
			url.pathname.endsWith(".woff") ||
			url.pathname.endsWith(".woff2");

		if (!isStaticAsset) {
			const result = await verifyCloudflareAccess(request);

			if (!result.valid) {
				console.log(
					JSON.stringify({
						event: "cloudflare_access_denied",
						path: url.pathname,
						error: result.error,
						timestamp: new Date().toISOString(),
					}),
				);

				return new Response("Unauthorized", {
					status: 401,
					headers: {
						"Content-Type": "text/plain",
					},
				});
			}
		}

		return handler.fetch(request);
	},

	async email(message: EmailMessage): Promise<void> {
		const startTime = Date.now();
		const wideEvent: Record<string, unknown> = {
			event: "email_received",
			timestamp: new Date().toISOString(),
			from: message.from,
			to: message.to,
			rawSize: message.rawSize,
		};

		try {
			// Check if sender is allowed
			const allowedSenders = (env.ALLOWED_EMAIL_SENDERS as string)
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean);

			const senderEmail = message.from.toLowerCase();
			const isAllowed =
				allowedSenders.length === 0 ||
				allowedSenders.some(
					(allowed) =>
						senderEmail === allowed || senderEmail.endsWith(`<${allowed}>`),
				);

			if (!isAllowed) {
				wideEvent.status = "ignored";
				wideEvent.reason = "sender_not_allowed";
				message.setReject("Sender not authorized");
				return;
			}

			// Read raw email stream
			const rawEmail = await streamToArrayBuffer(message.raw);
			wideEvent.rawEmailBytes = rawEmail.byteLength;

			// Store raw email in R2
			const timestamp = Date.now();
			const rawEmailKey = `emails/${timestamp}/${sanitizeFilename(message.from)}.eml`;
			await env.R2.put(rawEmailKey, rawEmail, {
				httpMetadata: { contentType: "message/rfc822" },
			});
			wideEvent.rawEmailKey = rawEmailKey;

			// Parse email with postal-mime
			const parsed = await PostalMime.parse(rawEmail);
			wideEvent.subject = parsed.subject;
			wideEvent.attachmentCount = parsed.attachments?.length ?? 0;

			const db = createDbFromHyperdrive(env.HYPERDRIVE);

			// Filter to valid attachments (with filename and content)
			const validAttachments = (parsed.attachments ?? []).filter(
				(att) =>
					att.filename &&
					att.content &&
					(typeof att.content === "string"
						? att.content.length > 0
						: att.content.byteLength > 0),
			);

			if (validAttachments.length === 0) {
				// No valid attachments - record as ignored
				await recordIncomingEmail(db, {
					from: message.from,
					to: message.to,
					subject: parsed.subject ?? null,
					rawEmailKey,
					rawEmailSize: BigInt(rawEmail.byteLength),
					status: "ignored",
					documentsCreated: 0,
					errorMessage: "No valid attachments found",
				});

				wideEvent.status = "ignored";
				wideEvent.reason = "no_attachments";
				return;
			}

			// Process each attachment as a document
			const createdDocuments: { id: string; title: string }[] = [];

			for (const attachment of validAttachments) {
				const filename = attachment.filename ?? "unnamed";
				// Handle both ArrayBuffer and string content from postal-mime
				const content =
					typeof attachment.content === "string"
						? new TextEncoder().encode(attachment.content)
						: new Uint8Array(attachment.content);

				// Generate R2 key
				const objectKey = `documents/${timestamp}/${filename}`;

				// Calculate MD5 hash
				const hashBuffer = await crypto.subtle.digest("MD5", content);
				const hashArray = Array.from(new Uint8Array(hashBuffer));
				const md5Hash = hashArray
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");

				// Skip duplicate files
				const existingFile = await findFileByMd5Hash(db, md5Hash);
				if (existingFile) {
					wideEvent.duplicateSkipped = wideEvent.duplicateSkipped
						? (wideEvent.duplicateSkipped as number) + 1
						: 1;
					continue;
				}

				// Upload to R2
				await env.R2.put(objectKey, content, {
					httpMetadata: {
						contentType: attachment.mimeType || "application/octet-stream",
					},
				});

				// Extract title from filename (remove extension)
				const title = filename.replace(/\.[^/.]+$/, "");

				// Create document and file records
				const mimeType = attachment.mimeType || "application/octet-stream";
				const newDocument = await createDocumentWithFile(db, {
					title,
					objectKey,
					mimeType,
					sizeBytes: BigInt(content.byteLength),
					md5Hash,
				});

				// Enqueue async document processing
				await env.DOCUMENT_PROCESS_QUEUE.send({
					documentId: newDocument.id,
					objectKey,
					mimeType,
				});

				createdDocuments.push({
					id: newDocument.id,
					title,
				});
			}

			// Record successful import
			await recordIncomingEmail(db, {
				from: message.from,
				to: message.to,
				subject: parsed.subject ?? null,
				rawEmailKey,
				rawEmailSize: BigInt(rawEmail.byteLength),
				status: "processed",
				documentsCreated: createdDocuments.length,
			});

			wideEvent.status = "processed";
			wideEvent.documentsCreated = createdDocuments;
		} catch (error) {
			wideEvent.status = "failed";
			wideEvent.error = {
				message: error instanceof Error ? error.message : "Unknown error",
				type: error instanceof Error ? error.name : "UnknownError",
			};

			// Try to record the failure
			try {
				const db = createDbFromHyperdrive(env.HYPERDRIVE);
				await recordIncomingEmail(db, {
					from: message.from,
					to: message.to,
					subject: null,
					rawEmailKey: `emails/${Date.now()}/failed.eml`,
					rawEmailSize: BigInt(message.rawSize),
					status: "failed",
					documentsCreated: 0,
					errorMessage:
						error instanceof Error ? error.message : "Unknown error",
				});
			} catch {
				// Ignore secondary failure
			}
		} finally {
			wideEvent.duration_ms = Date.now() - startTime;
			console.log(JSON.stringify(wideEvent));
		}
	},

	async scheduled(_controller: ScheduledController): Promise<void> {
		const startTime = Date.now();
		const wideEvent: Record<string, unknown> = {
			event: "scheduled_trash_cleanup",
			timestamp: new Date().toISOString(),
		};

		try {
			const db = createDbFromHyperdrive(env.HYPERDRIVE);
			const { deletedCount, objectKeys } =
				await permanentlyDeleteOldDocuments(db);

			// Delete R2 objects for permanently deleted documents
			if (objectKeys.length > 0) {
				await Promise.all(objectKeys.map((key) => env.R2.delete(key)));
			}

			wideEvent.outcome = "success";
			wideEvent.deletedCount = deletedCount;
			wideEvent.r2ObjectsDeleted = objectKeys.length;
		} catch (error) {
			wideEvent.outcome = "error";
			wideEvent.error = {
				message:
					error instanceof Error ? error.message : "Trash cleanup failed",
				type: error instanceof Error ? error.name : "UnknownError",
			};
		} finally {
			wideEvent.duration_ms = Date.now() - startTime;
			console.log(JSON.stringify(wideEvent));
		}
	},

	async queue(batch: MessageBatch<DocumentProcessMessage>): Promise<void> {
		for (const msg of batch.messages) {
			const startTime = Date.now();
			const wideEvent: Record<string, unknown> = {
				event: "queue_process_document",
				timestamp: new Date().toISOString(),
				documentId: msg.body.documentId,
				objectKey: msg.body.objectKey,
				mimeType: msg.body.mimeType,
			};

			try {
				const { documentId, objectKey, mimeType } = msg.body;

				// Fetch file from R2
				const r2Object = await env.R2.get(objectKey);
				if (!r2Object) {
					wideEvent.outcome = "error";
					wideEvent.error = { message: "Object not found in R2" };
					msg.ack();
					continue;
				}

				wideEvent.file_size = r2Object.size;

				// Extract with Tika
				const tikaResult = await extractWithTika(
					env.TIKA_CONTAINER,
					r2Object.body,
					mimeType,
				);

				wideEvent.tika = {
					contentLength: tikaResult.content.length,
					contentType: tikaResult.contentType,
				};

				// Post-process extracted content
				const processed = postProcessContent(tikaResult.content);

				wideEvent.postProcess = {
					rawLength: processed.rawLength,
					processedLength: processed.processedLength,
					reductionPercent: processed.reductionPercent,
				};

				// Update document content in DB
				const db = createDbFromHyperdrive(env.HYPERDRIVE);
				await updateDocumentContent(db, BigInt(documentId), processed.content);

				// Generate AI suggestions (non-blocking — failures are logged but don't fail the message)
				try {
					// Clear stale pending suggestions before generating new ones (handles reprocessing)
					await deletePendingSuggestionsForDocument(db, BigInt(documentId));

					const [existingTags, existingCorrespondents] = await Promise.all([
						listTags(db),
						listCorrespondents(db),
					]);

					const docId = BigInt(documentId);
					const [[doc], currentDocTags] = await Promise.all([
						db
							.select({
								title: documents.title,
								correspondentId: documents.correspondentId,
								documentDate: documents.documentDate,
							})
							.from(documents)
							.where(eq(documents.id, docId))
							.limit(1),
						db
							.select({ tagId: documentTags.tagId })
							.from(documentTags)
							.where(eq(documentTags.documentId, docId)),
					]);

					const aiResult = await generateSuggestions(env.AI, {
						documentTitle: doc?.title ?? "",
						documentContent: processed.content,
						existingTags,
						existingCorrespondents,
					});

					const aiSuggestions = aiResult.suggestions;

					// Filter out suggestions for tags/correspondents already on the document
					const currentTagIds = new Set(
						currentDocTags.map((t) => t.tagId.toString()),
					);
					const currentCorrespondentId =
						doc?.correspondentId?.toString() ?? null;

					const currentTitle = doc?.title?.toLowerCase() ?? "";
					const hasDocumentDate = doc?.documentDate !== null;
					const filtered = aiSuggestions.filter((s) => {
						if (s.type === "title")
							return s.name.toLowerCase() !== currentTitle;
						if (s.type === "date") return !hasDocumentDate;
						if (!s.matchedId) return true;
						if (s.type === "tag") return !currentTagIds.has(s.matchedId);
						return s.matchedId !== currentCorrespondentId;
					});

					if (filtered.length > 0) {
						const suggestionRows: NewDocumentSuggestion[] = filtered.map(
							(s) => ({
								documentId: BigInt(documentId),
								type: s.type,
								name: s.name,
								confidence: s.confidence.toFixed(3),
								tagId:
									s.type === "tag" && s.matchedId ? BigInt(s.matchedId) : null,
								correspondentId:
									s.type === "correspondent" && s.matchedId
										? BigInt(s.matchedId)
										: null,
							}),
						);
						await createSuggestions(db, suggestionRows);
					}

					wideEvent.ai_suggestions = {
						model: aiResult.model,
						generated: aiSuggestions.length,
						filtered_out: aiSuggestions.length - filtered.length,
						stored: filtered.length,
						tags: filtered.filter((s) => s.type === "tag").length,
						correspondents: filtered.filter((s) => s.type === "correspondent")
							.length,
						titles: filtered.filter((s) => s.type === "title").length,
						dates: filtered.filter((s) => s.type === "date").length,
						rawResponse: aiResult.rawResponse,
						parseError: aiResult.parseError,
					};
				} catch (aiError) {
					wideEvent.ai_suggestions = {
						outcome: "error",
						error:
							aiError instanceof Error
								? aiError.message
								: "AI suggestion failed",
					};
				}

				wideEvent.outcome = "success";
				msg.ack();
			} catch (error) {
				wideEvent.outcome = "error";
				wideEvent.error = {
					message: error instanceof Error ? error.message : "Processing failed",
					type: error instanceof Error ? error.name : "UnknownError",
				};
				msg.retry();
			} finally {
				wideEvent.duration_ms = Date.now() - startTime;
				console.log(JSON.stringify(wideEvent));
			}
		}
	},
};

async function streamToArrayBuffer(
	stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;

	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}

function sanitizeFilename(input: string): string {
	return input
		.replace(/[<>:"/\\|?*]/g, "_")
		.replace(/\s+/g, "_")
		.substring(0, 100);
}
