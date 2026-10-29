import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const ctaClicks = pgTable(
	'cta_clicks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		pageUrl: text('page_url').notNull(),
		city: text('city'),
		state: text('state'),
		// timestamptz stores an absolute instant (UTC internally). The API passes a validated client
		// timestamp or server time; the default only covers inserts made outside the API.
		clickedAt: timestamp('clicked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [index('cta_clicks_clicked_at_idx').on(table.clickedAt)]
);

export type CtaClick = typeof ctaClicks.$inferSelect;
export type NewCtaClick = typeof ctaClicks.$inferInsert;
