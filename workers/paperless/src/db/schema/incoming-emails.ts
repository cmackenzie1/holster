import { relations } from "drizzle-orm";
import {
	bigint,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const incomingEmailStatusEnum = pgEnum("incoming_email_status", [
	"processed",
	"failed",
	"ignored",
]);

export const incomingEmails = pgTable("incoming_emails", {
	id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
	from: varchar({ length: 255 }).notNull(),
	to: varchar({ length: 255 }).notNull(),
	subject: varchar({ length: 1024 }),
	receivedAt: timestamp("received_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	rawEmailKey: varchar("raw_email_key", { length: 1024 }).notNull(),
	rawEmailSize: bigint("raw_email_size", { mode: "bigint" }).notNull(),
	status: incomingEmailStatusEnum().notNull().default("processed"),
	documentsCreated: integer("documents_created").notNull().default(0),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const incomingEmailsRelations = relations(incomingEmails, ({}) => ({}));

export type IncomingEmail = typeof incomingEmails.$inferSelect;
export type NewIncomingEmail = typeof incomingEmails.$inferInsert;
