import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	numeric,
	pgEnum,
	pgTable,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { correspondents } from "./correspondents";
import { documents } from "./documents";
import { tags } from "./tags";

export const suggestionTypeEnum = pgEnum("suggestion_type", [
	"tag",
	"correspondent",
	"title",
	"date",
]);

export const documentSuggestions = pgTable(
	"document_suggestions",
	{
		id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
		documentId: bigint("document_id", { mode: "bigint" })
			.notNull()
			.references(() => documents.id),
		type: suggestionTypeEnum().notNull(),
		name: varchar({ length: 255 }).notNull(),
		confidence: numeric({ precision: 4, scale: 3 }).notNull(),
		tagId: bigint("tag_id", { mode: "bigint" }).references(() => tags.id),
		correspondentId: bigint("correspondent_id", { mode: "bigint" }).references(
			() => correspondents.id,
		),
		accepted: boolean(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("document_suggestions_document_id_idx").on(table.documentId),
		index("document_suggestions_document_id_accepted_idx").on(
			table.documentId,
			table.accepted,
		),
	],
);

export const documentSuggestionsRelations = relations(
	documentSuggestions,
	({ one }) => ({
		document: one(documents, {
			fields: [documentSuggestions.documentId],
			references: [documents.id],
		}),
		tag: one(tags, {
			fields: [documentSuggestions.tagId],
			references: [tags.id],
		}),
		correspondent: one(correspondents, {
			fields: [documentSuggestions.correspondentId],
			references: [correspondents.id],
		}),
	}),
);

export type DocumentSuggestion = typeof documentSuggestions.$inferSelect;
export type NewDocumentSuggestion = typeof documentSuggestions.$inferInsert;
