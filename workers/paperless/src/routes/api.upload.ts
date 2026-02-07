import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createDbFromHyperdrive, createDocumentWithFile } from "@/db";

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const startTime = Date.now();
				const wideEvent: Record<string, unknown> = {
					method: "POST",
					path: "/api/upload",
					timestamp: new Date().toISOString(),
				};

				let response: Response;

				try {
					const formData = await request.formData();
					const file = formData.get("file") as File | null;
					const thumbnail = formData.get("thumbnail") as File | null;

					if (!file) {
						wideEvent.status_code = 400;
						wideEvent.outcome = "error";
						wideEvent.error = {
							message: "No file provided",
							type: "ValidationError",
						};
						response = json({ error: "No file provided" }, { status: 400 });
						return response;
					}

					// Add file context to wide event
					wideEvent.file = {
						name: file.name,
						size: file.size,
						type: file.type || "application/octet-stream",
					};

					const db = createDbFromHyperdrive(env.HYPERDRIVE);
					const r2 = env.R2;

					// Generate object key with timestamp prefix for uniqueness
					const timestamp = Date.now();
					const objectKey = `documents/${timestamp}/${file.name}`;
					wideEvent.object_key = objectKey;

					// Read file content
					const arrayBuffer = await file.arrayBuffer();
					const uint8Array = new Uint8Array(arrayBuffer);

					// Calculate MD5 hash
					const hashBuffer = await crypto.subtle.digest("MD5", uint8Array);
					const hashArray = Array.from(new Uint8Array(hashBuffer));
					const md5Hash = hashArray
						.map((b) => b.toString(16).padStart(2, "0"))
						.join("");
					wideEvent.file_md5 = md5Hash;

					// Upload to R2
					await r2.put(objectKey, uint8Array, {
						httpMetadata: {
							contentType: file.type || "application/octet-stream",
						},
					});
					wideEvent.r2_upload = true;

					// Upload thumbnail if provided
					let thumbnailKey: string | null = null;
					if (thumbnail) {
						thumbnailKey = `thumbnails/${timestamp}/${file.name}.jpg`;
						const thumbArrayBuffer = await thumbnail.arrayBuffer();
						await r2.put(thumbnailKey, new Uint8Array(thumbArrayBuffer), {
							httpMetadata: {
								contentType: "image/jpeg",
							},
						});
						wideEvent.thumbnail_key = thumbnailKey;
					}

					// Extract title from filename (remove extension)
					const title = file.name.replace(/\.[^/.]+$/, "");

					// Create document and file records
					const mimeType = file.type || "application/octet-stream";
					const newDocument = await createDocumentWithFile(db, {
						title,
						objectKey,
						mimeType,
						sizeBytes: BigInt(file.size),
						md5Hash,
						thumbnailKey,
					});

					wideEvent.document = {
						id: newDocument.id,
						title,
					};
					wideEvent.file_record_created = true;

					// Enqueue async document processing
					await env.DOCUMENT_PROCESS_QUEUE.send({
						documentId: newDocument.id,
						objectKey,
						mimeType,
					});
					wideEvent.queued = true;

					wideEvent.status_code = 200;
					wideEvent.outcome = "success";

					response = json({
						success: true,
						documentId: newDocument.id,
						title,
					});
					return response;
				} catch (error) {
					wideEvent.status_code = 500;
					wideEvent.outcome = "error";
					wideEvent.error = {
						message: error instanceof Error ? error.message : "Upload failed",
						type: error instanceof Error ? error.name : "UnknownError",
					};

					response = json(
						{
							error: error instanceof Error ? error.message : "Upload failed",
						},
						{ status: 500 },
					);
					return response;
				} finally {
					wideEvent.duration_ms = Date.now() - startTime;
					console.log(JSON.stringify(wideEvent));
				}
			},
		},
	},
});
