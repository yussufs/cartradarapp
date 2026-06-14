-- SMS removed in v1: drop dormant SMS recipients (UI can no longer manage them)
DELETE FROM "alert_recipients" WHERE "channel" = 'sms';--> statement-breakpoint
DROP TABLE "usage_charges" CASCADE;--> statement-breakpoint
ALTER TABLE "channel_settings" DROP COLUMN "sms_enabled";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "usage_line_item_id";