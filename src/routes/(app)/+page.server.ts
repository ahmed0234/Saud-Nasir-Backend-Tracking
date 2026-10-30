import { getDashboard } from '#lib/server/analytics.ts';
import { deleteLeadsById, MAX_DELETE_IDS, parseLeadIds } from '#lib/server/delete-leads.ts';
import { sendTestEmail } from '#lib/server/email/index.ts';
import { siteFromUrl } from '#lib/sites.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Throttle test emails to protect the Gmail quota, even for signed-in users. Per function
// instance (best-effort), which is enough to stop accidental repeats.
const TEST_EMAIL_COOLDOWN_MS = 30_000;
let lastTestEmailAt = 0;

export const load: PageServerLoad = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));
	const site = siteFromUrl(url);

	try {
		return { site, dashboard: await getDashboard(timeZone, site), error: null };
	} catch (error) {
		console.error('Failed to load dashboard', error);
		return { site, dashboard: null, error: 'Could not load tracking data from the database.' };
	}
};

export const actions: Actions = {
	sendTestEmail: async ({ request, url }) => {
		// csrf.trustedOrigins also admits the WordPress site (for tracking beacons), so require
		// this action to come from the dashboard itself.
		if (request.headers.get('origin') !== url.origin) {
			return fail(403, { message: 'Test emails can only be sent from this dashboard.' });
		}

		const waitMs = lastTestEmailAt + TEST_EMAIL_COOLDOWN_MS - Date.now();
		if (waitMs > 0) {
			return fail(429, {
				message: `Please wait ${Math.ceil(waitMs / 1000)}s before sending another test email.`
			});
		}
		lastTestEmailAt = Date.now();

		const result = await sendTestEmail();
		if (!result.ok) return fail(502, { message: result.message });
		return { message: `Test email sent to ${result.recipients.join(', ')}.` };
	},

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
