import { relations } from "drizzle-orm";
import {
	bigint,
	index,
	pgTable,
	primaryKey,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const tags = pgTable(
	"tags",
	{
		id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
		name: varchar({ length: 255 }).notNull(),
		color: varchar({ length: 7 }), // hex color like #ff0000
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [index("tags_deleted_at_idx").on(table.deletedAt)],
);

export const documentTags = pgTable(
	"document_tags",
	{
		documentId: bigint("document_id", { mode: "bigint" })
			.notNull()
			.references(() => documents.id),
		tagId: bigint("tag_id", { mode: "bigint" })
			.notNull()
			.references(() => tags.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.documentId, t.tagId] }),
		index("document_tags_tag_id_idx").on(t.tagId),
	],
);

export const tagsRelations = relations(tags, ({ many }) => ({
	documentTags: many(documentTags),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
	document: one(documents, {
		fields: [documentTags.documentId],
		references: [documents.id],
	}),
	tag: one(tags, {
		fields: [documentTags.tagId],
		references: [tags.id],
	}),
}));

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type DocumentTag = typeof documentTags.$inferSelect;
export type NewDocumentTag = typeof documentTags.$inferInsert;
