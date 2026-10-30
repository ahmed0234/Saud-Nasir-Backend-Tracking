// Formatting helpers shared by server and client. Timestamps arrive as UTC ISO strings and are
// shown in `timeZone` (the viewer's zone, from the tz cookie) so server and client render the
// same text during hydration.

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1
});

export function formatNumber(value: number): string {
	return value >= 10_000 ? compactFormatter.format(value) : numberFormatter.format(value);
}

export function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

export function formatDateTime(iso: string | Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone,
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(iso));
}

export function formatDay(value: string | Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(
		new Date(value)
	);
}

export function formatHour(value: string | Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone,
		month: 'short',
		day: 'numeric',
		hour: 'numeric'
	}).format(new Date(value));
}

export function formatUtc(iso: string): string {
	return `${new Date(iso).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/** Splits a page URL into its host and a readable, decoded path. */
export function splitUrl(value: string): { host: string; path: string } {
	try {
		const url = new URL(value);
		let path = url.pathname + url.search;
		try {
			path = decodeURIComponent(path);
		} catch {
			// keep encoded path
		}
		return { host: url.host, path: path || '/' };
	} catch {
		return { host: '', path: value };
	}
}

const relativeFormatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago", ... */
export function formatRelative(iso: string | Date, now: number = Date.now()): string {
	const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
	if (Math.abs(seconds) < 45) return 'just now';
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['minute', 60],
		['hour', 3600],
		['day', 86_400],
		['week', 604_800],
		['month', 2_629_800],
		['year', 31_557_600]
	];
	let unit = units[0];
	for (const candidate of units) if (Math.abs(seconds) >= candidate[1]) unit = candidate;
	return relativeFormatter.format(Math.round(seconds / unit[1]), unit[0]);
}
