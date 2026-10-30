import { randomBytes } from 'node:crypto';
import { asc, sql } from 'drizzle-orm';
import {
	ACCENT_PALETTE,
	hostKey,
	siteFromUrl,
	type Website,
	type WebsitePlatform
} from '#lib/sites.ts';
import { db } from './db/index.ts';
import { ctaClicks, websiteDomains, websites } from './db/schema.ts';

// The registry of websites allowed to send leads, cached in memory per function instance.
//
// The tracking API checks site keys, page domains and origins against this cache, so a request
// costs no database round trip just to be rejected. The cache is refreshed every 60 seconds, at
// once when this instance changes a website, and on a miss (a website created on another
// instance a moment ago), at most every few seconds. Whether a website is disabled is also
// checked by the database itself when a lead is stored (see touchWebsite), so disabling takes
// effect immediately on every instance.

const TTL_MS = 60_000;
const MISS_REFRESH_MS = 5_000;

type Registry = {
	loadedAt: number;
	list: Website[];
	byKey: Map<string, Website>;
	byHost: Map<string, Website>;
};

let registry: Registry | null = null;
let loading: Promise<Registry> | null = null;

async function load(): Promise<Registry> {
	const [rows, domains] = await Promise.all([
		db.select().from(websites).orderBy(asc(websites.createdAt), asc(websites.key)),
		db
			.select()
			.from(websiteDomains)
			.orderBy(asc(websiteDomains.createdAt), asc(websiteDomains.hostname))
	]);

	const list = rows.map((row): Website => {
		const primary = hostKey(new URL(row.url).hostname);
		const hosts = domains.filter((d) => d.websiteKey === row.key).map((d) => d.hostname);
		return {
			key: row.key,
			name: row.name,
			url: row.url,
			accent: row.accent,
			platform: row.platform as WebsitePlatform,
			domains: [...hosts].sort((a, b) => Number(b === primary) - Number(a === primary)),
			disabled: row.disabledAt !== null,
			lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
			lastSeenUrl: row.lastSeenUrl,
			createdAt: row.createdAt.toISOString()
		};
	});

	const byHost = new Map<string, Website>();
	for (const website of list) for (const host of website.domains) byHost.set(host, website);
	return { loadedAt: Date.now(), list, byKey: new Map(list.map((w) => [w.key, w])), byHost };
}

async function getRegistry({ fresh = false, maxAge = TTL_MS } = {}): Promise<Registry> {
	if (!fresh && registry && Date.now() - registry.loadedAt < maxAge) return registry;
	loading ??= load().finally(() => (loading = null));
	registry = await loading;
	return registry;
}

/** Forget the cached registry; the next lookup reloads it. Call after changing a website. */
export function invalidateWebsites(): void {
	registry = null;
}

/** Every website, oldest first. `fresh` skips the cache (dashboard pages, for current status). */
export async function getWebsites({ fresh = false } = {}): Promise<Website[]> {
	return (await getRegistry({ fresh })).list;
}

/** A website by site key (enabled or not), refreshing the cache on a miss. */
export async function getWebsite(key: string): Promise<Website | undefined> {
	const found = (await getRegistry()).byKey.get(key);
	return found ?? (await getRegistry({ maxAge: MISS_REFRESH_MS })).byKey.get(key);
}

/** The website a hostname (with or without www.) is registered to, refreshing on a miss. */
export async function getWebsiteForHost(hostname: string): Promise<Website | undefined> {
	const host = hostKey(hostname);
	const found = (await getRegistry()).byHost.get(host);
	return found ?? (await getRegistry({ maxAge: MISS_REFRESH_MS })).byHost.get(host);
}

export function websiteOwnsHost(website: Website, hostname: string): boolean {
	return website.domains.includes(hostKey(hostname));
}

/**
 * Records that a website's script reported in, but only if the website is still enabled and still
 * owns `hostname`: the database's answer, not the cache's. Returns false when it doesn't, so the
 * caller rejects the event. `throttle` skips the write when it was updated in the last minute
 * (install pings).
 */
export async function touchWebsite(
	key: string,
	hostname: string,
	pageUrl: string,
	{ throttle = false } = {}
): Promise<boolean> {
	const host = hostKey(hostname);
	const allowed = await db.execute<{ key: string }>(sql`
		select ${websites.key} as key from ${websites}
		where ${websites.key} = ${key} and ${websites.disabledAt} is null
			and exists (
				select 1 from ${websiteDomains}
				where ${websiteDomains.websiteKey} = ${websites.key} and ${websiteDomains.hostname} = ${host}
			)
	`);
	if (allowed.rows.length === 0) {
		// The cache said yes; refresh it so the next request is rejected without a query.
		invalidateWebsites();
		return false;
	}
	await db.execute(sql`
		update ${websites} set last_seen_at = now(), last_seen_url = ${pageUrl.slice(0, 2048)}
		where ${websites.key} = ${key}
			${throttle ? sql`and (${websites.lastSeenAt} is null or ${websites.lastSeenAt} < now() - interval '1 minute')` : sql``}
	`);
	return true;
}

// ------------------------------------------------------------------------------------------------
// Changes from the dashboard
// ------------------------------------------------------------------------------------------------

export class WebsiteError extends Error {}

export type WebsiteInput = {
	name: string;
	url: string;
	platform: WebsitePlatform;
	/** Hostnames as stored (hostKey), primary first. */
	domains: string[];
};

function siteKeyFor(name: string): string {
	const slug = name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 32)
		.replace(/-+$/, '');
	// 5 random base-36 characters: keys can't be guessed from the name alone, and two websites
	// with the same name still get different keys.
	const suffix = BigInt(`0x${randomBytes(5).toString('hex')}`)
		.toString(36)
		.slice(-5)
		.padStart(5, '0');
	return `${slug || 'site'}-${suffix}`;
}

/** Throws a WebsiteError naming the website that already has one of `domains`. */
async function assertDomainsFree(domains: string[], exceptKey?: string): Promise<void> {
	const taken = await db.execute<{ hostname: string; name: string }>(sql`
		select d.hostname, w.name from ${websiteDomains} d join ${websites} w on w.key = d.website_key
		where d.hostname in (${sql.join(
			domains.map((d) => sql`${d}`),
			sql`, `
		)})
			${exceptKey ? sql`and d.website_key <> ${exceptKey}` : sql``}
	`);
	const first = taken.rows[0];
	if (first) {
		throw new WebsiteError(`${first.hostname} is already registered to “${first.name}”.`);
	}
}

function isUniqueViolation(error: unknown): boolean {
	const code = (error as { code?: string; cause?: { code?: string } })?.code;
	return code === '23505' || (error as { cause?: { code?: string } })?.cause?.code === '23505';
}

function domainList(domains: string[]) {
	return sql`array[${sql.join(
		domains.map((d) => sql`${d}`),
		sql`, `
	)}]::text[]`;
}

export async function createWebsite(input: WebsiteInput): Promise<Website> {
	await assertDomainsFree(input.domains);
	const existing = await getWebsites({ fresh: true });
	const used = new Set(existing.map((w) => w.accent));
	const accent =
		ACCENT_PALETTE.find((color) => !used.has(color)) ??
		ACCENT_PALETTE[existing.length % ACCENT_PALETTE.length];

	for (let attempt = 0; attempt < 3; attempt++) {
		const key = siteKeyFor(input.name);
		try {
			// One statement, so the website and its domains are created together or not at all.
			await db.execute(sql`
				with created as (
					insert into ${websites} (key, name, url, accent, platform)
					values (${key}, ${input.name}, ${input.url}, ${accent}, ${input.platform})
					returning key
				)
				insert into ${websiteDomains} (hostname, website_key)
				select input.hostname, (select key from created)
				from unnest(${domainList(input.domains)}) as input(hostname)
			`);
			invalidateWebsites();
			const website = await getWebsite(key);
			if (!website) throw new Error(`Website ${key} missing after insert`);
			return website;
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			// A domain was taken in the meantime (message names it), or, very unlikely, the key.
			await assertDomainsFree(input.domains);
		}
	}
	throw new WebsiteError('Could not create the website. Please try again.');
}

export async function updateWebsite(key: string, input: WebsiteInput): Promise<void> {
	await assertDomainsFree(input.domains, key);
	try {
		const result = await db.execute<{ key: string }>(sql`
			with updated as (
				update ${websites}
				set name = ${input.name}, url = ${input.url}, platform = ${input.platform}, updated_at = now()
				where key = ${key}
				returning key
			),
			removed as (
				delete from ${websiteDomains}
				where website_key = (select key from updated) and hostname <> all(${domainList(input.domains)})
			),
			added as (
				insert into ${websiteDomains} (hostname, website_key)
				select input.hostname, (select key from updated)
				from unnest(${domainList(input.domains)}) as input(hostname)
				where exists (select 1 from updated)
					and not exists (
						select 1 from ${websiteDomains} d
						where d.hostname = input.hostname and d.website_key = ${key}
					)
			)
			select key from updated
		`);
		if (result.rows.length === 0) throw new WebsiteError('That website no longer exists.');
	} catch (error) {
		if (isUniqueViolation(error)) await assertDomainsFree(input.domains, key);
		throw error;
	} finally {
		invalidateWebsites();
	}
}

/** Disabling stops new events at once and keeps every lead; enabling resumes tracking. */
export async function setWebsiteDisabled(key: string, disabled: boolean): Promise<void> {
	const result = await db.execute<{ key: string }>(sql`
		update ${websites}
		set disabled_at = ${disabled ? sql`coalesce(disabled_at, now())` : sql`null`}, updated_at = now()
		where key = ${key}
		returning key
	`);
	invalidateWebsites();
	if (result.rows.length === 0) throw new WebsiteError('That website no longer exists.');
}

/**
 * Permanently deletes a website with all its leads (CTA clicks, form submissions and everything
 * analytics and exports are computed from) and its domains. One statement, so it all goes or
 * nothing does: the leads' foreign key is checked at the end of the statement, and domains go by
 * ON DELETE CASCADE. Its site key stops working at once: the cache is cleared here, and other
 * instances' caches can't let an event through because touchWebsite asks the database.
 * Returns how many leads were deleted.
 */
export async function deleteWebsite(key: string): Promise<{ leads: number }> {
	const result = await db.execute<{ key: string; leads: number }>(sql`
		with deleted_leads as (
			delete from ${ctaClicks} where ${ctaClicks.site} = ${key} returning 1
		),
		deleted_website as (
			delete from ${websites} where key = ${key} returning key
		)
		select key, (select count(*) from deleted_leads)::int as leads from deleted_website
	`);
	invalidateWebsites();
	const row = result.rows[0];
	if (!row) throw new WebsiteError('That website was already deleted.');
	return { leads: Number(row.leads) };
}

/** The website selected in the dashboard (`?site=`), if it exists; null means all websites. */
export async function selectedSite(url: URL): Promise<string | null> {
	const key = siteFromUrl(url);
	return key && (await getWebsite(key)) ? key : null;
}
