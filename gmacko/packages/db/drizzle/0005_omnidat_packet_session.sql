CREATE TABLE "omnidat"."omnidat_packet_session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid,
  "service_id" uuid,
  "source_identity" varchar(160) NOT NULL,
  "source_transport" varchar(80) NOT NULL,
  "source_x_121" varchar(32),
  "destination_x_121" varchar(32) NOT NULL,
  "status" varchar(32) DEFAULT 'connected' NOT NULL,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cleared_at" timestamp with time zone,
  "clear_cause" integer,
  "clear_diagnostic" integer,
  "transcript_hash" varchar(128),
  "evidence_artifact_id" uuid
);
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_packet_session" ADD CONSTRAINT "omnidat_packet_session_event_id_omnidat_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "omnidat"."omnidat_event"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_packet_session" ADD CONSTRAINT "omnidat_packet_session_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_packet_session" ADD CONSTRAINT "omnidat_packet_session_evidence_artifact_id_omnidat_evidence_artifact_id_fk" FOREIGN KEY ("evidence_artifact_id") REFERENCES "omnidat"."omnidat_evidence_artifact"("id") ON DELETE set null ON UPDATE no action;
