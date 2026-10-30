import {
	createWebsite,
	setWebsiteDisabled,
	updateWebsite,
	WebsiteError,
	type WebsiteInput
} from '#lib/server/websites.ts';
import { hostKey, isWebsitePlatform, parseDomainInput, SITE_KEY_PATTERN } from '#lib/sites.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 60;
const MAX_DOMAINS = 20;

// The page itself lists the websites from the (app) layout's data.
export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
};

type FieldErrors = Partial<Record<'name' | 'domain' | 'extraDomains' | 'platform', string>>;

/** The add/edit form's fields, or the errors to show next to them. */
function parseWebsiteForm(form: FormData): { input: WebsiteInput } | { errors: FieldErrors } {
	const errors: FieldErrors = {};
	const name = String(form.get('name') ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!name) errors.name = 'Enter the website’s name.';
	else if (name.length > MAX_NAME) errors.name = `Use at most ${MAX_NAME} characters.`;

	const domain = parseDomainInput(String(form.get('domain') ?? ''));
	if (!domain.ok) errors.domain = domain.error;

	// Other domains the same website uses (staging, an old domain), one per line or comma-separated.
	const extra: string[] = [];
	for (const item of String(form.get('extraDomains') ?? '')
		.split(/[\s,]+/)
		.filter(Boolean)) {
		const parsed = parseDomainInput(item);
		if (!parsed.ok) {
			errors.extraDomains = `“${item}” isn’t a valid domain.`;
			break;
		}
		extra.push(parsed.host);
	}

	const platform = form.get('platform');
	if (!isWebsitePlatform(platform)) errors.platform = 'Choose where the website runs.';

	if (Object.keys(errors).length > 0 || !domain.ok || !isWebsitePlatform(platform)) {
		return { errors };
	}
	const domains = [...new Set([domain.host, ...extra.map(hostKey)])];
	if (domains.length > MAX_DOMAINS) {
		return { errors: { extraDomains: `A website can have at most ${MAX_DOMAINS} domains.` } };
	}
	return { input: { name, url: domain.url, platform, domains } };
}

function siteKeyFrom(form: FormData): string | null {
	const key = form.get('key');
	return typeof key === 'string' && SITE_KEY_PATTERN.test(key) ? key : null;
}

async function run<T>(task: () => Promise<T>) {
	try {
		return await task();
	} catch (error) {
		if (error instanceof WebsiteError) return fail(400, { message: error.message });
		console.error('Website change failed', error);
		return fail(500, { message: 'Could not save the website. Please try again.' });
	}
}

// Same-origin is enforced for every action by src/hooks.server.ts.
export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseWebsiteForm(await request.formData());
		if ('errors' in parsed) return fail(400, { errors: parsed.errors });
		return run(async () => ({ website: await createWebsite(parsed.input) }));
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const key = siteKeyFrom(form);
		if (!key) return fail(400, { message: 'Unknown website.' });
		const parsed = parseWebsiteForm(form);
		if ('errors' in parsed) return fail(400, { errors: parsed.errors });
		return run(async () => {
			await updateWebsite(key, parsed.input);
			return { saved: true };
		});
	},

	setDisabled: async ({ request }) => {
		const form = await request.formData();
		const key = siteKeyFrom(form);
		if (!key) return fail(400, { message: 'Unknown website.' });
		const disabled = form.get('disabled') === 'true';
		return run(async () => {
			await setWebsiteDisabled(key, disabled);
			return { disabled };
		});
	}
};
