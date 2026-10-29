import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const ctaClicks = pgTable(
	'cta_clicks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Which website the lead came from (an id from src/lib/sites.ts). Null only for leads from a
		// domain that isn't one of the configured sites (e.g. rows recorded before this column).
		site: text('site'),
		// 'cta_click' or 'form_submit'. Rows recorded before this column were all CTA clicks.
		eventType: text('event_type').notNull().default('cta_click'),
		// What was clicked: call, booking, email, sms, button, elementor_form, fluent_form, ...
		// Null for rows recorded before this column.
		buttonType: text('button_type'),
		buttonText: text('button_text'),
		formName: text('form_name'),
		pageUrl: text('page_url').notNull(),
		// The page route (path without query or fragment), always derived from page_url.
		pagePath: text('page_path').generatedAlwaysAs(
			sql`coalesce(nullif(substring(page_url from '^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]*([^?#]*)'), ''), '/')`
		),
		city: text('city'),
		state: text('state'),
		// timestamptz stores an absolute instant (UTC internally). The API passes a validated client
		// timestamp or server time; the default only covers inserts made outside the API.
		clickedAt: timestamp('clicked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('cta_clicks_clicked_at_idx').on(table.clickedAt),
		index('cta_clicks_site_clicked_at_idx').on(table.site, table.clickedAt)
	]
);

export type CtaClick = typeof ctaClicks.$inferSelect;
export type NewCtaClick = typeof ctaClicks.$inferInsert;
