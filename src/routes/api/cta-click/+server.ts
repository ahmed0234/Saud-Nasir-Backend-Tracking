import { db } from '#lib/server/db/index.ts';
import { ctaClicks } from '#lib/server/db/schema.ts';
import { sendCtaClickNotification } from '#lib/server/email/index.ts';
import { geoFromHeaders } from '#lib/server/geo.ts';
import { createRateLimiter } from '#lib/server/rate-limit.ts';
import {
	getWebsite,
	getWebsiteForHost,
	touchWebsite,
	websiteOwnsHost
} from '#lib/server/websites.ts';
import {
	CAMPAIGN_FIELDS,
	isCtaPlacement,
	isEventType,
	SITE_KEY_PATTERN,
	type Campaign,
	type CampaignKey,
	type CtaPlacement,
	type EventType,
	type Website
} from '#lib/sites.ts';
import { classifyTrafficSource } from '#lib/traffic-source.ts';
import { waitUntil } from '@vercel/functions';
import type { RequestHandler } from './$types';

// Tracking endpoint for every registered website. Who may send is decided here, on the server,
// from the website registry (src/lib/server/websites.ts): the site key must belong to an enabled
// website, and the page (and the browser's Origin, when sent) must be on one of its domains. CORS
// headers only let browsers read the reply; they are not what protects this endpoint.

// Two page URLs (the lead's and its source CTA's) plus campaign parameters fit comfortably.
const MAX_BODY_BYTES = 8192;
const MAX_URL_LENGTH = 2048;
const MAX_PLACE_LENGTH = 120;
const MAX_LABEL_LENGTH = 120;
const MAX_CAMPAIGN_LENGTH = 255;
const BUTTON_TYPE_PATTERN = /^[a-z0-9_-]{1,40}$/;
// Ad click IDs are URL-safe tokens; anything else is not a real click ID.
const CLICK_ID_PATTERN = /^[\w.~-]{1,255}$/;
const CLICK_ID_KEYS = new Set<CampaignKey>([
	'gclid',
	'gbraid',
	'wbraid',
	'fbclid',
	'msclkid',
	'ttclid',
	'liFatId',
	'twclid'
]);
const MAX_REFERRER_LENGTH = 512;
// Accept client timestamps only within this window around server time; outside it (bad device
// clock, replayed request) the server's own time is used instead.
const MAX_CLOCK_SKEW_PAST_MS = 24 * 60 * 60_000;
const MAX_CLOCK_SKEW_FUTURE_MS = 5 * 60_000;
// The snippets credit a CTA clicked up to 30 minutes before a form submission; a little slack
// covers clock differences and slow form plugins.
const MAX_SOURCE_AGE_MS = 35 * 60_000;

// Each accepted lead writes a row and sends an email, so cap leads per visitor IP (a real visitor
// never makes 30 a minute) and per website (one site can't flood the database or Gmail quota).
// Install pings write nothing but "last seen", so they have their own, looser per-IP limit.
// Per function instance, best effort (see rate-limit.ts).
const leadsPerIp = createRateLimiter({ limit: 30, windowMs: 60_000 });
const leadsPerWebsite = createRateLimiter({ limit: 300, windowMs: 60_000 });
const pingsPerIp = createRateLimiter({ limit: 60, windowMs: 60_000 });

type ClickPayload = {
	/** The website's site key. Very old snippets send none; their page's domain decides. */
	site?: unknown;
	/** 'cta_click' | 'form_submit', or 'ping' (installation check; not stored as a lead). */
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
	/**
	 * The visit that brought the visitor: campaign parameters from the landing page ({ utmSource,
	 * ..., gclid, fbclid, msclkid, ... }) plus `referrer` (the external page they came from, '' for
	 * none) and `landingPage`. Trackers that send `referrer` get a traffic source, Direct included.
	 */
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

function hostOf(origin: string | null): string | null {
	if (!origin) return null;
	try {
		return new URL(origin).hostname;
	} catch {
		return null;
	}
}

/** CORS headers for an Origin registered to an enabled website (from the cached registry). */
async function corsHeaders(origin: string | null): Promise<Headers> {
	const headers = new Headers({ Vary: 'Origin' });
	const host = hostOf(origin);
	const website = host ? await getWebsiteForHost(host) : undefined;
	if (origin && website && !website.disabled) {
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
	return url;
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

/** The CTA a form submission is credited to, if it was clicked on this website in the last 30 minutes. */
function parseSource(value: unknown, now: Date, website: Website): SourceCta {
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
		const url = parsePageUrl(source.pageUrl);
		if (websiteOwnsHost(website, url.hostname)) pageUrl = url.href;
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

type Attribution = Campaign &
	Pick<
		typeof ctaClicks.$inferInsert,
		'referrer' | 'landingPageUrl' | 'trafficSource' | 'trafficChannel'
	>;

/** An external page as origin + path (no query: it can hold search terms or personal data). */
function parseReferrer(value: unknown): string | null {
	if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) return null;
	try {
		const url = new URL(value);
		if (url.protocol === 'android-app:') return `android-app://${url.hostname}`.slice(0, 255);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return `${url.origin}${url.pathname}`.slice(0, MAX_REFERRER_LENGTH);
	} catch {
		return null;
	}
}

function parseAttribution(value: unknown, website: Website): Attribution {
	const attribution = asRecord(value);
	const campaign = {} as Campaign;
	for (const { key } of CAMPAIGN_FIELDS) {
		const text = optionalText(attribution?.[key], MAX_CAMPAIGN_LENGTH);
		campaign[key] = text && CLICK_ID_KEYS.has(key) && !CLICK_ID_PATTERN.test(text) ? null : text;
	}

	let referrer = parseReferrer(attribution?.referrer);
	// The website's own pages (or another of its domains) aren't where the visitor came from.
	if (
		referrer &&
		/^https?:/.test(referrer) &&
		websiteOwnsHost(website, new URL(referrer).hostname)
	) {
		referrer = null;
	}
	let landingPageUrl: string | null = null;
	try {
		const url = parsePageUrl(attribution?.landingPage);
		if (websiteOwnsHost(website, url.hostname)) landingPageUrl = url.href;
	} catch {
		// Not a page of this website: leave it out.
	}

	// Trackers that report the referrer (even an empty one) report every visit, so no campaign and
	// no referrer means a direct visit. Older snippets send neither: their source is unknown.
	const reportsVisit = typeof attribution?.referrer === 'string';
	const hasCampaign = CAMPAIGN_FIELDS.some(({ key }) => campaign[key]);
	const traffic =
		reportsVisit || hasCampaign ? classifyTrafficSource({ ...campaign, referrer }) : null;

	return {
		...campaign,
		referrer,
		landingPageUrl,
		trafficSource: traffic?.source ?? null,
		trafficChannel: traffic?.channel ?? null
	};
}

/**
 * The website this event belongs to, or a reason to refuse it: the site key must name an enabled
 * website, and the page and the Origin (browsers always send it cross-origin) must be on one of
 * that website's domains. Snippets without a site key are matched by the page's domain.
 */
async function resolveWebsite(
	siteKey: unknown,
	pageUrl: URL,
	origin: string | null
): Promise<{ website: Website } | { status: 400 | 403; error: string }> {
	if (siteKey !== undefined && siteKey !== null) {
		if (typeof siteKey !== 'string' || !SITE_KEY_PATTERN.test(siteKey)) {
			return { status: 400, error: 'site must be a site key' };
		}
	}
	const website = siteKey
		? await getWebsite(siteKey as string)
		: await getWebsiteForHost(pageUrl.hostname);
	if (!website) return { status: 403, error: 'Unknown website' };
	if (website.disabled) return { status: 403, error: 'Website is disabled' };
	if (!websiteOwnsHost(website, pageUrl.hostname)) {
		console.warn(`Event for "${website.key}" from unregistered page host ${pageUrl.host}`);
		return { status: 403, error: 'pageUrl is not on a domain registered for this website' };
	}
	const originHost = hostOf(origin);
	if (origin && (!originHost || !websiteOwnsHost(website, originHost))) {
		return { status: 403, error: 'Origin is not a domain registered for this website' };
	}
	return { website };
}

export const OPTIONS: RequestHandler = async ({ request }) => {
	const origin = request.headers.get('origin');
	const headers = await corsHeaders(origin);
	return new Response(null, {
		status: headers.has('Access-Control-Allow-Origin') ? 204 : 403,
		headers
	});
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const origin = request.headers.get('origin');
	const headers = await corsHeaders(origin);

	// Browsers always send Origin on cross-origin POSTs: refuse unregistered ones before reading
	// the body. (Requests without Origin, i.e. not from a browser, are checked below like any other.)
	if (origin && !headers.has('Access-Control-Allow-Origin')) {
		return json({ error: 'Origin not allowed' }, 403, headers);
	}

	// Accept both application/json and text/plain (what the tracker sends); parse as JSON either way.
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

	const isPing = payload.eventType === 'ping';
	const ip = getClientAddress();
	const limited = (isPing ? pingsPerIp : leadsPerIp)(ip);
	if (!limited.allowed) {
		headers.set('Retry-After', String(limited.retryAfterSeconds));
		return json({ error: 'Too many requests' }, 429, headers);
	}

	let pageUrl: URL;
	try {
		pageUrl = parsePageUrl(payload.pageUrl);
	} catch (error) {
		if (error instanceof ValidationError) return json({ error: error.message }, 400, headers);
		throw error;
	}

	const resolved = await resolveWebsite(payload.site, pageUrl, origin);
	if (!('website' in resolved)) return json({ error: resolved.error }, resolved.status, headers);
	const { website } = resolved;

	// Installation check from the tracking script: update "last seen", store nothing else.
	if (isPing) {
		const ok = await touchWebsite(website.key, pageUrl.hostname, pageUrl.href, { throttle: true });
		return ok
			? new Response(null, { status: 204, headers })
			: json({ error: 'Website is disabled' }, 403, headers);
	}

	const perWebsite = leadsPerWebsite(website.key);
	if (!perWebsite.allowed) {
		headers.set('Retry-After', String(perWebsite.retryAfterSeconds));
		return json({ error: 'Too many requests' }, 429, headers);
	}

	const geo = geoFromHeaders(request.headers);
	let values: typeof ctaClicks.$inferInsert;
	try {
		const eventType = parseEventType(payload.eventType);
		const now = new Date();
		values = {
			site: website.key,
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
			...(eventType === 'form_submit' ? parseSource(payload.source, now, website) : NO_SOURCE),
			...parseAttribution(payload.attribution, website)
		};
	} catch (error) {
		if (error instanceof ValidationError) return json({ error: error.message }, 400, headers);
		throw error;
	}

	let click: typeof ctaClicks.$inferSelect;
	try {
		// The database has the final say on "enabled and owns this domain" (the cache can be up to a
		// minute old on other instances), and this also records the website as seen.
		if (!(await touchWebsite(website.key, pageUrl.hostname, pageUrl.href))) {
			return json({ error: 'Website is disabled' }, 403, headers);
		}
		[click] = await db.insert(ctaClicks).values(values).returning();
	} catch (error) {
		console.error('Failed to record CTA click', error);
		return json({ error: 'Failed to record event' }, 500, headers);
	}

	// Respond immediately; Vercel keeps the function alive until the email settles.
	waitUntil(
		sendCtaClickNotification({
			...click,
			siteName: website.name,
			country: geo.country,
			userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null
		})
	);

	return new Response(null, { status: 204, headers });
};
