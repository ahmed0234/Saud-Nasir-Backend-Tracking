import { getSiteCounts } from '#lib/server/analytics.ts';
import { getWebsites } from '#lib/server/websites.ts';
import type { Website } from '#lib/sites.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url, untrack }) => {
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));

	// Sidebar badges only; the pages still render if this query fails.
	const [siteCounts, websites] = await Promise.all([
		getSiteCounts(timeZone).catch((error) => {
			console.error('Failed to load site counts', error);
			return null;
		}),
		// Fresh, not cached: the dashboard shows install status and "last seen".
		getWebsites({ fresh: true }).catch((error): Website[] => {
			console.error('Failed to load websites', error);
			return [];
		})
	]);

	return {
		siteCounts,
		websites,
		// Where websites load the tracker from (install codes). untrack: reading the URL must not
		// make this load rerun on every navigation.
		trackerOrigin: untrack(() => url.origin)
	};
};
