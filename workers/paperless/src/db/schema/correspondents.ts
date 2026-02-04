import { relations } from "drizzle-orm";
import { bigint, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const correspondents = pgTable("correspondents", {
  id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const correspondentsRelations = relations(correspondents, ({ many }) => ({
  documents: many(documents),
}));

export type Correspondent = typeof correspondents.$inferSelect;
export type NewCorrespondent = typeof correspondents.$inferInsert;
