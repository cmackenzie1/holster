import {
	eq,
	and,
	or,
	isNull,
	isNotNull,
	desc,
	inArray,
	lt,
	ilike,
	sql,
} from "drizzle-orm";
import type { Database } from "../index";
import {
	documents,
	files,
	correspondents,
	tags,
	documentTags,
} from "../schema";

export interface DocumentWithRelations {
	id: string;
	title: string;
	content: string | null;
	archiveSerialNumber: number | null;
	dateCreated: string | null;
	createdAt: string;
	updatedAt: string;
	correspondent: { id: string; name: string } | null;
	tags: Array<{ id: string; name: string; color: string | null }>;
	files: Array<{
		id: string;
		objectKey: string;
		mimeType: string;
		sizeBytes: string;
		md5Hash: string | null;
		createdAt: string;
	}>;
}

export interface DocumentListItem {
	id: string;
	title: string;
	archiveSerialNumber: number | null;
	dateCreated: string | null;
	createdAt: string;
	correspondent: string | null;
	tags: Array<{ id: bigint; name: string; color: string | null }>;
	primaryFile: {
		objectKey: string;
		mimeType: string;
		thumbnailKey: string | null;
	} | null;
}

export interface PaginatedDocuments {
	items: DocumentListItem[];
	nextCursor: string | null;
	hasMore: boolean;
}

/**
 * Get a document by ID, ensuring it's not soft-deleted.
 * Returns null if not found or deleted.
 */
export async function getDocumentById(
	db: Database,
	id: bigint,
): Promise<DocumentWithRelations | null> {
	// Fetch document with soft-delete filter
	const [doc] = await db
		.select()
		.from(documents)
		.where(and(eq(documents.id, id), isNull(documents.deletedAt)))
		.limit(1);

	if (!doc) {
		return null;
	}

	// Fetch files (also filter soft-deleted)
	const docFiles = await db
		.select()
		.from(files)
		.where(and(eq(files.documentId, doc.id), isNull(files.deletedAt)));

	// Fetch correspondent if exists (also filter soft-deleted)
	let correspondent = null;
	if (doc.correspondentId) {
		const [corr] = await db
			.select()
			.from(correspondents)
			.where(
				and(
					eq(correspondents.id, doc.correspondentId),
					isNull(correspondents.deletedAt),
				),
			)
			.limit(1);
		correspondent = corr;
	}

	// Fetch tags (filter soft-deleted tags)
	const docTags = await db
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
		})
		.from(documentTags)
		.innerJoin(tags, eq(documentTags.tagId, tags.id))
		.where(and(eq(documentTags.documentId, doc.id), isNull(tags.deletedAt)));

	return {
		id: doc.id.toString(),
		title: doc.title,
		content: doc.content,
		archiveSerialNumber: doc.archiveSerialNumber,
		dateCreated: doc.dateCreated?.toISOString() ?? null,
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
		correspondent: correspondent
			? { id: correspondent.id.toString(), name: correspondent.name }
			: null,
		tags: docTags.map((t) => ({
			id: t.id.toString(),
			name: t.name,
			color: t.color,
		})),
		files: docFiles.map((f) => ({
			id: f.id.toString(),
			objectKey: f.objectKey,
			mimeType: f.mimeType,
			sizeBytes: f.sizeBytes.toString(),
			md5Hash: f.md5Hash,
			createdAt: f.createdAt.toISOString(),
		})),
	};
}

/**
 * Get a list of documents with cursor-based pagination, optionally filtered by tags and search.
 * All results exclude soft-deleted records.
 *
 * Cursor-based pagination uses the document ID as the cursor, which is more
 * performant than offset-based pagination for large datasets. Instead of
 * scanning all rows up to the offset, it uses an indexed WHERE clause.
 *
 * @param cursor - The ID of the last document from the previous page (for pagination)
 * @param search - Search query to filter by title, content, or correspondent name
 */
export async function listDocuments(
	db: Database,
	options: {
		filterTagIds?: string[];
		limit?: number;
		cursor?: string;
		search?: string;
	} = {},
): Promise<PaginatedDocuments> {
	const { filterTagIds = [], limit = 50, cursor, search } = options;

	// If filtering by tags, first get document IDs that have ALL selected tags
	let filteredDocumentIds: bigint[] | null = null;

	if (filterTagIds.length > 0) {
		const tagIdsBigInt = filterTagIds.map((id) => BigInt(id));

		// Get documents that have at least one of the selected tags
		const docsWithTags = await db
			.select({ documentId: documentTags.documentId })
			.from(documentTags)
			.innerJoin(tags, eq(documentTags.tagId, tags.id))
			.where(
				and(inArray(documentTags.tagId, tagIdsBigInt), isNull(tags.deletedAt)),
			);

		// Count how many selected tags each document has
		const tagCountByDoc = new Map<string, number>();
		for (const row of docsWithTags) {
			const key = row.documentId.toString();
			tagCountByDoc.set(key, (tagCountByDoc.get(key) || 0) + 1);
		}

		// Filter to docs that have ALL selected tags
		filteredDocumentIds = Array.from(tagCountByDoc.entries())
			.filter(([, count]) => count >= filterTagIds.length)
			.map(([id]) => BigInt(id));

		// If no documents match, return empty result early
		if (filteredDocumentIds.length === 0) {
			return { items: [], nextCursor: null, hasMore: false };
		}
	}

	// Build the where clause - always filter soft-deleted
	const whereConditions = [isNull(documents.deletedAt)];
	if (filteredDocumentIds !== null) {
		whereConditions.push(inArray(documents.id, filteredDocumentIds));
	}

	// Cursor-based pagination: fetch items with id < cursor (for descending order)
	if (cursor) {
		whereConditions.push(lt(documents.id, BigInt(cursor)));
	}

	// Search filter: full-text search on title/content, ilike on correspondent name
	const searchTerm = search?.trim() || null;

	// Fetch one extra to determine if there are more pages
	const results = await db
		.select({
			id: documents.id,
			title: documents.title,
			archiveSerialNumber: documents.archiveSerialNumber,
			dateCreated: documents.dateCreated,
			createdAt: documents.createdAt,
			correspondent: {
				id: correspondents.id,
				name: correspondents.name,
			},
		})
		.from(documents)
		.leftJoin(
			correspondents,
			and(
				eq(documents.correspondentId, correspondents.id),
				isNull(correspondents.deletedAt),
			),
		)
		.where(
			and(
				...whereConditions,
				searchTerm
					? or(
							sql`${documents.searchVector} @@ plainto_tsquery('english', ${searchTerm})`,
							ilike(correspondents.name, `%${searchTerm}%`),
						)
					: undefined,
			),
		)
		.orderBy(desc(documents.createdAt), desc(documents.id))
		.limit(limit + 1);

	// Check if there are more results
	const hasMore = results.length > limit;
	const pageResults = hasMore ? results.slice(0, limit) : results;

	// Fetch tags for each document
	const documentIds = pageResults.map((r) => r.id);
	const documentTagsResult =
		documentIds.length > 0
			? await db
					.select({
						documentId: documentTags.documentId,
						tagId: tags.id,
						tagName: tags.name,
						tagColor: tags.color,
					})
					.from(documentTags)
					.innerJoin(tags, eq(documentTags.tagId, tags.id))
					.where(
						and(
							inArray(documentTags.documentId, documentIds),
							isNull(tags.deletedAt),
						),
					)
			: [];

	// Group tags by document
	const tagsByDocument = new Map<
		string,
		Array<{ id: bigint; name: string; color: string | null }>
	>();
	for (const dt of documentTagsResult) {
		const key = dt.documentId.toString();
		if (!tagsByDocument.has(key)) {
			tagsByDocument.set(key, []);
		}
		tagsByDocument.get(key)?.push({
			id: dt.tagId ?? 0n,
			name: dt.tagName ?? "",
			color: dt.tagColor,
		});
	}

	// Fetch primary file for each document (first file by creation date)
	const documentFilesResult =
		documentIds.length > 0
			? await db
					.select({
						documentId: files.documentId,
						objectKey: files.objectKey,
						mimeType: files.mimeType,
						thumbnailKey: files.thumbnailKey,
					})
					.from(files)
					.where(
						and(
							inArray(files.documentId, documentIds),
							isNull(files.deletedAt),
						),
					)
			: [];

	// Group files by document (keep only the first one)
	const primaryFileByDocument = new Map<
		string,
		{ objectKey: string; mimeType: string; thumbnailKey: string | null }
	>();
	for (const file of documentFilesResult) {
		const key = file.documentId.toString();
		if (!primaryFileByDocument.has(key)) {
			primaryFileByDocument.set(key, {
				objectKey: file.objectKey,
				mimeType: file.mimeType,
				thumbnailKey: file.thumbnailKey,
			});
		}
	}

	const items = pageResults.map((doc) => ({
		id: doc.id.toString(),
		title: doc.title,
		archiveSerialNumber: doc.archiveSerialNumber,
		dateCreated: doc.dateCreated?.toISOString() ?? null,
		createdAt: doc.createdAt.toISOString(),
		correspondent: doc.correspondent?.name ?? null,
		tags: tagsByDocument.get(doc.id.toString()) ?? [],
		primaryFile: primaryFileByDocument.get(doc.id.toString()) ?? null,
	}));

	// The next cursor is the id of the last item in the current page
	const nextCursor =
		hasMore && items.length > 0 ? items[items.length - 1].id : null;

	return { items, nextCursor, hasMore };
}

/**
 * Update a document's metadata (title, content, etc.).
 * Returns true if updated, false if document not found.
 */
export async function updateDocument(
	db: Database,
	id: bigint,
	updates: {
		title?: string;
		content?: string | null;
		archiveSerialNumber?: number | null;
	},
): Promise<boolean> {
	// Check if document exists and is not deleted
	const [existing] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.id, id), isNull(documents.deletedAt)))
		.limit(1);

	if (!existing) {
		return false;
	}

	const updateData: {
		title?: string;
		content?: string | null;
		archiveSerialNumber?: number | null;
	} = {};

	if (updates.title !== undefined) updateData.title = updates.title.trim();
	if (updates.content !== undefined) updateData.content = updates.content;
	if (updates.archiveSerialNumber !== undefined)
		updateData.archiveSerialNumber = updates.archiveSerialNumber;

	if (Object.keys(updateData).length > 0) {
		await db.update(documents).set(updateData).where(eq(documents.id, id));
	}

	return true;
}

/**
 * Soft-delete a document by ID.
 * Returns true if deleted, false if not found.
 */
export async function softDeleteDocument(
	db: Database,
	id: bigint,
): Promise<boolean> {
	// Check if document exists and is not already deleted
	const [existing] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.id, id), isNull(documents.deletedAt)))
		.limit(1);

	if (!existing) {
		return false;
	}

	// Soft delete the document
	await db
		.update(documents)
		.set({ deletedAt: new Date() })
		.where(eq(documents.id, id));

	return true;
}

/**
 * Update a document's correspondent.
 * Returns true if updated, false if document not found.
 */
export async function updateDocumentCorrespondent(
	db: Database,
	documentId: bigint,
	correspondentId: bigint | null,
): Promise<{ success: boolean; error?: string }> {
	// Check if document exists and is not deleted
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
		.limit(1);

	if (!doc) {
		return { success: false, error: "Document not found" };
	}

	// If correspondentId is provided, verify it exists and is not deleted
	if (correspondentId !== null) {
		const [correspondent] = await db
			.select({ id: correspondents.id })
			.from(correspondents)
			.where(
				and(
					eq(correspondents.id, correspondentId),
					isNull(correspondents.deletedAt),
				),
			)
			.limit(1);

		if (!correspondent) {
			return { success: false, error: "Correspondent not found" };
		}
	}

	// Update the document's correspondent
	await db
		.update(documents)
		.set({ correspondentId })
		.where(eq(documents.id, documentId));

	return { success: true };
}

/**
 * Update a document's tags (replace all tags).
 * Returns true if updated, false if document not found.
 */
export async function updateDocumentTags(
	db: Database,
	documentId: bigint,
	tagIds: bigint[],
): Promise<{ success: boolean; error?: string }> {
	// Check if document exists and is not deleted
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
		.limit(1);

	if (!doc) {
		return { success: false, error: "Document not found" };
	}

	// Verify all tags exist and are not deleted
	if (tagIds.length > 0) {
		const existingTags = await db
			.select({ id: tags.id })
			.from(tags)
			.where(and(inArray(tags.id, tagIds), isNull(tags.deletedAt)));

		if (existingTags.length !== tagIds.length) {
			return { success: false, error: "One or more tags not found" };
		}
	}

	// Delete all existing tags and insert new ones in a transaction
	await db.transaction(async (tx) => {
		await tx
			.delete(documentTags)
			.where(eq(documentTags.documentId, documentId));

		if (tagIds.length > 0) {
			await tx.insert(documentTags).values(
				tagIds.map((tagId) => ({
					documentId,
					tagId,
				})),
			);
		}
	});

	return { success: true };
}

// ============================================================================
// Trash (Soft-Deleted Documents) Operations
// ============================================================================

export interface DeletedDocumentItem {
	id: string;
	title: string;
	archiveSerialNumber: number | null;
	deletedAt: string;
	daysUntilPermanentDeletion: number;
}

export interface PaginatedDeletedDocuments {
	items: DeletedDocumentItem[];
	nextCursor: string | null;
	hasMore: boolean;
}

const TRASH_RETENTION_DAYS = 30;

/**
 * Get a list of soft-deleted documents (trash) with cursor-based pagination.
 * Ordered by deletedAt DESC (most recently deleted first).
 *
 * @param cursor - The ID of the last document from the previous page
 */
export async function listDeletedDocuments(
	db: Database,
	options: { limit?: number; cursor?: string } = {},
): Promise<PaginatedDeletedDocuments> {
	const { limit = 50, cursor } = options;

	const whereConditions = [isNotNull(documents.deletedAt)];

	// Cursor-based pagination
	if (cursor) {
		whereConditions.push(lt(documents.id, BigInt(cursor)));
	}

	const results = await db
		.select({
			id: documents.id,
			title: documents.title,
			archiveSerialNumber: documents.archiveSerialNumber,
			deletedAt: documents.deletedAt,
		})
		.from(documents)
		.where(and(...whereConditions))
		.orderBy(desc(documents.deletedAt), desc(documents.id))
		.limit(limit + 1);

	const hasMore = results.length > limit;
	const pageResults = hasMore ? results.slice(0, limit) : results;

	const now = new Date();
	const items = pageResults.map((doc) => {
		const deletedAt = doc.deletedAt ?? new Date();
		const daysSinceDeletion = Math.floor(
			(now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
		);
		const daysRemaining = Math.max(0, TRASH_RETENTION_DAYS - daysSinceDeletion);

		return {
			id: doc.id.toString(),
			title: doc.title,
			archiveSerialNumber: doc.archiveSerialNumber,
			deletedAt: deletedAt.toISOString(),
			daysUntilPermanentDeletion: daysRemaining,
		};
	});

	const nextCursor =
		hasMore && items.length > 0 ? items[items.length - 1].id : null;

	return { items, nextCursor, hasMore };
}

/**
 * Restore a soft-deleted document (remove it from trash).
 * Returns true if restored, false if not found or not deleted.
 */
export async function restoreDocument(
	db: Database,
	id: bigint,
): Promise<boolean> {
	// Check if document exists and IS deleted
	const [existing] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.id, id), isNotNull(documents.deletedAt)))
		.limit(1);

	if (!existing) {
		return false;
	}

	// Clear the deletedAt to restore
	await db
		.update(documents)
		.set({ deletedAt: null })
		.where(eq(documents.id, id));

	return true;
}

/**
 * Permanently delete a document and its associated files.
 * This is irreversible and removes all data.
 * Returns the R2 object keys that should be deleted.
 */
export async function permanentlyDeleteDocument(
	db: Database,
	id: bigint,
): Promise<{ success: boolean; objectKeys: string[] }> {
	// Check if document exists (deleted or not)
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(eq(documents.id, id))
		.limit(1);

	if (!doc) {
		return { success: false, objectKeys: [] };
	}

	// Get file object keys and thumbnail keys before deletion
	const docFiles = await db
		.select({ objectKey: files.objectKey, thumbnailKey: files.thumbnailKey })
		.from(files)
		.where(eq(files.documentId, id));

	const objectKeys = docFiles.flatMap((f) =>
		f.thumbnailKey ? [f.objectKey, f.thumbnailKey] : [f.objectKey],
	);

	// Delete in order: document_tags -> files -> document (in a transaction)
	await db.transaction(async (tx) => {
		await tx.delete(documentTags).where(eq(documentTags.documentId, id));
		await tx.delete(files).where(eq(files.documentId, id));
		await tx.delete(documents).where(eq(documents.id, id));
	});

	return { success: true, objectKeys };
}

/**
 * Permanently delete all documents that have been in trash for more than 30 days.
 * Returns the count of deleted documents and R2 object keys to clean up.
 */
export async function permanentlyDeleteOldDocuments(
	db: Database,
): Promise<{ deletedCount: number; objectKeys: string[] }> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);

	// Find all documents deleted before the cutoff
	const oldDocs = await db
		.select({ id: documents.id })
		.from(documents)
		.where(
			and(isNotNull(documents.deletedAt), lt(documents.deletedAt, cutoffDate)),
		);

	if (oldDocs.length === 0) {
		return { deletedCount: 0, objectKeys: [] };
	}

	const docIds = oldDocs.map((d) => d.id);

	// Get all file object keys and thumbnail keys
	const docFiles = await db
		.select({ objectKey: files.objectKey, thumbnailKey: files.thumbnailKey })
		.from(files)
		.where(inArray(files.documentId, docIds));

	const objectKeys = docFiles.flatMap((f) =>
		f.thumbnailKey ? [f.objectKey, f.thumbnailKey] : [f.objectKey],
	);

	// Delete in order: document_tags -> files -> documents (in a transaction)
	await db.transaction(async (tx) => {
		await tx
			.delete(documentTags)
			.where(inArray(documentTags.documentId, docIds));
		await tx.delete(files).where(inArray(files.documentId, docIds));
		await tx.delete(documents).where(inArray(documents.id, docIds));
	});

	return { deletedCount: docIds.length, objectKeys };
}

/**
 * Get count of items in trash.
 */
export async function getTrashCount(db: Database): Promise<number> {
	const result = await db
		.select({ id: documents.id })
		.from(documents)
		.where(isNotNull(documents.deletedAt));

	return result.length;
}

/**
 * Get the next available Archive Serial Number (max + 1).
 * Returns 1 if no documents have ASNs assigned.
 */
export async function getNextASN(db: Database): Promise<number> {
	const result = await db
		.select({ maxASN: documents.archiveSerialNumber })
		.from(documents)
		.where(isNotNull(documents.archiveSerialNumber))
		.orderBy(desc(documents.archiveSerialNumber))
		.limit(1);

	const maxASN = result[0]?.maxASN ?? 0;
	return maxASN + 1;
}

/**
 * Create a document and its associated file record in a single transaction.
 * Returns the new document ID.
 */
export async function createDocumentWithFile(
	db: Database,
	params: {
		title: string;
		objectKey: string;
		mimeType: string;
		sizeBytes: bigint;
		md5Hash: string;
		thumbnailKey?: string | null;
	},
): Promise<{ id: string }> {
	const result = await db.transaction(async (tx) => {
		const [newDocument] = await tx
			.insert(documents)
			.values({ title: params.title })
			.returning({ id: documents.id });

		await tx.insert(files).values({
			documentId: newDocument.id,
			objectKey: params.objectKey,
			mimeType: params.mimeType,
			sizeBytes: params.sizeBytes,
			md5Hash: params.md5Hash,
			thumbnailKey: params.thumbnailKey ?? null,
		});

		return newDocument;
	});

	return { id: result.id.toString() };
}

/**
 * Update a document's extracted content by ID.
 */
export async function updateDocumentContent(
	db: Database,
	documentId: bigint,
	content: string,
): Promise<void> {
	await db
		.update(documents)
		.set({ content })
		.where(eq(documents.id, documentId));
}

/**
 * Get a document's primary file info for processing (text extraction).
 * Returns null if the document or file is not found.
 */
export async function getDocumentForProcessing(
	db: Database,
	documentId: bigint,
): Promise<{ id: string; objectKey: string; mimeType: string } | null> {
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
		.limit(1);

	if (!doc) {
		return null;
	}

	const [file] = await db
		.select({
			objectKey: files.objectKey,
			mimeType: files.mimeType,
		})
		.from(files)
		.where(and(eq(files.documentId, doc.id), isNull(files.deletedAt)))
		.limit(1);

	if (!file) {
		return null;
	}

	return {
		id: doc.id.toString(),
		objectKey: file.objectKey,
		mimeType: file.mimeType,
	};
}
