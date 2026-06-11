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
CREATE UNIQUE INDEX "alert_recipients_shop_channel_dest_idx" ON "alert_recipients" USING btree ("shop","channel","destination");--> statement-breakpoint
CREATE INDEX "alert_recipients_shop_channel_idx" ON "alert_recipients" USING btree ("shop","channel");--> statement-breakpoint
ALTER TABLE "channel_settings" DROP COLUMN "email_recipients";--> statement-breakpoint
ALTER TABLE "channel_settings" DROP COLUMN "sms_recipients";