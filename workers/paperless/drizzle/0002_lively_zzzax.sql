CREATE TYPE "public"."incoming_email_status" AS ENUM('processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "incoming_emails" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incoming_emails_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"from" varchar(255) NOT NULL,
	"to" varchar(255) NOT NULL,
	"subject" varchar(1024),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_email_key" varchar(1024) NOT NULL,
	"raw_email_size" bigint NOT NULL,
	"status" "incoming_email_status" DEFAULT 'processed' NOT NULL,
	"documents_created" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
