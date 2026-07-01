CREATE SCHEMA "omnidat";
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(256) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"permissions" json DEFAULT '["read"]'::json NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"setup_completed_by_user_id" text,
	"initial_workspace_id" uuid,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"signup_enabled" boolean DEFAULT true NOT NULL,
	"announcement_message" text,
	"announcement_tone" varchar(24) DEFAULT 'info' NOT NULL,
	"allowed_email_domains" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"interval" text DEFAULT 'month' NOT NULL,
	"amount_in_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "billing_plan_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_plan_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"key" varchar(80) NOT NULL,
	"value" integer,
	"period" text DEFAULT 'month' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "billing_plan_limit_plan_key_unique" UNIQUE("plan_id","key")
);
--> statement-breakpoint
CREATE TABLE "usage_meter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"aggregation" text DEFAULT 'sum' NOT NULL,
	"unit" varchar(40) DEFAULT 'count' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "usage_meter_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"theme" varchar(20) DEFAULT 'system' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"push_notifications" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "user_preferences_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"source" text DEFAULT 'landing' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"referral_code" varchar(120),
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "waitlist_entry_email_source_unique" UNIQUE("email","source")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workspace_invite_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "workspace_invite_allowlist_workspace_email_unique" UNIQUE("workspace_id","email")
);
--> statement-breakpoint
CREATE TABLE "workspace_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "workspace_membership_workspace_user_unique" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_id" uuid,
	"status" text DEFAULT 'free' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "workspace_subscription_workspace_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_usage_rollup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meter_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "workspace_usage_rollup_workspace_meter_period_unique" UNIQUE("workspace_id","meter_id","period_start","period_end")
);
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
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_setup_completed_by_user_id_user_id_fk" FOREIGN KEY ("setup_completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_initial_workspace_id_workspace_id_fk" FOREIGN KEY ("initial_workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_limit" ADD CONSTRAINT "billing_plan_limit_plan_id_billing_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_allowlist" ADD CONSTRAINT "workspace_invite_allowlist_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_allowlist" ADD CONSTRAINT "workspace_invite_allowlist_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_subscription" ADD CONSTRAINT "workspace_subscription_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_subscription" ADD CONSTRAINT "workspace_subscription_plan_id_billing_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_usage_rollup" ADD CONSTRAINT "workspace_usage_rollup_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_usage_rollup" ADD CONSTRAINT "workspace_usage_rollup_meter_id_usage_meter_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."usage_meter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;