CREATE SCHEMA IF NOT EXISTS "omnidat";
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_address_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid NOT NULL,
	"x121" varchar(32) NOT NULL,
	"assigned_to_kind" varchar(64) NOT NULL,
	"assigned_to_id" uuid,
	"namespace" varchar(64) DEFAULT 'camp' NOT NULL,
	"status" varchar(32) DEFAULT 'reserved' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_address_allocation_x121_unique" UNIQUE("x121")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"event_type" varchar(120) NOT NULL,
	"subject_kind" varchar(80) NOT NULL,
	"subject_id" varchar(160),
	"ip_address" varchar(80),
	"details" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_billing_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"campsite_id" uuid,
	"provider" varchar(64) DEFAULT 'ShadyBucks' NOT NULL,
	"external_account_id" varchar(120) NOT NULL,
	"account_type" varchar(64) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"balance_amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(12) DEFAULT 'SHDY' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_billing_account_provider_external_unique" UNIQUE("provider","external_account_id")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_billing_ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"related_service_id" uuid,
	"entry_kind" varchar(64) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(12) DEFAULT 'SHDY' NOT NULL,
	"memo" text,
	"external_receipt_id" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_campsite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" varchar(64) DEFAULT 'camp' NOT NULL,
	"slug" varchar(120) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"contact_handle" varchar(160) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_campsite_namespace_slug_unique" UNIQUE("namespace","slug")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_campsite_app" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campsite_id" uuid NOT NULL,
	"address" varchar(16) NOT NULL,
	"name" varchar(160) NOT NULL,
	"app_kind" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "omnidat_campsite_app_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_food_menu_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"item_code" varchar(80) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"price_amount" integer NOT NULL,
	"currency" varchar(12) DEFAULT 'SHDY' NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "omnidat_food_menu_item_service_code_unique" UNIQUE("service_id","item_code")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_food_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"billing_account_id" uuid,
	"line_ticket" varchar(80) NOT NULL,
	"pickup_name" varchar(160) NOT NULL,
	"items" json DEFAULT '[]'::json NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'received' NOT NULL,
	"estimated_wait_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone,
	CONSTRAINT "omnidat_food_order_line_ticket_unique" UNIQUE("line_ticket")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_infra_endpoint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid,
	"endpoint_kind" varchar(80) NOT NULL,
	"label" varchar(160) NOT NULL,
	"url" text,
	"health_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"owner" varchar(120) DEFAULT 'OMNIDAT' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_network" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"x121_prefix" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'planning' NOT NULL,
	"status_source" varchar(120) DEFAULT 'seeded-exchange-88-adapter' NOT NULL,
	"adapter_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_network_code_unique" UNIQUE("network_code")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_network_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid,
	"service_id" uuid,
	"circuit_id" uuid,
	"metric_name" varchar(120) NOT NULL,
	"value" integer NOT NULL,
	"unit" varchar(32) NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_noc_incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid,
	"service_id" uuid,
	"title" varchar(200) NOT NULL,
	"severity" varchar(32) DEFAULT 'minor' NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"opened_by_user_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_pad_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"x121" varchar(32) NOT NULL,
	"service_id" uuid,
	"transport" varchar(80) NOT NULL,
	"pad_kind" varchar(64) NOT NULL,
	"endpoint_label" varchar(160) NOT NULL,
	"status" varchar(32) DEFAULT 'configured' NOT NULL,
	"profile" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_pad_config_x121_unique" UNIQUE("x121")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_pdf_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"campsite_id" uuid,
	"enabled_forms" json DEFAULT '[]'::json NOT NULL,
	"page_size" varchar(32) DEFAULT 'letter' NOT NULL,
	"delivery_mode" varchar(64) DEFAULT 'download-and-print' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_pdf_profile_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_provisioning_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" text,
	"campsite_id" uuid,
	"service_id" uuid,
	"requested_x_121" varchar(32),
	"assigned_x_121" varchar(32),
	"transport" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"verification_transcript" text,
	"pdf_receipt_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_security_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"service_id" uuid,
	"credential_kind" varchar(64) NOT NULL,
	"key_prefix" varchar(24),
	"secret_hash" text NOT NULL,
	"permissions" json DEFAULT '[]'::json NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid,
	"owner_campsite_id" uuid,
	"slug" varchar(120) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"x121" varchar(32) NOT NULL,
	"owner_kind" varchar(64) DEFAULT 'omnidat' NOT NULL,
	"service_kind" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"reachable" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_service_slug_unique" UNIQUE("slug"),
	CONSTRAINT "omnidat_service_x121_unique" UNIQUE("x121")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_service_verb" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"verb" varchar(80) NOT NULL,
	"description" text,
	"inputs" json DEFAULT '[]'::json NOT NULL,
	"outputs" json DEFAULT '[]'::json NOT NULL,
	"security_policy" json DEFAULT '{}'::json NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "omnidat_service_verb_service_verb_unique" UNIQUE("service_id","verb")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_shadybucks_atm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terminal_id" varchar(120) NOT NULL,
	"terminal_x_121" varchar(32) NOT NULL,
	"settlement_account_id" uuid NOT NULL,
	"service_id" uuid,
	"location_label" varchar(160),
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"activation_code_hash" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "omnidat_shadybucks_atm_terminal_id_unique" UNIQUE("terminal_id"),
	CONSTRAINT "omnidat_shadybucks_atm_terminal_x121_unique" UNIQUE("terminal_x_121")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_transport_endpoint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campsite_id" uuid,
	"transport" varchar(80) NOT NULL,
	"endpoint_label" varchar(160) NOT NULL,
	"routing_hint" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_x25_circuit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid NOT NULL,
	"local_node_id" uuid,
	"remote_node_id" uuid,
	"local_x_121" varchar(32) NOT NULL,
	"remote_x_121" varchar(32),
	"circuit_kind" varchar(64) NOT NULL,
	"transport" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"packet_window" integer DEFAULT 2 NOT NULL,
	"throughput_bps" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_x25_circuit_local_x121_unique" UNIQUE("local_x_121")
);
--> statement-breakpoint
CREATE TABLE "omnidat"."omnidat_x25_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid NOT NULL,
	"node_code" varchar(64) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"node_kind" varchar(64) NOT NULL,
	"location_label" varchar(160),
	"management_address" varchar(160),
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "omnidat_x25_node_network_code_unique" UNIQUE("network_id","node_code")
);
--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_address_allocation" ADD CONSTRAINT "omnidat_address_allocation_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_audit_event" ADD CONSTRAINT "omnidat_audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_billing_account" ADD CONSTRAINT "omnidat_billing_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_billing_account" ADD CONSTRAINT "omnidat_billing_account_campsite_id_omnidat_campsite_id_fk" FOREIGN KEY ("campsite_id") REFERENCES "omnidat"."omnidat_campsite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_billing_ledger_entry" ADD CONSTRAINT "omnidat_billing_ledger_entry_account_id_omnidat_billing_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "omnidat"."omnidat_billing_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_billing_ledger_entry" ADD CONSTRAINT "omnidat_billing_ledger_entry_related_service_id_omnidat_service_id_fk" FOREIGN KEY ("related_service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_campsite_app" ADD CONSTRAINT "omnidat_campsite_app_campsite_id_omnidat_campsite_id_fk" FOREIGN KEY ("campsite_id") REFERENCES "omnidat"."omnidat_campsite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_food_menu_item" ADD CONSTRAINT "omnidat_food_menu_item_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_food_order" ADD CONSTRAINT "omnidat_food_order_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_food_order" ADD CONSTRAINT "omnidat_food_order_billing_account_id_omnidat_billing_account_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "omnidat"."omnidat_billing_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_infra_endpoint" ADD CONSTRAINT "omnidat_infra_endpoint_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_network_metric" ADD CONSTRAINT "omnidat_network_metric_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_network_metric" ADD CONSTRAINT "omnidat_network_metric_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_network_metric" ADD CONSTRAINT "omnidat_network_metric_circuit_id_omnidat_x25_circuit_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "omnidat"."omnidat_x25_circuit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_noc_incident" ADD CONSTRAINT "omnidat_noc_incident_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_noc_incident" ADD CONSTRAINT "omnidat_noc_incident_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_noc_incident" ADD CONSTRAINT "omnidat_noc_incident_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_pad_config" ADD CONSTRAINT "omnidat_pad_config_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_pdf_profile" ADD CONSTRAINT "omnidat_pdf_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_pdf_profile" ADD CONSTRAINT "omnidat_pdf_profile_campsite_id_omnidat_campsite_id_fk" FOREIGN KEY ("campsite_id") REFERENCES "omnidat"."omnidat_campsite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_provisioning_request" ADD CONSTRAINT "omnidat_provisioning_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_provisioning_request" ADD CONSTRAINT "omnidat_provisioning_request_campsite_id_omnidat_campsite_id_fk" FOREIGN KEY ("campsite_id") REFERENCES "omnidat"."omnidat_campsite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_provisioning_request" ADD CONSTRAINT "omnidat_provisioning_request_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_security_credential" ADD CONSTRAINT "omnidat_security_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_security_credential" ADD CONSTRAINT "omnidat_security_credential_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_service" ADD CONSTRAINT "omnidat_service_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_service" ADD CONSTRAINT "omnidat_service_owner_campsite_id_omnidat_campsite_id_fk" FOREIGN KEY ("owner_campsite_id") REFERENCES "omnidat"."omnidat_campsite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_service_verb" ADD CONSTRAINT "omnidat_service_verb_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_shadybucks_atm" ADD CONSTRAINT "omnidat_shadybucks_atm_settlement_account_id_omnidat_billing_account_id_fk" FOREIGN KEY ("settlement_account_id") REFERENCES "omnidat"."omnidat_billing_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_shadybucks_atm" ADD CONSTRAINT "omnidat_shadybucks_atm_service_id_omnidat_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "omnidat"."omnidat_service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_transport_endpoint" ADD CONSTRAINT "omnidat_transport_endpoint_campsite_id_omnidat_campsite_id_fk" FOREIGN KEY ("campsite_id") REFERENCES "omnidat"."omnidat_campsite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_x25_circuit" ADD CONSTRAINT "omnidat_x25_circuit_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_x25_circuit" ADD CONSTRAINT "omnidat_x25_circuit_local_node_id_omnidat_x25_node_id_fk" FOREIGN KEY ("local_node_id") REFERENCES "omnidat"."omnidat_x25_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_x25_circuit" ADD CONSTRAINT "omnidat_x25_circuit_remote_node_id_omnidat_x25_node_id_fk" FOREIGN KEY ("remote_node_id") REFERENCES "omnidat"."omnidat_x25_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "omnidat"."omnidat_x25_node" ADD CONSTRAINT "omnidat_x25_node_network_id_omnidat_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "omnidat"."omnidat_network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
