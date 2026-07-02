CREATE TABLE "omnidat"."omnidat_passport_stamp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "passport_id" varchar(120) NOT NULL,
  "badge_id" varchar(120) NOT NULL,
  "operator_id" varchar(120) NOT NULL,
  "evidence" text NOT NULL,
  "stamp_id" varchar(120) NOT NULL,
  "receipt_id" varchar(120) NOT NULL,
  "status" varchar(32) DEFAULT 'filed' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "omnidat_passport_stamp_stamp_id_unique" UNIQUE("stamp_id")
);
