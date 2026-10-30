ALTER TABLE "cta_clicks" ADD COLUMN "cta_placement" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "source_cta_type" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "source_cta_text" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "source_cta_placement" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "source_cta_page_url" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "source_cta_clicked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "is_header_cta" boolean GENERATED ALWAYS AS (coalesce(case when event_type = 'form_submit' then source_cta_placement else cta_placement end = 'header', false)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "utm_term" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "gclid" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "gbraid" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "wbraid" text;--> statement-breakpoint
ALTER TABLE "cta_clicks" ADD COLUMN "fbclid" text;