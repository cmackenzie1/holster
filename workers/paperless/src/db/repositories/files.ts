import { isNull, sql } from "drizzle-orm";
import type { Database } from "../index";
import { files } from "../schema";

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
