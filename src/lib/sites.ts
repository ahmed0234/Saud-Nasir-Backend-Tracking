// The WordPress websites that send leads to this backend. Shared by the API (to tag each lead),
// the dashboard (sidebar filter) and the email. `id` is stored in cta_clicks.site and is the value
// each site's snippet sends; never rename an id once leads have been stored with it. `accent` is
// the site's colour in the dashboard.
export const SITES = [
	{
		id: 'platinum-sg',
		name: 'Platinum SG',
		url: 'https://www.platinumsg.com',
		hosts: ['www.platinumsg.com', 'platinumsg.com'],
		accent: 'oklch(0.72 0.16 295)'
	},
	{
		id: 'clean-master',
		name: 'Clean Master',
		url: 'https://www.cleanmastercarpetcleaning.com',
		hosts: ['www.cleanmastercarpetcleaning.com', 'cleanmastercarpetcleaning.com'],
		accent: 'oklch(0.74 0.14 230)'
	},
	{
		id: 'emg-air',
		name: 'EMG Air',
		url: 'https://www.emgair.com',
		hosts: ['www.emgair.com', 'emgair.com'],
		accent: 'oklch(0.76 0.15 160)'
	}
] as const;

export type Site = (typeof SITES)[number];
export type SiteId = Site['id'];

export const SITE_URL_PARAM = 'site';

export function isSiteId(value: unknown): value is SiteId {
	return typeof value === 'string' && SITES.some((site) => site.id === value);
}

export function getSite(id: string | null | undefined): Site | undefined {
	return SITES.find((site) => site.id === id);
}

/** The site that owns `hostname`, if it is one of the production domains. */
export function siteForHost(hostname: string): Site | undefined {
	const host = hostname.toLowerCase();
	return SITES.find((site) => (site.hosts as readonly string[]).includes(host));
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

/** The site selected in the dashboard (`?site=`), or null for all websites. */
export function siteFromUrl(url: {
	searchParams: URLSearchParams | { get(name: string): string | null };
}): SiteId | null {
	const value = url.searchParams.get(SITE_URL_PARAM);
	return isSiteId(value) ? value : null;
}
