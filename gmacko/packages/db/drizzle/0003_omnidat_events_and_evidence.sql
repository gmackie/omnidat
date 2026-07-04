CREATE TABLE "omnidat"."omnidat_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_code" varchar(80) NOT NULL,
  "display_name" varchar(180) NOT NULL,
  "event_kind" varchar(80) DEFAULT 'hackercamp' NOT NULL,
  "status" varchar(32) DEFAULT 'planning' NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "public_archive" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "omnidat_event_code_unique" UNIQUE("event_code")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_evidence_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid,
  "artifact_kind" varchar(80) NOT NULL,
  "label" varchar(180) NOT NULL,
  "url" text NOT NULL,
  "record_count" integer,
  "content_type" varchar(120) DEFAULT 'application/json' NOT NULL,
  "checksum" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_operator_role" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "event_id" uuid,
  "role" varchar(64) NOT NULL,
  "scope" varchar(80) DEFAULT 'event' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "omnidat_operator_role_user_event_role_unique" UNIQUE("user_id","event_id","role")
);
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_evidence_artifact" ADD CONSTRAINT "omnidat_evidence_artifact_event_id_omnidat_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "omnidat"."omnidat_event"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_operator_role" ADD CONSTRAINT "omnidat_operator_role_event_id_omnidat_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "omnidat"."omnidat_event"("id") ON DELETE cascade ON UPDATE no action;
