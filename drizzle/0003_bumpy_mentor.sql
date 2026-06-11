ALTER TABLE "checkouts" ADD COLUMN "recovery_match" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "attribution_window_days" integer DEFAULT 14 NOT NULL;