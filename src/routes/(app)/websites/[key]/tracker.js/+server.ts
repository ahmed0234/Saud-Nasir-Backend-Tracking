import { inlineTrackerScript } from '#lib/server/tracker-script.ts';
import { getWebsite } from '#lib/server/websites.ts';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The full inline install code for one website (dashboard only: behind sign-in). Fetched when
// someone opens "Full code" in the install instructions, so pages don't carry ~25 KB each.
export const GET: RequestHandler = async ({ params, url }) => {
	const website = await getWebsite(params.key);
	if (!website) error(404, 'Website not found');
	return new Response(`<script>\n${inlineTrackerScript(website.key, url.origin)}</script>\n`, {
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
	});
};
