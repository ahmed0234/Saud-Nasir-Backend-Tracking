import source from '../tracker/tracker.js?raw';

// The one tracker (src/lib/tracker/tracker.js), served two ways: as is from /t.js, where it reads
// its site key from its own <script data-site> tag, or as inline code with the site key and
// endpoint written in (the install fallback for sites that can't load external scripts).

const CONFIG_LINE = 'var INLINE_CONFIG = null;';

if (!source.includes(CONFIG_LINE)) {
	throw new Error(`tracker.js must contain "${CONFIG_LINE}" for inline installs`);
}

export const trackerScript: string = source;

/** Full tracker for pasting inside <script></script>, bound to one website. */
export function inlineTrackerScript(siteKey: string, origin: string): string {
	// JSON in a <script> element: escape "<" so the values can never close the tag.
	const config = JSON.stringify({ site: siteKey, endpoint: `${origin}/api/cta-click` }).replace(
		/</g,
		'\\u003c'
	);
	return source.replace(CONFIG_LINE, `var INLINE_CONFIG = ${config};`);
}
