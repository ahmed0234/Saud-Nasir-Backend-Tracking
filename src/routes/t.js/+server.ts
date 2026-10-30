import { trackerScript } from '#lib/server/tracker-script.ts';
import type { RequestHandler } from './$types';

// The hosted tracker every website loads: <script src="…/t.js" data-site="SITE_KEY" defer>.
// Public (no session). Cached briefly by browsers and the CDN, so an updated tracker reaches
// every website within minutes without anyone reinstalling it.
export const GET: RequestHandler = () =>
	new Response(trackerScript, {
		headers: {
			'content-type': 'application/javascript; charset=utf-8',
			'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
			// Loadable from any website, including ones that require cross-origin resource policies.
			'cross-origin-resource-policy': 'cross-origin',
			'access-control-allow-origin': '*'
		}
	});
