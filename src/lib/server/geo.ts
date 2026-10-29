export type Geo = { city: string | null; state: string | null; country: string | null };

// Browsers can't reliably report location without a permission prompt, so location comes
// from the visitor's IP via headers the hosting edge adds to each request. On Vercel these are
// x-vercel-ip-city (URI-encoded), x-vercel-ip-country-region (ISO 3166-2 code, e.g. "CA") and
// x-vercel-ip-country. Cloudflare equivalents are read as a fallback in case the app sits behind it.
export function geoFromHeaders(headers: Headers): Geo {
	return {
		city: header(headers, 'x-vercel-ip-city') ?? header(headers, 'cf-ipcity'),
		state: header(headers, 'x-vercel-ip-country-region') ?? header(headers, 'cf-region'),
		country: header(headers, 'x-vercel-ip-country') ?? header(headers, 'cf-ipcountry')
	};
}

function header(headers: Headers, name: string): string | null {
	const raw = headers.get(name)?.trim();
	if (!raw) return null;
	let value = raw;
	try {
		value = decodeURIComponent(raw);
	} catch {
		// keep raw value if it isn't valid URI encoding
	}
	return value.slice(0, 120) || null;
}
