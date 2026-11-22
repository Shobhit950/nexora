CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflows_nodes_is_array" CHECK (jsonb_typeof("workflows"."nodes") = 'array'),
	CONSTRAINT "workflows_edges_is_array" CHECK (jsonb_typeof("workflows"."edges") = 'array')
);
--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflows_user_updated_at_idx" ON "workflows" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflows_status_idx" ON "workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflows_updated_at_idx" ON "workflows" USING btree ("updated_at" DESC NULLS LAST);