// Re-classifies existing leads with the current rules in src/lib/traffic-source.ts, using only
// evidence already stored with each lead. Safe to run more than once.
//
//   bun run db:backfill-sources            (reads DATABASE_URL from .env)
//   bun run db:backfill-sources --dry-run  (prints the changes, writes nothing)
//
// 1. Leads that already have source data (a traffic source, UTMs, click IDs or a referrer) are
//    classified again from those stored values, so rule changes (e.g. "Meta Ads" split into
//    Facebook Ads / Instagram Ads, new AI assistants) reach them.
// 2. Leads with no source data at all (old inline snippets) are checked for campaign parameters
//    in the URLs stored with them (the lead's page, its landing page, the page of the CTA it is
//    credited to): a lead submitted on `/?utm_source=instagram` did come from that link. Those
//    parameters are copied into the lead's empty campaign columns and classified.
// 3. Everything else keeps a null source. A missing referrer on an old snippet's lead isn't
//    evidence of a direct visit, so no source is invented. Nothing else on a lead is changed.

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { ctaClicks } from '../src/lib/server/db/schema.ts';
import { CAMPAIGN_FIELDS, type Campaign } from '../src/lib/sites.ts';
import { classifyTrafficSource } from '../src/lib/traffic-source.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const dryRun = process.argv.includes('--dry-run');
const db = drizzle({ client: neon(process.env.DATABASE_URL) });

const CLICK_ID = /^[A-Za-z0-9._~-]+$/;
const CLICK_ID_KEYS = new Set([
	'gclid',
	'gbraid',
	'wbraid',
	'fbclid',
	'msclkid',
	'ttclid',
	'liFatId',
	'twclid'
]);

/** Campaign parameters in a stored URL's query string, or null when it has none. */
function campaignFromUrl(value: string | null): Partial<Campaign> | null {
	if (!value) return null;
	let params: URLSearchParams;
	try {
		params = new URL(value).searchParams;
	} catch {
		return null;
	}
	const found: Partial<Campaign> = {};
	for (const { key, param } of CAMPAIGN_FIELDS) {
		const text = params.get(param)?.trim().slice(0, 255);
		if (!text || (CLICK_ID_KEYS.has(key) && !CLICK_ID.test(text))) continue;
		found[key] = text;
	}
	return Object.keys(found).length ? found : null;
}

const rows = await db.select().from(ctaClicks);
let changed = 0;
let fromUrls = 0;
let unknown = 0;

for (const row of rows) {
	const hasCampaign = CAMPAIGN_FIELDS.some(({ key }) => row[key]);
	let campaign: Campaign = Object.fromEntries(
		CAMPAIGN_FIELDS.map(({ key }) => [key, row[key]])
	) as Campaign;
	let filled: Partial<Campaign> = {};

	if (!row.trafficSource && !hasCampaign && !row.referrer) {
		// Old snippet: look for campaign parameters in the URLs it stored.
		const found =
			campaignFromUrl(row.landingPageUrl) ??
			campaignFromUrl(row.sourceCtaPageUrl) ??
			campaignFromUrl(row.pageUrl);
		if (!found) {
			unknown++;
			continue;
		}
		filled = found;
		campaign = { ...campaign, ...found };
		fromUrls++;
	}

	const { source, channel } = classifyTrafficSource({ ...campaign, referrer: row.referrer });
	if (source === row.trafficSource && channel === row.trafficChannel) continue;

	changed++;
	console.log(
		`${row.id}  ${row.trafficSource ?? '(none)'} → ${source} (${channel})` +
			(Object.keys(filled).length ? `  from URL: ${JSON.stringify(filled)}` : '')
	);
	if (!dryRun) {
		await db
			.update(ctaClicks)
			.set({ ...filled, trafficSource: source, trafficChannel: channel })
			.where(eq(ctaClicks.id, row.id));
	}
}

console.log(
	`${dryRun ? '[dry run] would update' : 'Updated'} ${changed} of ${rows.length} lead(s); ` +
		`${fromUrls} classified from campaign parameters in their stored URLs; ` +
		`${unknown} without any source evidence left unchanged.`
);
