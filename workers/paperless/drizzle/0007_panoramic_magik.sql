ALTER TYPE "public"."suggestion_type" ADD VALUE 'date';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_date" timestamp with time zone;