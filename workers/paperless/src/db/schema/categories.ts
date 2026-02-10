import { relations } from "drizzle-orm";
import {
	bigint,
	index,
	pgTable,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const categories = pgTable(
	"categories",
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
	(table) => [index("categories_deleted_at_idx").on(table.deletedAt)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
	documents: many(documents),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
