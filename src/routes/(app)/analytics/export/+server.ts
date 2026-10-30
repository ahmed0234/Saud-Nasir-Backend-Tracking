import { toLocalIsoDate } from '#lib/date-range.ts';
import { parseRange } from '#lib/server/delete-leads.ts';
import { getLeadsForExport, leadsToCsv } from '#lib/server/export-leads.ts';
import { getWebsites, selectedSite } from '#lib/server/websites.ts';
import { SITE_URL_PARAM } from '#lib/sites.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /analytics/export?start&end[&site] → CSV of every lead in [start, end), the exact instants
// the analytics page showed (like deleteRange). Behind the dashboard sign-in like every page.
export const GET: RequestHandler = async ({ url, cookies }) => {
	const range = parseRange(url.searchParams.get('start'), url.searchParams.get('end'));
	if (!range) error(400, 'Invalid date range.');
	const site = await selectedSite(url);
	// An unknown site must not silently widen the export to all websites.
	if (url.searchParams.get(SITE_URL_PARAM) && !site) error(400, 'Unknown website.');
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));

	const [rows, websites] = await Promise.all([
		getLeadsForExport(range.start, range.end, site),
		getWebsites()
	]);
	const siteNames = new Map(websites.map((website) => [website.key, website.name]));

	const from = toLocalIsoDate(range.start, timeZone);
	const to = toLocalIsoDate(new Date(range.end.getTime() - 1), timeZone);
	const filename = `${site ?? 'all-websites'}-leads-${from === to ? from : `${from}-to-${to}`}.csv`;

	return new Response(leadsToCsv(rows, timeZone, siteNames), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': 'no-store',
			'x-lead-count': String(rows.length)
		}
	});
};
