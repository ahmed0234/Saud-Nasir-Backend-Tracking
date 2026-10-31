// Where a lead's visitor came from, worked out on the server from what the tracker captured on
// the landing page (UTM parameters, ad click IDs, the referring site). Classified once, when the
// lead is recorded, and stored in cta_clicks.traffic_source / traffic_channel, so the dashboard,
// the CSV and the email all agree. Update the rules here; every website picks them up for new
// leads without touching its tracking code.

export const TRAFFIC_CHANNELS = [
	'paid',
	'search',
	'social',
	'ai',
	'email',
	'referral',
	'campaign',
	'direct'
] as const;
export type TrafficChannel = (typeof TRAFFIC_CHANNELS)[number];

export const TRAFFIC_CHANNEL_LABELS: Record<TrafficChannel, string> = {
	paid: 'Paid ads',
	search: 'Organic search',
	social: 'Social',
	ai: 'AI assistant',
	email: 'Email',
	referral: 'Referral',
	campaign: 'Tagged link',
	direct: 'Direct'
};

export function isTrafficChannel(value: unknown): value is TrafficChannel {
	return typeof value === 'string' && (TRAFFIC_CHANNELS as readonly string[]).includes(value);
}

/** Shown for leads recorded before source tracking, or sent by an old inline snippet. */
export const SOURCE_NOT_RECORDED = 'Not recorded';

export type TrafficInput = {
	utmSource: string | null;
	utmMedium: string | null;
	gclid: string | null;
	gbraid: string | null;
	wbraid: string | null;
	fbclid: string | null;
	msclkid: string | null;
	ttclid: string | null;
	liFatId: string | null;
	twclid: string | null;
	/** The external page the visitor arrived from (origin + path), or null for none. */
	referrer: string | null;
};

export type TrafficSource = { source: string; channel: TrafficChannel };

type Platform = {
	/** Name for paid traffic, e.g. "Google Ads". */
	ads: string;
	/** Name and channel for unpaid traffic from it. */
	organic: string;
	channel: Exclude<TrafficChannel, 'paid' | 'direct' | 'campaign'>;
};

const GOOGLE: Platform = { ads: 'Google Ads', organic: 'Google', channel: 'search' };
const GOOGLE_BUSINESS: Platform = {
	ads: 'Google Ads',
	organic: 'Google Business Profile',
	channel: 'search'
};
const YOUTUBE: Platform = { ads: 'Google Ads', organic: 'YouTube', channel: 'social' };
const MICROSOFT: Platform = { ads: 'Microsoft Ads', organic: 'Bing', channel: 'search' };
const META: Platform = { ads: 'Meta Ads', organic: 'Facebook / Instagram', channel: 'social' };
const FACEBOOK: Platform = { ads: 'Meta Ads', organic: 'Facebook', channel: 'social' };
const INSTAGRAM: Platform = { ads: 'Meta Ads', organic: 'Instagram', channel: 'social' };
const CHATGPT: Platform = { ads: 'ChatGPT Ads', organic: 'ChatGPT', channel: 'ai' };
const TIKTOK: Platform = { ads: 'TikTok Ads', organic: 'TikTok', channel: 'social' };
const LINKEDIN: Platform = { ads: 'LinkedIn Ads', organic: 'LinkedIn', channel: 'social' };
const X: Platform = { ads: 'X Ads', organic: 'X (Twitter)', channel: 'social' };
const PINTEREST: Platform = { ads: 'Pinterest Ads', organic: 'Pinterest', channel: 'social' };
const REDDIT: Platform = { ads: 'Reddit Ads', organic: 'Reddit', channel: 'social' };
const NEXTDOOR: Platform = { ads: 'Nextdoor Ads', organic: 'Nextdoor', channel: 'social' };
const YELP: Platform = { ads: 'Yelp Ads', organic: 'Yelp', channel: 'referral' };
const PERPLEXITY: Platform = { ads: 'Perplexity Ads', organic: 'Perplexity', channel: 'ai' };
const GEMINI: Platform = { ads: 'Google Ads', organic: 'Gemini', channel: 'ai' };
const COPILOT: Platform = { ads: 'Microsoft Ads', organic: 'Copilot', channel: 'ai' };
const CLAUDE: Platform = { ads: 'Claude', organic: 'Claude', channel: 'ai' };

const search = (name: string): Platform => ({
	ads: `${name} Ads`,
	organic: name,
	channel: 'search'
});
const email = (name: string): Platform => ({ ads: name, organic: name, channel: 'email' });

// utm_source values (lowercased, "www." and a trailing ".com" style suffix ignored) → platform.
// Meta's dynamic {{site_source_name}} sends fb / ig / an (Audience Network) / msg (Messenger).
const UTM_SOURCES: Record<string, Platform> = {
	google: GOOGLE,
	googleads: GOOGLE,
	adwords: GOOGLE,
	gads: GOOGLE,
	gmb: GOOGLE_BUSINESS,
	gbp: GOOGLE_BUSINESS,
	googlebusiness: GOOGLE_BUSINESS,
	googlebusinessprofile: GOOGLE_BUSINESS,
	googlemybusiness: GOOGLE_BUSINESS,
	googlemaps: GOOGLE_BUSINESS,
	youtube: YOUTUBE,
	bing: MICROSOFT,
	microsoft: MICROSOFT,
	microsoftads: MICROSOFT,
	bingads: MICROSOFT,
	meta: META,
	metaads: META,
	facebookads: META,
	facebook: FACEBOOK,
	fb: FACEBOOK,
	messenger: FACEBOOK,
	msg: FACEBOOK,
	an: META,
	audiencenetwork: META,
	instagram: INSTAGRAM,
	ig: INSTAGRAM,
	chatgpt: CHATGPT,
	chatgptads: CHATGPT,
	openai: CHATGPT,
	tiktok: TIKTOK,
	tiktokads: TIKTOK,
	linkedin: LINKEDIN,
	linkedinads: LINKEDIN,
	twitter: X,
	x: X,
	pinterest: PINTEREST,
	reddit: REDDIT,
	nextdoor: NEXTDOOR,
	yelp: YELP,
	perplexity: PERPLEXITY,
	gemini: GEMINI,
	copilot: COPILOT,
	claude: CLAUDE
};

// Referring hostnames (without "www.") → platform. Checked in order, first match wins, so the
// more specific hosts (gemini.google.com, mail.google.com) come before their parent domains.
const REFERRERS: [RegExp, Platform | 'ads-google'][] = [
	[
		/^(googleadservices\.com|([a-z0-9-]+\.)*doubleclick\.net|googlesyndication\.com)$/,
		'ads-google'
	],
	[/^gemini\.google\.com$|^bard\.google\.com$/, GEMINI],
	[/^mail\.google\.com$/, email('Gmail')],
	[/^(business|maps)\.google\.[a-z.]+$|^g\.page$|^maps\.app\.goo\.gl$/, GOOGLE_BUSINESS],
	[/^([a-z0-9-]+\.)?google\.[a-z.]+$/, GOOGLE],
	[/^(m\.)?youtube\.com$|^youtu\.be$/, YOUTUBE],
	[/^copilot\.microsoft\.com$/, COPILOT],
	[/^(outlook\.(live|office|office365)\.com)$/, email('Outlook')],
	[/^(bat\.)?bing\.com$/, MICROSOFT],
	[/^(chatgpt\.com|chat\.openai\.com|([a-z0-9-]+\.)?openai\.com)$/, CHATGPT],
	[/^(([a-z0-9-]+\.)?perplexity\.ai)$/, PERPLEXITY],
	[/^claude\.ai$/, CLAUDE],
	[/^(([a-z0-9-]+\.)?facebook\.com|fb\.com|fb\.me|messenger\.com)$/, FACEBOOK],
	[/^(([a-z0-9-]+\.)?instagram\.com)$/, INSTAGRAM],
	[/^(([a-z0-9-]+\.)?tiktok\.com)$/, TIKTOK],
	[/^(([a-z0-9-]+\.)?linkedin\.com|lnkd\.in)$/, LINKEDIN],
	[/^(t\.co|x\.com|twitter\.com|mobile\.twitter\.com)$/, X],
	[/^(([a-z0-9-]+\.)?pinterest\.[a-z.]+|pin\.it)$/, PINTEREST],
	[/^(([a-z0-9-]+\.)?reddit\.com)$/, REDDIT],
	[/^(([a-z0-9-]+\.)?nextdoor\.com)$/, NEXTDOOR],
	[/^(([a-z0-9-]+\.)?yelp\.[a-z.]+)$/, YELP],
	[/^(([a-z0-9-]+\.)?search\.yahoo\.com|yahoo\.com)$/, search('Yahoo')],
	[/^mail\.yahoo\.com$/, email('Yahoo Mail')],
	[/^duckduckgo\.com$/, search('DuckDuckGo')],
	[/^ecosia\.org$/, search('Ecosia')],
	[/^(([a-z0-9-]+\.)?brave\.com)$/, search('Brave Search')],
	[/^(([a-z0-9-]+\.)?baidu\.com)$/, search('Baidu')],
	[/^(([a-z0-9-]+\.)?yandex\.[a-z.]+)$/, search('Yandex')]
];

// Android apps report themselves as android-app://<package>/ when they open a link.
const ANDROID_APPS: Record<string, Platform> = {
	'com.google.android.googlequicksearchbox': GOOGLE,
	'com.google.android.gm': email('Gmail'),
	'com.google.android.apps.maps': GOOGLE_BUSINESS,
	'com.google.android.youtube': YOUTUBE,
	'com.facebook.katana': FACEBOOK,
	'com.facebook.orca': FACEBOOK,
	'com.instagram.android': INSTAGRAM,
	'com.openai.chatgpt': CHATGPT,
	'com.linkedin.android': LINKEDIN,
	'com.twitter.android': X,
	'com.zhiliaoapp.musically': TIKTOK,
	'com.microsoft.office.outlook': email('Outlook'),
	'com.yelp.android': YELP,
	'com.nextdoor': NEXTDOOR,
	'com.reddit.frontpage': REDDIT
};

/**
 * utm_medium values that mean the click was paid for: cpc, ppc, paid, paid_social, paidsearch,
 * cpm, display, ads, sponsored, retargeting, ...
 */
const PAID_MEDIUM =
	/paid|^(cpc|ppc|cpm|cpv|cpa|cpl|ads?|display|banner|sponsored|retargeting|remarketing|sem|shopping|pmax|video[_ -]?ads?)$|(^|[_ -])(cpc|ppc|cpm|ads?)([_ -]|$)/i;
const EMAIL_MEDIUM = /^(e-?mail|newsletter|e-?blast|mailchimp|klaviyo)$|(^|[_ -])e-?mail([_ -]|$)/i;
const SOCIAL_MEDIUM = /^(social|social[_ -]?media|organic[_ -]?social|sm|post|story|bio)$/i;
const SEARCH_MEDIUM = /^(organic|seo|search|local|listing|gbp|gmb|maps)$/i;
const AI_MEDIUM = /^(ai|llm|chatbot|assistant)$/i;
// "google_ads", "chatgpt-ads", "facebookads": the source itself says it's an ad.
const ADS_IN_SOURCE = /(^|[_ .-])ads?([_ .-]|$)|ads$/i;

const MAX_LABEL = 60;

function normalizeSource(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/^www\./, '')
		.replace(/\/.*$/, '')
		.replace(/\.(com|ai|org|net|co|io)$/, '')
		.replace(/[\s_.-]+/g, '');
}

function referrerHost(referrer: string): { host: string; app: boolean } | null {
	try {
		const url = new URL(referrer);
		if (url.protocol === 'android-app:') return { host: url.hostname.toLowerCase(), app: true };
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return { host: url.hostname.toLowerCase().replace(/^www\./, ''), app: false };
	} catch {
		return null;
	}
}

function fromPlatform(platform: Platform, paid: boolean): TrafficSource {
	return paid
		? { source: platform.ads, channel: 'paid' }
		: { source: platform.organic, channel: platform.channel };
}

function referrerPlatform(referrer: string | null): Platform | 'ads-google' | null {
	const parsed = referrer ? referrerHost(referrer) : null;
	if (!parsed) return null;
	if (parsed.app) return ANDROID_APPS[parsed.host] ?? null;
	for (const [pattern, platform] of REFERRERS) {
		if (pattern.test(parsed.host)) return platform;
	}
	return null;
}

/** "newsletter-oct" → "newsletter-oct", trimmed to a label length. */
function rawLabel(value: string): string {
	return value.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

/**
 * The traffic source of a lead. Order of evidence: an ad click ID (added by the ad platform
 * itself, so the most reliable), then UTM parameters, then the referring site, else direct.
 */
export function classifyTrafficSource(input: TrafficInput): TrafficSource {
	// 1. Ad click IDs, auto-added by the ad platform to every ad click.
	if (input.gclid || input.gbraid || input.wbraid) return { source: 'Google Ads', channel: 'paid' };
	if (input.msclkid) return { source: 'Microsoft Ads', channel: 'paid' };
	if (input.ttclid) return { source: 'TikTok Ads', channel: 'paid' };
	if (input.liFatId) return { source: 'LinkedIn Ads', channel: 'paid' };
	if (input.twclid) return { source: 'X Ads', channel: 'paid' };

	const fromReferrer = referrerPlatform(input.referrer);

	// 2. UTM parameters, set by whoever made the link (ad platforms' tracking templates, emails).
	const utmSource = input.utmSource?.trim() ?? '';
	const medium = input.utmMedium?.trim() ?? '';
	if (utmSource) {
		const paid = PAID_MEDIUM.test(medium) || ADS_IN_SOURCE.test(utmSource);
		const platform = UTM_SOURCES[normalizeSource(utmSource)];
		if (platform) {
			// fbclid alone doesn't say paid, but a Meta source tagged as an ad does.
			return fromPlatform(platform, paid);
		}
		if (fromReferrer && fromReferrer !== 'ads-google' && !paid) {
			return fromPlatform(fromReferrer, false);
		}
		const label = rawLabel(utmSource);
		if (paid) return { source: label, channel: 'paid' };
		if (EMAIL_MEDIUM.test(medium)) return { source: label, channel: 'email' };
		if (SOCIAL_MEDIUM.test(medium)) return { source: label, channel: 'social' };
		if (SEARCH_MEDIUM.test(medium)) return { source: label, channel: 'search' };
		if (AI_MEDIUM.test(medium)) return { source: label, channel: 'ai' };
		if (/^referral$/i.test(medium)) return { source: label, channel: 'referral' };
		return { source: label, channel: 'campaign' };
	}

	// Only a medium was tagged (rare): "cpc" with no source is still a paid click.
	if (medium && PAID_MEDIUM.test(medium)) {
		if (fromReferrer === 'ads-google') return { source: 'Google Ads', channel: 'paid' };
		if (fromReferrer) return fromPlatform(fromReferrer, true);
		return { source: 'Paid (untagged source)', channel: 'paid' };
	}

	// 3. Meta adds fbclid to every outbound link, organic posts included, so on its own it only
	// says "from Facebook or Instagram". Meta ads count as Meta Ads once they carry UTMs.
	if (input.fbclid) {
		if (fromReferrer === FACEBOOK || fromReferrer === INSTAGRAM)
			return fromPlatform(fromReferrer, false);
		return fromPlatform(META, false);
	}

	// 4. The referring site.
	if (fromReferrer === 'ads-google') return { source: 'Google Ads', channel: 'paid' };
	if (fromReferrer) return fromPlatform(fromReferrer, false);
	const parsed = input.referrer ? referrerHost(input.referrer) : null;
	if (parsed) return { source: rawLabel(parsed.host), channel: 'referral' };

	return { source: 'Direct', channel: 'direct' };
}
