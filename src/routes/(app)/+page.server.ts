import { getDashboard } from '#lib/server/analytics.ts';
import { deleteLeadsById, MAX_DELETE_IDS, parseLeadIds } from '#lib/server/delete-leads.ts';
import { selectedSite } from '#lib/server/websites.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));
	const site = await selectedSite(url).catch(() => null);

	try {
		return { site, dashboard: await getDashboard(timeZone, site), error: null };
	} catch (error) {
		console.error('Failed to load dashboard', error);
		return { site, dashboard: null, error: 'Could not load tracking data from the database.' };
	}
};

export const actions: Actions = {
	/** Permanently deletes the leads whose ids are posted as `id` fields. */
	deleteLeads: async ({ request, url }) => {
		if (request.headers.get('origin') !== url.origin) {
			return fail(403, { message: 'Leads can only be deleted from this dashboard.' });
		}

		const ids = parseLeadIds((await request.formData()).getAll('id'));
		if (!ids || ids.length === 0) return fail(400, { message: 'No valid leads were selected.' });
		if (ids.length > MAX_DELETE_IDS) {
			return fail(400, { message: `Delete at most ${MAX_DELETE_IDS} leads at a time.` });
		}

		try {
			return { deleted: await deleteLeadsById(ids) };
		} catch (error) {
			console.error('Failed to delete leads', error);
			return fail(500, { message: 'Could not delete the leads from the database.' });
		}
	}
};
