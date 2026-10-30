import {
	authConfigured,
	isAuthenticated,
	safeRedirectTarget,
	startSession,
	verifyCredentials
} from '#lib/server/auth.ts';
import { createRateLimiter } from '#lib/server/rate-limit.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MAX_FIELD_LENGTH = 256;

// Slows password guessing to 10 tries per IP per 15 minutes (per instance, best-effort; see
// rate-limit.ts). A strong AUTH_PASSWORD is what actually makes guessing hopeless.
const rateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });

export const load: PageServerLoad = ({ cookies, url, setHeaders }) => {
	if (isAuthenticated(cookies, url)) {
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo'), url));
	}
	setHeaders({ 'cache-control': 'no-store' });
	return { configured: authConfigured };
};

export const actions: Actions = {
	default: async ({ request, url, cookies, getClientAddress }) => {
		// csrf.trustedOrigins also admits the WordPress sites (for tracking), so require sign-ins to
		// come from this page; otherwise another site could log a visitor in to a session it chose.
		if (request.headers.get('origin') !== url.origin) {
			return fail(403, { message: 'Sign-in must come from this page.', username: '' });
		}

		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		const limited = rateLimit(getClientAddress());
		if (!limited.allowed) {
			const minutes = Math.ceil(limited.retryAfterSeconds / 60);
			return fail(429, {
				message: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
				username
			});
		}

		if (!authConfigured) {
			return fail(503, {
				message: 'Sign-in is not set up on the server yet. Ask the administrator to configure it.',
				username
			});
		}
		if (!username || !password) {
			return fail(400, { message: 'Enter your username and password.', username });
		}
		if (
			username.length > MAX_FIELD_LENGTH ||
			password.length > MAX_FIELD_LENGTH ||
			!verifyCredentials(username, password)
		) {
			return fail(401, { message: 'Incorrect username or password.', username });
		}

		startSession(cookies, url);
		redirect(303, safeRedirectTarget(form.get('redirectTo'), url));
	}
};
