import { count, countDistinct, desc, eq, gte, lt, and, sql, type SQL } from 'drizzle-orm';
import type { Campaign } from '#lib/sites.ts';
import { db } from './db/index.ts';
import { ctaClicks } from './db/schema.ts';

// All aggregation happens in Postgres. Timestamps are timestamptz (UTC); `timeZone` is only
// used to decide where local days/hours start, so buckets match the viewer's calendar.
// `site` narrows every query to one website's leads; null means all websites.

export type DashboardSummary = {
	total: number;
	today: number;
	last7Days: number;
	uniquePages: number;
	ctaClicks: number;
	formSubmissions: number;
};

export type RecentClick = Campaign & {
	id: string;
	site: string | null;
	eventType: string;
	buttonType: string | null;
	buttonText: string | null;
	formName: string | null;
	pageUrl: string;
	pagePath: string | null;
	city: string | null;
	state: string | null;
	clickedAt: string;
	ctaPlacement: string | null;
	sourceCtaType: string | null;
	sourceCtaText: string | null;
	sourceCtaPlacement: string | null;
	sourceCtaPageUrl: string | null;
	sourceCtaClickedAt: string | null;
	isHeaderCta: boolean;
	referrer: string | null;
	landingPageUrl: string | null;
	trafficSource: string | null;
	trafficChannel: string | null;
};

/** Leads per traffic source; source and channel are null for leads recorded without one. */
export type SourceBreakdown = { source: string | null; channel: string | null; clicks: number }[];

export type Bucket = { start: string; clicks: number };
export type Breakdown = { label: string; detail: string | null; clicks: number };

export type RangeAnalytics = {
	summary: {
		total: number;
		previousTotal: number;
		uniquePages: number;
		uniqueLocations: number;
		locatedShare: number;
		ctaClicks: number;
		formSubmissions: number;
	};
	timeline: { unit: 'hour' | 'day'; buckets: Bucket[] };
	daily: Bucket[];
	cities: Breakdown[];
	states: Breakdown[];
	pages: Breakdown[];
	/** Lead kinds: event type + button type (call, booking, elementor_form, ...). */
	types: { eventType: string; buttonType: string | null; clicks: number }[];
	buttons: { eventType: string; label: string; clicks: number }[];
	sites: { site: string | null; clicks: number }[];
	/** Leads by CTA location ('header' | 'footer' | 'page'), or null when no CTA was recorded. */
	origins: { placement: string | null; clicks: number }[];
	/** Leads by UTM source / medium, or by ad network when only a click ID was present. */
	campaigns: Breakdown[];
	/** Leads by traffic source (Google Ads, Meta Ads, ChatGPT, Direct, ...). */
	sources: SourceBreakdown;
};

export type SiteCounts = { site: string | null; total: number; today: number }[];

export const RECENT_LIMIT = 50;
const BREAKDOWN_LIMIT = 10;

const localMidnight = (timeZone: string) =>
	sql`(date_trunc('day', now() at time zone ${timeZone}) at time zone ${timeZone})`;

const forSite = (site: string | null) => (site ? eq(ctaClicks.site, site) : undefined);

const countWhere = (condition: SQL) => sql<number>`(count(*) filter (where ${condition}))::int`;
const isFormSubmit = sql`${ctaClicks.eventType} = 'form_submit'`;

// Where a lead came from: its own CTA's location, or for a form the location of the CTA it is
// credited to (same rule as the is_header_cta column).
const leadPlacement = sql<
	string | null
>`case when ${isFormSubmit} then ${ctaClicks.sourceCtaPlacement} else ${ctaClicks.ctaPlacement} end`;
// "source / medium" when UTMs were present, else the ad network implied by a click ID.
const campaignLabel = sql<string>`coalesce(
	nullif(concat_ws(' / ', ${ctaClicks.utmSource}, ${ctaClicks.utmMedium}), ''),
	case
		when coalesce(${ctaClicks.gclid}, ${ctaClicks.gbraid}, ${ctaClicks.wbraid}) is not null then 'Google Ads (auto-tagged)'
		when ${ctaClicks.msclkid} is not null then 'Microsoft Ads (auto-tagged)'
		when ${ctaClicks.ttclid} is not null then 'TikTok Ads (auto-tagged)'
		when ${ctaClicks.liFatId} is not null then 'LinkedIn Ads (auto-tagged)'
		when ${ctaClicks.twclid} is not null then 'X Ads (auto-tagged)'
		when ${ctaClicks.fbclid} is not null then 'Facebook / Instagram (fbclid, no UTMs)'
		else 'No campaign (direct, organic or referral)'
	end
)`;

const sourceBreakdown = (where: SQL | undefined) =>
	db
		.select({
			source: ctaClicks.trafficSource,
			channel: ctaClicks.trafficChannel,
			clicks: count()
		})
		.from(ctaClicks)
		.where(where)
		.groupBy(ctaClicks.trafficSource, ctaClicks.trafficChannel)
		.orderBy(desc(count()), ctaClicks.trafficSource)
		.limit(BREAKDOWN_LIMIT);

/** All-time and today's lead counts per site, for the sidebar. */
export async function getSiteCounts(timeZone: string): Promise<SiteCounts> {
	return db
		.select({
			site: ctaClicks.site,
			total: count(),
			today: countWhere(sql`${ctaClicks.clickedAt} >= ${localMidnight(timeZone)}`)
		})
		.from(ctaClicks)
		.groupBy(ctaClicks.site);
}

export async function getDashboard(timeZone: string, site: string | null) {
	const [summaryRows, recent, sources] = await Promise.all([
		db
			.select({
				total: count(),
				today: sql<number>`(count(*) filter (where ${ctaClicks.clickedAt} >= ${localMidnight(timeZone)}))::int`,
				last7Days: sql<number>`(count(*) filter (where ${ctaClicks.clickedAt} >= now() - interval '7 days'))::int`,
				uniquePages: countDistinct(ctaClicks.pageUrl),
				ctaClicks: countWhere(sql`not (${isFormSubmit})`),
				formSubmissions: countWhere(isFormSubmit)
			})
			.from(ctaClicks)
			.where(forSite(site)),
		db
			.select()
			.from(ctaClicks)
			.where(forSite(site))
			.orderBy(desc(ctaClicks.clickedAt), desc(ctaClicks.id))
			.limit(RECENT_LIMIT),
		sourceBreakdown(forSite(site))
	]);

	return {
		loadedAt: new Date().toISOString(),
		limit: RECENT_LIMIT,
		summary: summaryRows[0] satisfies DashboardSummary,
		sources: sources satisfies SourceBreakdown,
		recent: recent.map((row): RecentClick => ({
			...row,
			clickedAt: row.clickedAt.toISOString(),
			sourceCtaClickedAt: row.sourceCtaClickedAt?.toISOString() ?? null
		}))
	};
}

export async function getRangeAnalytics(
	start: Date,
	end: Date,
	timeZone: string,
	site: string | null
): Promise<RangeAnalytics> {
	const inRange = and(gte(ctaClicks.clickedAt, start), lt(ctaClicks.clickedAt, end), forSite(site));
	const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
	// Hourly detail for short ranges, daily otherwise.
	const unit = end.getTime() - start.getTime() <= 3 * 24 * 60 * 60_000 ? 'hour' : 'day';

	const [
		summaryRows,
		previousRows,
		timeline,
		daily,
		cities,
		states,
		pages,
		types,
		buttons,
		sites,
		origins,
		campaigns,
		sources
	] = await Promise.all([
		db
			.select({
				total: count(),
				uniquePages: countDistinct(ctaClicks.pageUrl),
				uniqueLocations: sql<number>`(count(distinct (${ctaClicks.city}, ${ctaClicks.state})) filter (where ${ctaClicks.city} is not null or ${ctaClicks.state} is not null))::int`,
				located: sql<number>`(count(*) filter (where ${ctaClicks.city} is not null or ${ctaClicks.state} is not null))::int`,
				ctaClicks: countWhere(sql`not (${isFormSubmit})`),
				formSubmissions: countWhere(isFormSubmit)
			})
			.from(ctaClicks)
			.where(inRange),
		db
			.select({ total: count() })
			.from(ctaClicks)
			.where(
				and(gte(ctaClicks.clickedAt, previousStart), lt(ctaClicks.clickedAt, start), forSite(site))
			),
		buckets(start, end, timeZone, unit, site),
		buckets(start, end, timeZone, 'day', site),
		db
			.select({
				city: ctaClicks.city,
				state: ctaClicks.state,
				clicks: count()
			})
			.from(ctaClicks)
			.where(inRange)
			.groupBy(ctaClicks.city, ctaClicks.state)
			.orderBy(desc(count()))
			.limit(BREAKDOWN_LIMIT),
		db
			.select({ state: ctaClicks.state, clicks: count() })
			.from(ctaClicks)
			.where(inRange)
			.groupBy(ctaClicks.state)
			.orderBy(desc(count()))
			.limit(BREAKDOWN_LIMIT),
		db
			.select({ pageUrl: ctaClicks.pageUrl, clicks: count() })
			.from(ctaClicks)
			.where(inRange)
			.groupBy(ctaClicks.pageUrl)
			.orderBy(desc(count()))
			.limit(BREAKDOWN_LIMIT),
		db
			.select({
				eventType: ctaClicks.eventType,
				buttonType: ctaClicks.buttonType,
				clicks: count()
			})
			.from(ctaClicks)
			.where(inRange)
			.groupBy(ctaClicks.eventType, ctaClicks.buttonType)
			.orderBy(desc(count())),
		db
			.select({ eventType: ctaClicks.eventType, label: ctaClicks.buttonText, clicks: count() })
			.from(ctaClicks)
			.where(and(inRange, sql`${ctaClicks.buttonText} is not null`))
			.groupBy(ctaClicks.eventType, ctaClicks.buttonText)
			.orderBy(desc(count()))
			.limit(BREAKDOWN_LIMIT),
		db
			.select({ site: ctaClicks.site, clicks: count() })
			.from(ctaClicks)
			.where(inRange)
			.groupBy(ctaClicks.site)
			.orderBy(desc(count())),
		db
			.select({ placement: leadPlacement, clicks: count() })
			.from(ctaClicks)
			.where(inRange)
			.groupBy(leadPlacement)
			.orderBy(desc(count())),
		db
			.select({ label: campaignLabel, clicks: count() })
			.from(ctaClicks)
			.where(inRange)
			.groupBy(campaignLabel)
			.orderBy(desc(count()))
			.limit(BREAKDOWN_LIMIT),
		sourceBreakdown(inRange)
	]);

	const summary = summaryRows[0];

	return {
		summary: {
			total: summary.total,
			previousTotal: previousRows[0].total,
			uniquePages: summary.uniquePages,
			uniqueLocations: summary.uniqueLocations,
			locatedShare: summary.total === 0 ? 0 : summary.located / summary.total,
			ctaClicks: summary.ctaClicks,
			formSubmissions: summary.formSubmissions
		},
		timeline: { unit, buckets: timeline },
		daily,
		cities: cities.map((row) => ({
			label: row.city ?? 'Unknown city',
			detail: row.state,
			clicks: row.clicks
		})),
		states: states.map((row) => ({
			label: row.state ?? 'Unknown state',
			detail: null,
			clicks: row.clicks
		})),
		pages: pages.map((row) => ({ label: row.pageUrl, detail: null, clicks: row.clicks })),
		types,
		buttons: buttons.map((row) => ({ ...row, label: row.label ?? '' })),
		sites,
		origins,
		campaigns: campaigns.map((row) => ({ label: row.label, detail: null, clicks: row.clicks })),
		sources
	};
}

/**
 * Click counts per local hour/day across [start, end), including empty buckets so charts show
 * gaps as zero. Bucket starts are returned as UTC ISO instants.
 */
async function buckets(
	start: Date,
	end: Date,
	timeZone: string,
	unit: 'hour' | 'day',
	site: string | null
): Promise<Bucket[]> {
	const step = unit === 'hour' ? sql`interval '1 hour'` : sql`interval '1 day'`;
	const truncLocal = (value: unknown) =>
		sql`date_trunc(${unit}, (${value}) at time zone ${timeZone})`;

	const result = await db.execute<{ start: string; clicks: number }>(sql`
		with series as (
			select generate_series(
				${truncLocal(sql`${start.toISOString()}::timestamptz`)},
				${truncLocal(sql`${end.toISOString()}::timestamptz - interval '1 microsecond'`)},
				${step}
			) as local_start
		),
		counts as (
			select ${truncLocal(ctaClicks.clickedAt)} as local_start, count(*)::int as clicks
			from ${ctaClicks}
			where ${ctaClicks.clickedAt} >= ${start.toISOString()}::timestamptz
				and ${ctaClicks.clickedAt} < ${end.toISOString()}::timestamptz
				${site ? sql`and ${ctaClicks.site} = ${site}` : sql``}
			group by 1
		)
		select
			to_char((series.local_start at time zone ${timeZone}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start,
			coalesce(counts.clicks, 0)::int as clicks
		from series
		left join counts using (local_start)
		order by series.local_start
	`);

	return result.rows.map((row) => ({ start: row.start, clicks: Number(row.clicks) }));
}

/**
 * UTC instants for the start of local day `from` and the end of local day `to` (YYYY-MM-DD) in
 * `timeZone`. Done in Postgres so daylight-saving transitions are handled correctly.
 */
export async function localDayBounds(from: string, to: string, timeZone: string) {
	const result = await db.execute<{ start: string; end: string }>(sql`
		select
			to_char((${from}::date::timestamp at time zone ${timeZone}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start,
			to_char(((${to}::date + 1)::timestamp at time zone ${timeZone}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end
	`);
	const row = result.rows[0];
	return { start: new Date(row.start), end: new Date(row.end) };
}
