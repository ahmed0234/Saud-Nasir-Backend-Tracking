import { endSession, LOGIN_PATH } from '#lib/server/auth.ts';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST only, and only from this site, so a link or another page can't sign the user out.
export const POST: RequestHandler = ({ request, url, cookies }) => {
	if (request.headers.get('origin') !== url.origin) {
		return new Response('Forbidden', { status: 403 });
	}
	endSession(cookies, url);
	redirect(303, LOGIN_PATH);
};
