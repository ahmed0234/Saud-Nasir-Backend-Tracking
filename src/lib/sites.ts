// Websites that send leads to this backend live in the database (`websites` and
// `website_domains`, managed from the dashboard). This module holds what server and client share
// about them. A website's `key` is its public site key: stored in cta_clicks.site and sent by its
// tracking script. Never change a key once leads are stored with it.

export type WebsitePlatform = 'wordpress' | 'html' | 'both';

export const WEBSITE_PLATFORMS: { value: WebsitePlatform; label: string; hint: string }[] = [
	{ value: 'wordpress', label: 'WordPress', hint: 'Installed with the WPCode plugin' },
	{ value: 'html', label: 'HTML / Custom JS', hint: 'Pasted into the page source' },
	{ value: 'both', label: 'Both', hint: 'WordPress pages and static HTML pages' }
];

export function isWebsitePlatform(value: unknown): value is WebsitePlatform {
	return value === 'wordpress' || value === 'html' || value === 'both';
}

/** What the dashboard knows about a website (dates as ISO strings). */
export type Website = {
	key: string;
	name: string;
	/** Home page, e.g. https://www.example.com. */
	url: string;
	accent: string;
	platform: WebsitePlatform;
	/** Registered hostnames without "www." (www and non-www both match), primary first. */
	domains: string[];
	disabled: boolean;
	/** Last time its tracking script reported in (install ping or lead); null = never. */
	lastSeenAt: string | null;
	lastSeenUrl: string | null;
	createdAt: string;
};

export const SITE_URL_PARAM = 'site';
export const SITE_KEY_PATTERN = /^[a-z0-9-]{1,64}$/;

// Sidebar colours for new websites, in the order they're handed out. The first three are the
// original sites' colours; decorative backgrounds (login, intro) use them too.
export const ACCENT_PALETTE = [
	'oklch(0.72 0.16 295)',
	'oklch(0.74 0.14 230)',
	'oklch(0.76 0.15 160)',
	'oklch(0.78 0.15 75)',
	'oklch(0.7 0.18 25)',
	'oklch(0.72 0.17 340)',
	'oklch(0.75 0.13 195)',
	'oklch(0.77 0.16 125)',
	'oklch(0.7 0.15 265)',
	'oklch(0.76 0.14 50)'
];

export function findWebsite(
	websites: readonly Website[] | null | undefined,
	key: string | null | undefined
): Website | undefined {
	return key ? websites?.find((website) => website.key === key) : undefined;
}

/** A hostname as stored: lowercase, without a leading "www.". */
export function hostKey(hostname: string): string {
	return hostname
		.toLowerCase()
		.replace(/\.$/, '')
		.replace(/^www\./, '');
}

/**
 * Parses what someone typed as a website address ("RoofingCo.com", "https://www.x.com/about")
 * into its home page URL and stored hostname, or an error message.
 */
export function parseDomainInput(
	input: string
): { ok: true; url: string; host: string } | { ok: false; error: string } {
	const trimmed = input.trim();
	if (!trimmed) return { ok: false, error: 'Enter the website address.' };
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
	} catch {
		return { ok: false, error: 'Enter a valid address, like roofingco.com.' };
	}
	const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, error: 'The address must be a website (http or https).' };
	}
	if (
		!hostname.includes('.') ||
		/^[\d.]+$/.test(hostname) ||
		hostname.includes(':') ||
		hostname.length > 253 ||
		!/^[a-z0-9.-]+$/.test(hostname) ||
		hostname.split('.').some((label) => !label || label.length > 63 || /^-|-$/.test(label))
	) {
		return { ok: false, error: 'Enter a domain name, like roofingco.com.' };
	}
	return { ok: true, url: `${url.protocol}//${hostname}`, host: hostKey(hostname) };
}

// Lead kinds. A CTA click is a phone/booking/Elementor button click; a form submission is a
// submitted lead form (Elementor, Fluent Forms, ...). Older snippets only sent CTA clicks.
export const EVENT_TYPES = ['cta_click', 'form_submit'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
	cta_click: 'CTA click',
	form_submit: 'Form submission'
};

export function isEventType(value: unknown): value is EventType {
	return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

// Where on the page a CTA was clicked. 'header' includes mobile slide-out menus.
export const CTA_PLACEMENTS = ['header', 'footer', 'page'] as const;
export type CtaPlacement = (typeof CTA_PLACEMENTS)[number];

export const CTA_PLACEMENT_LABELS: Record<CtaPlacement, string> = {
	header: 'Header CTA',
	footer: 'Footer CTA',
	page: 'Page CTA'
};

export function isCtaPlacement(value: unknown): value is CtaPlacement {
	return typeof value === 'string' && (CTA_PLACEMENTS as readonly string[]).includes(value);
}

// Campaign parameters the snippets capture from the landing page URL, keyed by the payload field
// (and schema column) name, with the URL parameter and a client-facing label.
export const CAMPAIGN_FIELDS = [
	{ key: 'utmSource', param: 'utm_source', label: 'UTM Source' },
	{ key: 'utmMedium', param: 'utm_medium', label: 'UTM Medium' },
	{ key: 'utmCampaign', param: 'utm_campaign', label: 'UTM Campaign' },
	{ key: 'utmTerm', param: 'utm_term', label: 'UTM Term' },
	{ key: 'utmContent', param: 'utm_content', label: 'UTM Content' },
	{ key: 'gclid', param: 'gclid', label: 'Google Click ID (GCLID)' },
	{ key: 'gbraid', param: 'gbraid', label: 'Google GBRAID' },
	{ key: 'wbraid', param: 'wbraid', label: 'Google WBRAID' },
	{ key: 'fbclid', param: 'fbclid', label: 'Meta Click ID (FBCLID)' }
] as const;
export type CampaignKey = (typeof CAMPAIGN_FIELDS)[number]['key'];
export type Campaign = Record<CampaignKey, string | null>;

const BUTTON_TYPE_LABELS: Record<string, string> = {
	call: 'Call',
	sms: 'Text',
	email: 'Email',
	booking: 'Booking',
	button: 'Button',
	elementor_form: 'Elementor form',
	fluent_form: 'Fluent form',
	cf7_form: 'Contact Form 7',
	wpforms_form: 'WPForms',
	gravity_form: 'Gravity form',
	form: 'Form'
};

export function buttonTypeLabel(value: string | null): string | null {
	if (!value) return null;
	return BUTTON_TYPE_LABELS[value] ?? value.replace(/[_-]+/g, ' ');
}

/**
 * The site key selected in the dashboard (`?site=`), or null for all websites. Only the format is
 * checked here; server loads confirm the website exists.
 */
export function siteFromUrl(url: {
	searchParams: URLSearchParams | { get(name: string): string | null };
}): string | null {
	const value = url.searchParams.get(SITE_URL_PARAM);
	return value && SITE_KEY_PATTERN.test(value) ? value : null;
}
