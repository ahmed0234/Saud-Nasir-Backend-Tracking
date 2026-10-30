import { isAuthenticated, LOGIN_PATH } from '#lib/server/auth.ts';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

// Every route requires a session unless it is listed here (the path itself and anything below it).
// The tracking endpoint and script must stay public: websites load and post to them without a
// session.
const TRACKING_ENDPOINT = '/api/cta-click';
const PUBLIC_ROUTES = [LOGIN_PATH, '/logout', TRACKING_ENDPOINT, '/t.js'];
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPublicRoute(pathname: string): boolean {
	return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * CSRF protection. SvelteKit's own origin check is off (vite.config.ts) because registered
 * websites post tracking events cross-origin and are only known at runtime. Instead, every
 * state-changing request must come from this app's own origin, except the tracking endpoint,
 * which checks origins against the website registry itself. This also covers JSON requests,
 * which SvelteKit's check never did.
 */
function isCrossSiteWrite(event: RequestEvent): boolean {
	if (!UNSAFE_METHODS.has(event.request.method)) return false;
	if (event.url.pathname === TRACKING_ENDPOINT) return false;
	return event.request.headers.get('origin') !== event.url.origin;
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
	let response: Response;
	if (isCrossSiteWrite(event)) {
		response = new Response('Cross-site requests are not allowed', {
			status: 403,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
		});
	} else {
		const allowed = isPublicRoute(event.url.pathname) || isAuthenticated(event.cookies, event.url);
		response = allowed ? await resolve(event) : denyAccess(event);
	}

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
