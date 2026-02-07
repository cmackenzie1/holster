import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../index";
import { documents, files } from "../schema";

export interface StorageStats {
	totalBytes: number;
	fileCount: number;
}

/**
 * Get total storage used by all non-deleted files.
 */
export async function getStorageStats(db: Database): Promise<StorageStats> {
	const result = await db
		.select({
			totalBytes: sql<string>`COALESCE(SUM(${files.sizeBytes}), 0)`,
			fileCount: sql<string>`COUNT(*)`,
		})
		.from(files)
		.where(isNull(files.deletedAt));

	return {
		totalBytes: Number(result[0]?.totalBytes ?? 0),
		fileCount: Number(result[0]?.fileCount ?? 0),
	};
}

/**
 * Find a non-deleted file with the given MD5 hash whose document is also not deleted.
 * Returns the document ID and title if found, null otherwise.
 */
export async function findFileByMd5Hash(
	db: Database,
	md5Hash: string,
): Promise<{ documentId: string; title: string } | null> {
	const [result] = await db
		.select({
			documentId: files.documentId,
			title: documents.title,
		})
		.from(files)
		.innerJoin(documents, eq(files.documentId, documents.id))
		.where(
			and(
				eq(files.md5Hash, md5Hash),
				isNull(files.deletedAt),
				isNull(documents.deletedAt),
			),
		)
		.limit(1);

	if (!result) return null;

	return {
		documentId: result.documentId.toString(),
		title: result.title,
	};
}
