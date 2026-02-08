import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../index";
import { documentComments } from "../schema/document-comments";

export interface CommentData {
	id: string;
	documentId: string;
	content: string;
	createdAt: string;
}

export async function listCommentsByDocument(
	db: Database,
	documentId: bigint,
): Promise<CommentData[]> {
	const results = await db
		.select()
		.from(documentComments)
		.where(
			and(
				eq(documentComments.documentId, documentId),
				isNull(documentComments.deletedAt),
			),
		)
		.orderBy(asc(documentComments.createdAt));

	return results.map((c) => ({
		id: c.id.toString(),
		documentId: c.documentId.toString(),
		content: c.content,
		createdAt: c.createdAt.toISOString(),
	}));
}

export async function createComment(
	db: Database,
	documentId: bigint,
	content: string,
): Promise<CommentData> {
	const [created] = await db
		.insert(documentComments)
		.values({ documentId, content: content.trim() })
		.returning();

	return {
		id: created.id.toString(),
		documentId: created.documentId.toString(),
		content: created.content,
		createdAt: created.createdAt.toISOString(),
	};
}

export async function softDeleteComment(
	db: Database,
	id: bigint,
): Promise<boolean> {
	const [updated] = await db
		.update(documentComments)
		.set({ deletedAt: new Date() })
		.where(and(eq(documentComments.id, id), isNull(documentComments.deletedAt)))
		.returning({ id: documentComments.id });

	return !!updated;
}
