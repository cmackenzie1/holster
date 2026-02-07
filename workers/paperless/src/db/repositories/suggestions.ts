import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../index";
import {
	documentSuggestions,
	type NewDocumentSuggestion,
} from "../schema/document-suggestions";

export interface SuggestionData {
	id: string;
	documentId: string;
	type: "tag" | "correspondent" | "title" | "date";
	name: string;
	confidence: string;
	tagId: string | null;
	correspondentId: string | null;
	accepted: boolean | null;
	createdAt: string;
}

export async function createSuggestions(
	db: Database,
	suggestions: NewDocumentSuggestion[],
): Promise<void> {
	if (suggestions.length === 0) return;
	await db.insert(documentSuggestions).values(suggestions);
}

export async function listSuggestionsByDocument(
	db: Database,
	documentId: bigint,
): Promise<SuggestionData[]> {
	const results = await db
		.select()
		.from(documentSuggestions)
		.where(
			and(
				eq(documentSuggestions.documentId, documentId),
				isNull(documentSuggestions.accepted),
			),
		)
		.orderBy(desc(documentSuggestions.confidence));

	return results.map((s) => ({
		id: s.id.toString(),
		documentId: s.documentId.toString(),
		type: s.type,
		name: s.name,
		confidence: s.confidence,
		tagId: s.tagId?.toString() ?? null,
		correspondentId: s.correspondentId?.toString() ?? null,
		accepted: s.accepted,
		createdAt: s.createdAt.toISOString(),
	}));
}

export async function acceptSuggestion(
	db: Database,
	id: bigint,
): Promise<SuggestionData | null> {
	const [updated] = await db
		.update(documentSuggestions)
		.set({ accepted: true })
		.where(eq(documentSuggestions.id, id))
		.returning();

	if (!updated) return null;

	return {
		id: updated.id.toString(),
		documentId: updated.documentId.toString(),
		type: updated.type,
		name: updated.name,
		confidence: updated.confidence,
		tagId: updated.tagId?.toString() ?? null,
		correspondentId: updated.correspondentId?.toString() ?? null,
		accepted: updated.accepted,
		createdAt: updated.createdAt.toISOString(),
	};
}

export async function dismissSuggestion(
	db: Database,
	id: bigint,
): Promise<boolean> {
	const [updated] = await db
		.update(documentSuggestions)
		.set({ accepted: false })
		.where(eq(documentSuggestions.id, id))
		.returning({ id: documentSuggestions.id });

	return !!updated;
}

export async function deletePendingSuggestionsForDocument(
	db: Database,
	documentId: bigint,
): Promise<void> {
	await db
		.delete(documentSuggestions)
		.where(
			and(
				eq(documentSuggestions.documentId, documentId),
				isNull(documentSuggestions.accepted),
			),
		);
}
