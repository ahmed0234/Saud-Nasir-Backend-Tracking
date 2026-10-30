import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { AUTH_PASSWORD, AUTH_SECRET, AUTH_USERNAME } from '$app/env/private';

/**
 * Single-account auth for the dashboard. Credentials live only in server env vars; a session is a
 * stateless, HMAC-signed cookie holding its expiry, so checking it costs one hash and no database
 * round trip. Sessions can't be revoked one by one: logging out clears the cookie, and changing
 * AUTH_SECRET or AUTH_PASSWORD invalidates every session at once.
 */

export const LOGIN_PATH = '/login';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const MIN_PASSWORD_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;
const TOKEN_VERSION = 'v1';

const config = loadConfig();

/** False when the auth env vars are missing or too weak; every sign-in is then refused. */
export const authConfigured = config !== null;

function loadConfig() {
	if (!AUTH_USERNAME || !AUTH_PASSWORD || !AUTH_SECRET) {
		console.error(
			'Dashboard sign-in is disabled: set AUTH_USERNAME, AUTH_PASSWORD and AUTH_SECRET.'
		);
		return null;
	}
	if (AUTH_PASSWORD.length < MIN_PASSWORD_LENGTH || AUTH_SECRET.length < MIN_SECRET_LENGTH) {
		console.error(
			`Dashboard sign-in is disabled: AUTH_PASSWORD needs ${MIN_PASSWORD_LENGTH}+ characters and AUTH_SECRET ${MIN_SECRET_LENGTH}+.`
		);
		return null;
	}

	return {
		usernameDigest: sha256(AUTH_USERNAME),
		passwordDigest: sha256(AUTH_PASSWORD),
		// Deriving the signing key from the credentials too means a password change signs out every
		// existing session, not just future ones.
		signingKey: createHmac('sha256', AUTH_SECRET)
			.update(`session:${AUTH_USERNAME}:${AUTH_PASSWORD}`)
			.digest()
	};
}

function sha256(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

function sign(payload: string, key: Buffer): Buffer {
	return createHmac('sha256', key).update(payload).digest();
}

/** Constant-time check; both fields are always compared so timing doesn't reveal which was wrong. */
export function verifyCredentials(username: string, password: string): boolean {
	if (!config) return false;
	const usernameOk = timingSafeEqual(sha256(username), config.usernameDigest);
	const passwordOk = timingSafeEqual(sha256(password), config.passwordDigest);
	return usernameOk && passwordOk;
}

function createSessionToken(expiresAt: number): string {
	const payload = `${TOKEN_VERSION}.${expiresAt}`;
	return `${payload}.${sign(payload, config!.signingKey).toString('base64url')}`;
}

function isValidSessionToken(token: string | undefined): boolean {
	if (!config || !token) return false;

	const [version, expiresAt, signature, ...rest] = token.split('.');
	if (version !== TOKEN_VERSION || !expiresAt || !signature || rest.length > 0) return false;
	if (!/^\d{1,12}$/.test(expiresAt) || Number(expiresAt) * 1000 <= Date.now()) return false;

	const expected = sign(`${version}.${expiresAt}`, config.signingKey);
	const actual = Buffer.from(signature, 'base64url');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// The __Host- prefix makes browsers reject the cookie unless it is Secure, host-only and path=/,
// so a sibling subdomain can't plant or overwrite it. Plain HTTP (local dev) can't use it.
function sessionCookie(url: URL) {
	const secure = url.protocol === 'https:';
	return {
		name: secure ? '__Host-session' : 'session',
		options: { path: '/', httpOnly: true, secure, sameSite: 'lax' as const }
	};
}

export function isAuthenticated(cookies: Cookies, url: URL): boolean {
	return isValidSessionToken(cookies.get(sessionCookie(url).name));
}

export function startSession(cookies: Cookies, url: URL): void {
	const { name, options } = sessionCookie(url);
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
	cookies.set(name, createSessionToken(expiresAt), { ...options, maxAge: SESSION_MAX_AGE_SECONDS });
}

export function endSession(cookies: Cookies, url: URL): void {
	const { name, options } = sessionCookie(url);
	cookies.delete(name, options);
}

/**
 * Where to send the user after signing in. Only same-origin paths are allowed, so the redirectTo
 * parameter can't be used to bounce someone to another site (`//evil.com`, `/\evil.com`, ...).
 */
export function safeRedirectTarget(value: unknown, base: URL): string {
	if (typeof value !== 'string' || !value.startsWith('/')) return '/';
	try {
		const target = new URL(value, base);
		if (target.origin !== base.origin || target.pathname === LOGIN_PATH) return '/';
		return target.pathname + target.search;
	} catch {
		return '/';
	}
}
