CREATE TABLE "alert_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_code" text,
	"verification_sent_at" timestamp,
	"verification_expires_at" timestamp,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"threshold_amount" numeric(12, 2) NOT NULL,
	"min_item_count" integer,
	"inactivity_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"checkout_id" uuid,
	"channel" text NOT NULL,
	"recipient" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"provider_message_id" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_settings" (
	"shop" text PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"slack_enabled" boolean DEFAULT false NOT NULL,
	"slack_webhook_url" text,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"checkout_token" text NOT NULL,
	"shopify_checkout_id" text,
	"abandoned_checkout_url" text,
	"total_price" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"checkout_created_at" timestamp,
	"last_activity_at" timestamp NOT NULL,
	"alerted_at" timestamp,
	"recovered_at" timestamp,
	"recovered_order_id" text,
	"recovered_amount" numeric(12, 2),
	"recovery_match" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp,
	"access_token" text NOT NULL,
	"user_id" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"account_owner" boolean DEFAULT false,
	"locale" text,
	"collaborator" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false,
	"refresh_token" text,
	"refresh_token_expires" timestamp
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"shop" text PRIMARY KEY NOT NULL,
	"shop_name" text,
	"currency" text,
	"attribution_window_days" integer DEFAULT 14 NOT NULL,
	"billing_active" boolean DEFAULT false NOT NULL,
	"billing_subscription_id" text,
	"usage_line_item_id" text,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "usage_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"checkout_id" uuid,
	"order_id" text,
	"recovered_amount" numeric(12, 2),
	"amount" numeric(10, 2) NOT NULL,
	"idempotency_key" text NOT NULL,
	"shopify_usage_record_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_recipients_shop_channel_dest_idx" ON "alert_recipients" USING btree ("shop","channel","destination");--> statement-breakpoint
CREATE INDEX "alert_recipients_shop_channel_idx" ON "alert_recipients" USING btree ("shop","channel");--> statement-breakpoint
CREATE INDEX "alert_rules_shop_idx" ON "alert_rules" USING btree ("shop");--> statement-breakpoint
CREATE INDEX "alerts_shop_created_idx" ON "alerts" USING btree ("shop","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_shop_token_idx" ON "checkouts" USING btree ("shop","checkout_token");--> statement-breakpoint
CREATE INDEX "checkouts_status_activity_idx" ON "checkouts" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE INDEX "checkouts_shop_status_idx" ON "checkouts" USING btree ("shop","status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_charges_idempotency_idx" ON "usage_charges" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_charges_shop_created_idx" ON "usage_charges" USING btree ("shop","created_at");