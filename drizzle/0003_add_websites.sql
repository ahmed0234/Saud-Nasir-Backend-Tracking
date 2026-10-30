CREATE TABLE "website_domains" (
	"hostname" text PRIMARY KEY NOT NULL,
	"website_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"accent" text NOT NULL,
	"platform" text DEFAULT 'wordpress' NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_seen_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_website_key_websites_key_fk" FOREIGN KEY ("website_key") REFERENCES "public"."websites"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_domains_website_key_idx" ON "website_domains" USING btree ("website_key");--> statement-breakpoint
-- The three original websites, with the keys their snippets already send and their leads carry.
-- created_at keeps their sidebar order.
INSERT INTO "websites" ("key", "name", "url", "accent", "platform", "created_at") VALUES
	('platinum-sg', 'Platinum SG', 'https://www.platinumsg.com', 'oklch(0.72 0.16 295)', 'both', '2026-10-29T00:00:00Z'),
	('clean-master', 'Clean Master', 'https://www.cleanmastercarpetcleaning.com', 'oklch(0.74 0.14 230)', 'wordpress', '2026-10-29T00:01:00Z'),
	('emg-air', 'EMG Air', 'https://www.emgair.com', 'oklch(0.76 0.15 160)', 'wordpress', '2026-10-29T00:02:00Z');--> statement-breakpoint
INSERT INTO "website_domains" ("hostname", "website_key") VALUES
	('platinumsg.com', 'platinum-sg'),
	('cleanmastercarpetcleaning.com', 'clean-master'),
	('emgair.com', 'emg-air');--> statement-breakpoint
-- Their snippets are already installed but predate the install ping, so they count as last seen
-- at their most recent lead instead of "waiting for installation".
UPDATE "websites" SET
	"last_seen_at" = latest."clicked_at",
	"last_seen_url" = latest."page_url"
FROM (
	SELECT DISTINCT ON ("site") "site", "clicked_at", "page_url"
	FROM "cta_clicks"
	WHERE "site" IS NOT NULL
	ORDER BY "site", "clicked_at" DESC
) AS latest
WHERE latest."site" = "websites"."key";--> statement-breakpoint
-- Any other site key already on a lead (none expected) becomes a disabled website, so the foreign
-- key below can be added without touching lead rows.
INSERT INTO "websites" ("key", "name", "url", "accent", "disabled_at")
SELECT DISTINCT "site", "site", 'https://example.invalid', 'oklch(0.7 0 0)', now()
FROM "cta_clicks"
WHERE "site" IS NOT NULL AND "site" NOT IN (SELECT "key" FROM "websites");--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD CONSTRAINT "cta_clicks_site_websites_key_fk" FOREIGN KEY ("site") REFERENCES "public"."websites"("key") ON DELETE no action ON UPDATE no action;