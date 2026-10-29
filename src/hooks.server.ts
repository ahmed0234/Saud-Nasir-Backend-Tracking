import type { Handle } from '@sveltejs/kit/hooks';

// Baseline security headers for every response. The dashboard is private analytics, so it is
// also kept out of search engines and can't be framed by other sites.
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	if (!event.url.pathname.startsWith('/api/')) {
		response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
	}

	return response;
};
