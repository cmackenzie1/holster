import { relations } from "drizzle-orm";
import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const documentComments = pgTable(
	"document_comments",
	{
		id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
		documentId: bigint("document_id", { mode: "bigint" })
			.notNull()
			.references(() => documents.id),
		content: text().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [index("document_comments_document_id_idx").on(table.documentId)],
);

export const documentCommentsRelations = relations(
	documentComments,
	({ one }) => ({
		document: one(documents, {
			fields: [documentComments.documentId],
			references: [documents.id],
		}),
	}),
);

export type DocumentComment = typeof documentComments.$inferSelect;
export type NewDocumentComment = typeof documentComments.$inferInsert;
