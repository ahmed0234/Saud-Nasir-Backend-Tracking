import { getSiteCounts } from '#lib/server/analytics.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));

	// Sidebar badges only; the pages still render if this query fails.
	let siteCounts = null;
	try {
		siteCounts = await getSiteCounts(timeZone);
	} catch (error) {
		console.error('Failed to load site counts', error);
	}

	return { timeZone, siteCounts };
};
