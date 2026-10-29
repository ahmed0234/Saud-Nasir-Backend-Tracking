// The browser stores its IANA time zone in this cookie (see +layout.svelte) so server-side
// queries can bucket "today" and "by day" in the viewer's local time. Timestamps themselves
// are always stored and transferred in UTC.
export const TIME_ZONE_COOKIE = 'tz';
export const DEFAULT_TIME_ZONE = 'UTC';

export function resolveTimeZone(value: string | undefined): string {
	return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export function isValidTimeZone(value: string | undefined): value is string {
	if (!value || value.length > 64) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value });
		return true;
	} catch {
		return false;
	}
}
