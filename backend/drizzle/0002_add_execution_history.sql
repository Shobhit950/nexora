CREATE TYPE "public"."execution_status" AS ENUM('success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "execution_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"node_id" varchar(64) NOT NULL,
	"node_type" varchar(64) NOT NULL,
	"step_order" integer NOT NULL,
	"status" "execution_status" NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error_code" varchar(64),
	"error_message" varchar(160),
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"duration_ms" double precision NOT NULL,
	CONSTRAINT "execution_steps_order_valid" CHECK ("execution_steps"."step_order" >= 0),
	CONSTRAINT "execution_steps_input_redacted" CHECK (coalesce(
    ("execution_steps"."input"->>'type') in ('null', 'boolean', 'number', 'string', 'array', 'object')
    and "execution_steps"."input" = jsonb_build_object('type', "execution_steps"."input"->>'type', 'redacted', true),
    false
  )),
	CONSTRAINT "execution_steps_output_redacted" CHECK ("execution_steps"."output" is null or coalesce(
    ("execution_steps"."output"->>'type') in ('null', 'boolean', 'number', 'string', 'array', 'object')
    and "execution_steps"."output" = jsonb_build_object('type', "execution_steps"."output"->>'type', 'redacted', true),
    false
  )),
	CONSTRAINT "execution_steps_duration_valid" CHECK ("execution_steps"."duration_ms" >= 0 and "execution_steps"."duration_ms" < 'Infinity'::double precision),
	CONSTRAINT "execution_steps_outcome_consistent" CHECK (
      ("execution_steps"."status" = 'success' and "execution_steps"."output" is not null and "execution_steps"."error_code" is null and "execution_steps"."error_message" is null)
      or ("execution_steps"."status" <> 'success' and "execution_steps"."output" is null and "execution_steps"."error_code" is not null and "execution_steps"."error_message" is not null)
    )
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workflow_id" uuid,
	"workflow_name_snapshot" varchar(120) NOT NULL,
	"status" "execution_status" NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error_code" varchar(64),
	"error_message" varchar(160),
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"duration_ms" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "executions_input_redacted" CHECK (coalesce(
    ("executions"."input"->>'type') in ('null', 'boolean', 'number', 'string', 'array', 'object')
    and "executions"."input" = jsonb_build_object('type', "executions"."input"->>'type', 'redacted', true),
    false
  )),
	CONSTRAINT "executions_output_redacted" CHECK ("executions"."output" is null or coalesce(
    ("executions"."output"->>'type') in ('null', 'boolean', 'number', 'string', 'array', 'object')
    and "executions"."output" = jsonb_build_object('type', "executions"."output"->>'type', 'redacted', true),
    false
  )),
	CONSTRAINT "executions_duration_valid" CHECK ("executions"."duration_ms" >= 0 and "executions"."duration_ms" < 'Infinity'::double precision),
	CONSTRAINT "executions_outcome_consistent" CHECK (
      ("executions"."status" = 'success' and "executions"."output" is not null and "executions"."error_code" is null and "executions"."error_message" is null)
      or ("executions"."status" <> 'success' and "executions"."output" is null and "executions"."error_code" is not null and "executions"."error_message" is not null)
    )
);
--> statement-breakpoint
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "execution_steps_execution_order_unique" ON "execution_steps" USING btree ("execution_id","step_order");--> statement-breakpoint
CREATE INDEX "executions_user_started_idx" ON "executions" USING btree ("user_id","started_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "executions_user_workflow_started_idx" ON "executions" USING btree ("user_id","workflow_id","started_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "executions_user_status_started_idx" ON "executions" USING btree ("user_id","status","started_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "executions_workflow_id_idx" ON "executions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "executions_created_at_idx" ON "executions" USING btree ("created_at");