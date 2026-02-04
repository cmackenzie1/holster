import { relations } from "drizzle-orm";
import {
  bigint,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const files = pgTable("files", {
  id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  documentId: bigint("document_id", { mode: "bigint" })
    .notNull()
    .references(() => documents.id),
  objectKey: varchar("object_key", { length: 1024 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "bigint" }).notNull(),
  md5Hash: varchar("md5_hash", { length: 32 }),
  crc32c: varchar("crc32c", { length: 8 }),
  thumbnailKey: varchar("thumbnail_key", { length: 1024 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const filesRelations = relations(files, ({ one }) => ({
  document: one(documents, {
    fields: [files.documentId],
    references: [documents.id],
  }),
}));

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
