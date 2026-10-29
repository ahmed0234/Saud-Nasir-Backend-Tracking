ALTER TABLE "cta_clicks" ADD COLUMN "site" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "event_type" text DEFAULT 'cta_click' NOT NULL;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "button_type" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "button_text" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "form_name" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "page_path" text GENERATED ALWAYS AS (coalesce(nullif(substring(page_url from '^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]*([^?#]*)'), ''), '/')) STORED;--> statement-breakpoint
CREATE INDEX "cta_clicks_site_clicked_at_idx" ON "cta_clicks" USING btree ("site","clicked_at");--> statement-breakpoint
-- Tag existing leads by domain. Rows from other domains keep a null site.
UPDATE "cta_clicks" SET "site" = CASE lower(substring("page_url" from '^[A-Za-z][A-Za-z0-9+.-]*://([^/?#:]*)'))
	WHEN 'www.platinumsg.com' THEN 'platinum-sg'
	WHEN 'platinumsg.com' THEN 'platinum-sg'
	WHEN 'www.cleanmastercarpetcleaning.com' THEN 'clean-master'
	WHEN 'cleanmastercarpetcleaning.com' THEN 'clean-master'
	WHEN 'www.emgair.com' THEN 'emg-air'
	WHEN 'emgair.com' THEN 'emg-air'
END
WHERE "site" IS NULL;
