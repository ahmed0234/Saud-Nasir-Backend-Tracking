import { getDashboard } from '#lib/server/analytics.ts';
import { sendTestEmail } from '#lib/server/email/index.ts';
import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// The dashboard has no auth, so throttle test emails to protect the Gmail quota. Per function
// instance (best-effort), which is enough to stop accidental or scripted repeats.
const TEST_EMAIL_COOLDOWN_MS = 30_000;
let lastTestEmailAt = 0;

export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const timeZone = resolveTimeZone(cookies.get(TIME_ZONE_COOKIE));

	try {
		return { dashboard: await getDashboard(timeZone), error: null };
	} catch (error) {
		console.error('Failed to load dashboard', error);
		return { dashboard: null, error: 'Could not load tracking data from the database.' };
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
	}
};
