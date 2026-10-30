import { isAuthenticated, LOGIN_PATH } from '#lib/server/auth.ts';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

// Every route requires a session unless it is listed here (the path itself and anything below it).
// The tracking endpoint must stay public: the WordPress snippets post to it without a session.
const PUBLIC_ROUTES = [LOGIN_PATH, '/logout', '/api/cta-click'];

function isPublicRoute(pathname: string): boolean {
	return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function denyAccess(event: RequestEvent): Response {
	const { method } = event.request;
	// Page loads go to the sign-in page and come back afterwards. For client-side navigations
	// (data requests) SvelteKit turns this redirect into one the client router follows.
	if ((method === 'GET' || method === 'HEAD') && !event.url.pathname.startsWith('/api/')) {
		const target = event.url.pathname + event.url.search;
		const location =
			target === '/' ? LOGIN_PATH : `${LOGIN_PATH}?redirectTo=${encodeURIComponent(target)}`;
		return new Response(null, {
			status: 303,
			headers: { location, 'cache-control': 'no-store' }
		});
	}
	return new Response('Authentication required', {
		status: 401,
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
	});
}

export const handle: Handle = async ({ event, resolve }) => {
	const allowed = isPublicRoute(event.url.pathname) || isAuthenticated(event.cookies, event.url);
	const response = allowed ? await resolve(event) : denyAccess(event);

	// Baseline security headers for every response. The dashboard is private analytics, so it is
	// also kept out of search engines and can't be framed by other sites.
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
