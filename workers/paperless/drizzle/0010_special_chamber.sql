ALTER TYPE "public"."suggestion_type" ADD VALUE 'category';--> statement-breakpoint
ALTER TABLE "document_suggestions" ADD COLUMN "category_id" bigint;--> statement-breakpoint
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;