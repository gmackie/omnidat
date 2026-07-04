CREATE TABLE "omnidat"."omnidat_sync_source" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" varchar(80) NOT NULL,
  "source_kind" varchar(32) DEFAULT 'field-kit' NOT NULL,
  "token_hash" text NOT NULL,
  "last_pushed_seq" bigint DEFAULT 0 NOT NULL,
  "last_sync_at" timestamp with time zone,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "omnidat_sync_source_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_journal_entry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" varchar(80) NOT NULL,
  "seq" bigint NOT NULL,
  "event_id" uuid,
  "epoch" integer NOT NULL,
  "op_type" varchar(120) NOT NULL,
  "payload" json DEFAULT '{}'::json NOT NULL,
  "idempotency_key" varchar(160) NOT NULL,
  "payload_checksum" varchar(64) NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "apply_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "applied_at" timestamp with time zone,
  CONSTRAINT "omnidat_journal_source_seq_unique" UNIQUE("source_id","seq"),
  CONSTRAINT "omnidat_journal_idempotency_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_event_authority" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "epoch" integer NOT NULL,
  "holder" varchar(16) NOT NULL,
  "holder_source_id" varchar(80) NOT NULL,
  "fence_seq" bigint,
  "transferred_by_user_id" text,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "omnidat_event_authority_event_epoch_unique" UNIQUE("event_id","epoch")
);
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_journal_entry" ADD CONSTRAINT "omnidat_journal_entry_event_id_omnidat_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "omnidat"."omnidat_event"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_event_authority" ADD CONSTRAINT "omnidat_event_authority_event_id_omnidat_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "omnidat"."omnidat_event"("id") ON DELETE cascade ON UPDATE no action;
