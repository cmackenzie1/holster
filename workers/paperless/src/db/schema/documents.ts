import { relations, sql } from "drizzle-orm";
import {
	bigint,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { files } from "./files";
import { correspondents } from "./correspondents";
import { documentTags } from "./tags";

const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector";
	},
});

export const documents = pgTable(
	"documents",
	{
		id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
		title: varchar({ length: 255 }).notNull(),
		archiveSerialNumber: integer("archive_serial_number"),
		content: text(),
		correspondentId: bigint("correspondent_id", {
			mode: "bigint",
		}).references(() => correspondents.id),
		dateCreated: timestamp("date_created", { withTimezone: true })
			.notNull()
			.defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		searchVector: tsvector("search_vector").generatedAlwaysAs(
			sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))`,
		),
	},
	(table) => [
		index("documents_search_idx").using("gin", table.searchVector),
	],
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
	correspondent: one(correspondents, {
		fields: [documents.correspondentId],
		references: [correspondents.id],
	}),
	files: many(files),
	documentTags: many(documentTags),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
