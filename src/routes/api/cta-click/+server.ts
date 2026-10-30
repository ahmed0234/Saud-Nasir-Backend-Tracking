import { db } from '#lib/server/db/index.ts';
import { ctaClicks } from '#lib/server/db/schema.ts';
import { sendCtaClickNotification } from '#lib/server/email/index.ts';
import { geoFromHeaders } from '#lib/server/geo.ts';
import { createRateLimiter } from '#lib/server/rate-limit.ts';
import {
	CAMPAIGN_FIELDS,
	isCtaPlacement,
	isEventType,
	isSiteId,
	siteForHost,
	type Campaign,
	type CampaignKey,
	type CtaPlacement,
	type EventType,
	type SiteId
} from '#lib/sites.ts';
import { CORS_ALLOWED_ORIGINS } from '$app/env/private';
import { waitUntil } from '@vercel/functions';
import type { RequestHandler } from './$types';

// Two page URLs (the lead's and its source CTA's) plus campaign parameters fit comfortably.
const MAX_BODY_BYTES = 8192;
const MAX_URL_LENGTH = 2048;
const MAX_PLACE_LENGTH = 120;
const MAX_LABEL_LENGTH = 120;
const MAX_CAMPAIGN_LENGTH = 255;
const BUTTON_TYPE_PATTERN = /^[a-z0-9_-]{1,40}$/;
// Ad click IDs are URL-safe tokens; anything else is not a real click ID.
const CLICK_ID_PATTERN = /^[\w.~-]{1,255}$/;
const CLICK_ID_KEYS = new Set<CampaignKey>(['gclid', 'gbraid', 'wbraid', 'fbclid']);
// Accept client timestamps only within this window around server time; outside it (bad device
// clock, replayed request) the server's own time is used instead.
const MAX_CLOCK_SKEW_PAST_MS = 24 * 60 * 60_000;
const MAX_CLOCK_SKEW_FUTURE_MS = 5 * 60_000;
// The snippets credit a CTA clicked up to 30 minutes before a form submission; a little slack
// covers clock differences and slow form plugins.
const MAX_SOURCE_AGE_MS = 35 * 60_000;

// Each accepted click writes a row and sends an email, so cap clicks per visitor IP. A real
// visitor never clicks 30 CTAs a minute; a script hammering the endpoint does.
const rateLimit = createRateLimiter({ limit: 30, windowMs: 60_000 });

type ClickPayload = {
	site?: unknown;
	eventType?: unknown;
	buttonType?: unknown;
	buttonText?: unknown;
	formName?: unknown;
	pageUrl?: unknown;
	city?: unknown;
	state?: unknown;
	clickedAt?: unknown;
	/** CTA clicks: 'header' | 'footer' | 'page'. */
	placement?: unknown;
	/** Form submissions: the CTA clicked shortly before, as { type, text, placement, pageUrl, clickedAt }. */
	source?: unknown;
	/** Campaign parameters from the landing page: { utmSource, ..., gclid, gbraid, wbraid, fbclid }. */
	attribution?: unknown;
};

type SourceCta = Pick<
	typeof ctaClicks.$inferInsert,
	| 'sourceCtaType'
	| 'sourceCtaText'
	| 'sourceCtaPlacement'
	| 'sourceCtaPageUrl'
	| 'sourceCtaClickedAt'
>;

const NO_SOURCE: SourceCta = {
	sourceCtaType: null,
	sourceCtaText: null,
	sourceCtaPlacement: null,
	sourceCtaPageUrl: null,
	sourceCtaClickedAt: null
};

class ValidationError extends Error {}

function isAllowedOrigin(origin: string | null): origin is string {
	return origin !== null && CORS_ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin: string | null): Headers {
	const headers = new Headers({ Vary: 'Origin' });
	if (isAllowedOrigin(origin)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
		headers.set('Access-Control-Allow-Headers', 'Content-Type');
		headers.set('Access-Control-Max-Age', '86400');
	}
	return headers;
}

function json(body: unknown, status: number, headers: Headers): Response {
	headers.set('Content-Type', 'application/json');
	return new Response(JSON.stringify(body), { status, headers });
}

function parsePageUrl(value: unknown): URL {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) {
		throw new ValidationError('pageUrl must be an absolute http(s) URL');
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new ValidationError('pageUrl must be an absolute http(s) URL');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new ValidationError('pageUrl must be an absolute http(s) URL');
	}
	// Only record pages that belong to the configured WordPress site(s).
	if (!CORS_ALLOWED_ORIGINS.includes(url.origin)) {
		throw new ValidationError('pageUrl must belong to an allowed site');
	}
	return url;
}

/**
 * The page's domain decides the site when it is one of the configured production domains, so a
 * snippet pasted on the wrong site can't mislabel leads. Otherwise (staging or temporary domains
 * that are in CORS_ALLOWED_ORIGINS) the snippet's own identifier is used. Old snippets send none.
 */
function resolveSite(value: unknown, pageUrl: URL): SiteId | null {
	if (value !== undefined && value !== null && !isSiteId(value)) {
		throw new ValidationError('site must be a known site identifier');
	}
	const byHost = siteForHost(pageUrl.hostname);
	if (byHost && value && byHost.id !== value) {
		console.warn(`Snippet for "${value}" is running on ${pageUrl.host}; recording as ${byHost.id}`);
	}
	return byHost?.id ?? value ?? null;
}

function parseEventType(value: unknown): EventType {
	if (value === undefined || value === null) return 'cta_click';
	if (!isEventType(value)) throw new ValidationError('eventType must be cta_click or form_submit');
	return value;
}

function parseButtonType(value: unknown): string | null {
	if (value === undefined || value === null || value === '') return null;
	const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!BUTTON_TYPE_PATTERN.test(normalized)) {
		throw new ValidationError('buttonType must be 1-40 characters of a-z, 0-9, _ or -');
	}
	return normalized;
}

/** Free text from the page (button label, form name): collapsed to one line and truncated. */
function parseLabel(value: unknown, field: string): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
	return value.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH) || null;
}

function parsePlace(value: unknown, field: string): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
	const trimmed = value.trim();
	if (trimmed.length > MAX_PLACE_LENGTH) {
		throw new ValidationError(`${field} must be at most ${MAX_PLACE_LENGTH} characters`);
	}
	return trimmed || null;
}

function parseClickedAt(value: unknown, now: Date): Date {
	if (value === undefined || value === null) return now;
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw new ValidationError('clickedAt must be an ISO 8601 string or epoch milliseconds');
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new ValidationError('clickedAt must be an ISO 8601 string or epoch milliseconds');
	}
	const skew = date.getTime() - now.getTime();
	return skew < -MAX_CLOCK_SKEW_PAST_MS || skew > MAX_CLOCK_SKEW_FUTURE_MS ? now : date;
}

// Attribution is best effort: a malformed or missing value is dropped (stored as null) instead of
// rejecting the lead, so a lead is never lost because of its attribution.

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function optionalText(value: unknown, maxLength: number): string | null {
	if (typeof value !== 'string') return null;
	return value.replace(/\s+/g, ' ').trim().slice(0, maxLength) || null;
}

function parsePlacement(value: unknown): CtaPlacement | null {
	return isCtaPlacement(value) ? value : null;
}

/** The CTA a form submission is credited to, if it was clicked on this site in the last 30 minutes. */
function parseSource(value: unknown, now: Date): SourceCta {
	const source = asRecord(value);
	if (!source) return NO_SOURCE;

	const clickedAt =
		typeof source.clickedAt === 'string' || typeof source.clickedAt === 'number'
			? new Date(source.clickedAt)
			: null;
	const age = clickedAt ? now.getTime() - clickedAt.getTime() : Number.NaN;
	if (!(age >= -MAX_CLOCK_SKEW_FUTURE_MS && age <= MAX_SOURCE_AGE_MS)) return NO_SOURCE;

	let pageUrl: string | null = null;
	try {
		pageUrl = parsePageUrl(source.pageUrl).href;
	} catch {
		// Keep the rest of the source without a page.
	}
	const type = typeof source.type === 'string' ? source.type.trim().toLowerCase() : '';
	const parsed: SourceCta = {
		sourceCtaType: BUTTON_TYPE_PATTERN.test(type) ? type : null,
		sourceCtaText: optionalText(source.text, MAX_LABEL_LENGTH),
		sourceCtaPlacement: parsePlacement(source.placement),
		sourceCtaPageUrl: pageUrl,
		sourceCtaClickedAt: clickedAt
	};
	// Nothing that says which CTA it was: not a usable source.
	if (!parsed.sourceCtaType && !parsed.sourceCtaText && !parsed.sourceCtaPlacement) {
		return NO_SOURCE;
	}
	return parsed;
}

function parseAttribution(value: unknown): Campaign {
	const attribution = asRecord(value) ?? {};
	const campaign = {} as Campaign;
	for (const { key } of CAMPAIGN_FIELDS) {
		const text = optionalText(attribution[key], MAX_CAMPAIGN_LENGTH);
		campaign[key] = text && CLICK_ID_KEYS.has(key) && !CLICK_ID_PATTERN.test(text) ? null : text;
	}
	return campaign;
}

export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: isAllowedOrigin(origin) ? 204 : 403,
		headers: corsHeaders(origin)
	});
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const origin = request.headers.get('origin');
	const headers = corsHeaders(origin);

	// Browsers always send Origin on cross-origin POSTs; reject ones from sites we don't serve.
	if (origin && !isAllowedOrigin(origin)) {
		return json({ error: 'Origin not allowed' }, 403, headers);
	}

	const limited = rateLimit(getClientAddress());
	if (!limited.allowed) {
		headers.set('Retry-After', String(limited.retryAfterSeconds));
		return json({ error: 'Too many requests' }, 429, headers);
	}

	// Accept both application/json (fetch) and text/plain (navigator.sendBeacon); parse as JSON either way.
	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return json({ error: 'Payload too large' }, 413, headers);
	}

	let payload: ClickPayload;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return json({ error: 'Body must be a JSON object' }, 400, headers);
		}
		payload = parsed;
	} catch {
		return json({ error: 'Body must be valid JSON' }, 400, headers);
	}

	const geo = geoFromHeaders(request.headers);
	let values: typeof ctaClicks.$inferInsert;
	try {
		const pageUrl = parsePageUrl(payload.pageUrl);
		const eventType = parseEventType(payload.eventType);
		const now = new Date();
		values = {
			site: resolveSite(payload.site, pageUrl),
			eventType,
			buttonType: parseButtonType(payload.buttonType),
			buttonText: parseLabel(payload.buttonText, 'buttonText'),
			formName: parseLabel(payload.formName, 'formName'),
			pageUrl: pageUrl.href,
			// Prefer what the site sent; fall back to the edge's IP-based location.
			city: parsePlace(payload.city, 'city') ?? geo.city,
			state: parsePlace(payload.state, 'state') ?? geo.state,
			clickedAt: parseClickedAt(payload.clickedAt, now),
			// A CTA click has its own placement; a form submission is credited to an earlier CTA.
			ctaPlacement: eventType === 'cta_click' ? parsePlacement(payload.placement) : null,
			...(eventType === 'form_submit' ? parseSource(payload.source, now) : NO_SOURCE),
			...parseAttribution(payload.attribution)
		};
	} catch (error) {
		if (error instanceof ValidationError) return json({ error: error.message }, 400, headers);
		throw error;
	}

	let click: typeof ctaClicks.$inferSelect;
	try {
		[click] = await db.insert(ctaClicks).values(values).returning();
	} catch (error) {
		console.error('Failed to record CTA click', error);
		return json({ error: 'Failed to record event' }, 500, headers);
	}

	// Respond immediately; Vercel keeps the function alive until the email settles.
	waitUntil(
		sendCtaClickNotification({
			...click,
			country: geo.country,
			userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null
		})
	);

	return new Response(null, { status: 204, headers });
};
