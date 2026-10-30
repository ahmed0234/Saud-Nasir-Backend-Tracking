import {
	DEFAULT_RANGE,
	isIsoDate,
	MAX_CUSTOM_DAYS,
	PRESETS,
	toLocalIsoDate,
	type RangeKey
} from '#lib/date-range.ts';
import { getRangeAnalytics, localDayBounds } from '#lib/server/analytics.ts';
import { deleteLeadsInRange, parseRange } from '#lib/server/delete-leads.ts';
import { getWebsite, selectedSite } from '#lib/server/websites.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const DAY_MS = 24 * 60 * 60_000;

export const load: PageServerLoad = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));
	const site = await selectedSite(url).catch(() => null);
	const now = new Date();

	let key: RangeKey = DEFAULT_RANGE;
	let notice: string | null = null;
	let start: Date;
	let end: Date;

	const requested = url.searchParams.get('range');
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	try {
		if (requested === 'custom') {
			if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
				notice = 'Invalid custom range. Showing the last 7 days instead.';
			} else if (Date.parse(to) - Date.parse(from) >= MAX_CUSTOM_DAYS * DAY_MS) {
				notice = `Custom ranges can span at most ${MAX_CUSTOM_DAYS} days. Showing the last 7 days instead.`;
			} else {
				key = 'custom';
			}
		} else if (PRESETS.some((preset) => preset.key === requested)) {
			key = requested as RangeKey;
		}

		if (key === 'custom') {
			({ start, end } = await localDayBounds(from!, to!, timeZone));
		} else {
			const preset = PRESETS.find((p) => p.key === key)!;
			end = now;
			start = new Date(now.getTime() - preset.hours * 60 * 60_000);
		}

		return {
			site,
			range: {
				key,
				start: start.toISOString(),
				end: end.toISOString(),
				from: key === 'custom' ? from! : toLocalIsoDate(start, timeZone),
				to: key === 'custom' ? to! : toLocalIsoDate(now, timeZone)
			},
			analytics: await getRangeAnalytics(start, end, timeZone, site),
			loadedAt: now.toISOString(),
			notice,
			error: null
		};
	} catch (error) {
		console.error('Failed to load analytics', error);
		return {
			site,
			range: {
				key,
				start: null,
				end: null,
				from: from ?? toLocalIsoDate(now, timeZone),
				to: to ?? toLocalIsoDate(now, timeZone)
			},
			analytics: null,
			loadedAt: now.toISOString(),
			notice,
			error: 'Could not load analytics from the database.'
		};
	}
};

export const actions: Actions = {
	/**
	 * Permanently deletes every lead in the range the page showed: the exact [start, end) instants
	 * from `load`, so a rolling preset deletes what was on screen, not leads that arrived since.
	 */
	deleteRange: async ({ request, url }) => {
		if (request.headers.get('origin') !== url.origin) {
			return fail(403, { message: 'Leads can only be deleted from this dashboard.' });
		}

		const form = await request.formData();
		const range = parseRange(form.get('start'), form.get('end'));
		if (!range) return fail(400, { message: 'Invalid date range.' });
		// Empty means all websites; anything else must be a registered website.
		const siteValue = form.get('site') ?? '';
		const site = typeof siteValue === 'string' && siteValue ? await getWebsite(siteValue) : null;
		if (siteValue !== '' && !site) return fail(400, { message: 'Unknown website.' });

		try {
			return {
				deleted: await deleteLeadsInRange(range.start, range.end, site?.key ?? null)
			};
		} catch (error) {
			console.error('Failed to delete leads in range', error);
			return fail(500, { message: 'Could not delete the leads from the database.' });
		}
	}
};
