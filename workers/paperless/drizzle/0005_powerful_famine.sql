CREATE INDEX "documents_deleted_at_idx" ON "documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_correspondent_id_idx" ON "documents" USING btree ("correspondent_id");--> statement-breakpoint
CREATE INDEX "files_document_id_idx" ON "files" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "files_deleted_at_idx" ON "files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "correspondents_deleted_at_idx" ON "correspondents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "document_tags_tag_id_idx" ON "document_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tags_deleted_at_idx" ON "tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "document_suggestions_document_id_idx" ON "document_suggestions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_suggestions_document_id_accepted_idx" ON "document_suggestions" USING btree ("document_id","accepted");