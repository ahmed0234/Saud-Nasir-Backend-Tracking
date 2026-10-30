import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Websites that may send leads. Managed from the dashboard; never hard-deleted (disabling keeps
// their leads and stops new ones).
export const websites = pgTable('websites', {
	// Public site key, sent by the tracking script and stored in cta_clicks.site. Never changes.
	key: text('key').primaryKey(),
	name: text('name').notNull(),
	// Home page, e.g. https://www.example.com (links and display).
	url: text('url').notNull(),
	accent: text('accent').notNull(),
	// 'wordpress' | 'html' | 'both': which install instructions the dashboard shows.
	platform: text('platform').notNull().default('wordpress'),
	// Set when disabled: the API then rejects its events. Null = active.
	disabledAt: timestamp('disabled_at', { withTimezone: true, mode: 'date' }),
	// When its tracking script last reported in (install ping or lead), and from which page.
	lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
	lastSeenUrl: text('last_seen_url'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

// Hostnames a website's events may come from, without "www." (www and non-www both match). A
// hostname belongs to exactly one website.
export const websiteDomains = pgTable(
	'website_domains',
	{
		hostname: text('hostname').primaryKey(),
		websiteKey: text('website_key')
			.notNull()
			.references(() => websites.key, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [index('website_domains_website_key_idx').on(table.websiteKey)]
);

export const ctaClicks = pgTable(
	'cta_clicks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Which website the lead came from (its site key). Null only for leads from domains that
		// were never a registered website (two old rows from before this column).
		site: text('site').references(() => websites.key),
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
		clickedAt: timestamp('clicked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),

		// Where on the page a CTA click happened: 'header' (incl. mobile menus), 'footer' or 'page'.
		// CTA clicks only; null for form submissions and rows recorded before this column.
		ctaPlacement: text('cta_placement'),
		// For form submissions: the most recent CTA the visitor clicked within 30 minutes before
		// submitting (e.g. a header "Book Now" that led to the contact page). Null when there was none.
		sourceCtaType: text('source_cta_type'),
		sourceCtaText: text('source_cta_text'),
		sourceCtaPlacement: text('source_cta_placement'),
		sourceCtaPageUrl: text('source_cta_page_url'),
		sourceCtaClickedAt: timestamp('source_cta_clicked_at', { withTimezone: true, mode: 'date' }),
		// True when the lead came from a header CTA: a header click itself, or a form submission
		// attributed to one. Derived, so it can't drift from the columns above.
		isHeaderCta: boolean('is_header_cta')
			.notNull()
			.generatedAlwaysAs(
				sql`coalesce(case when event_type = 'form_submit' then source_cta_placement else cta_placement end = 'header', false)`
			),

		// Campaign attribution, captured from the visitor's landing page URL and kept for 90 days
		// in their browser. Null when the visit had none.
		utmSource: text('utm_source'),
		utmMedium: text('utm_medium'),
		utmCampaign: text('utm_campaign'),
		utmTerm: text('utm_term'),
		utmContent: text('utm_content'),
		gclid: text('gclid'),
		gbraid: text('gbraid'),
		wbraid: text('wbraid'),
		fbclid: text('fbclid')
	},
	(table) => [
		index('cta_clicks_clicked_at_idx').on(table.clickedAt),
		index('cta_clicks_site_clicked_at_idx').on(table.site, table.clickedAt)
	]
);

export type CtaClick = typeof ctaClicks.$inferSelect;
export type NewCtaClick = typeof ctaClicks.$inferInsert;
