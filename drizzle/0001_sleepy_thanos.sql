ALTER TABLE "nodes" ADD COLUMN "description" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "description_plain_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "nodes" AS n
SET
	"description" = COALESCE((
		SELECT d."body" FROM "node_descriptions" AS d
		WHERE d."node_id" = n."id" AND d."shared" = true
		ORDER BY (d."user_id" = n."created_by") DESC, d."updated_at" DESC LIMIT 1
	), '[]'::jsonb),
	"description_plain_text" = COALESCE((
		SELECT d."plain_text" FROM "node_descriptions" AS d
		WHERE d."node_id" = n."id" AND d."shared" = true
		ORDER BY (d."user_id" = n."created_by") DESC, d."updated_at" DESC LIMIT 1
	), '');--> statement-breakpoint
UPDATE "node_descriptions" SET "shared" = false;
