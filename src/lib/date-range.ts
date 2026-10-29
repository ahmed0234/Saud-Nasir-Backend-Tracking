export const PRESETS = [
	{ key: '24h', label: 'Last 24 hours', short: '24h', hours: 24 },
	{ key: '3d', label: 'Last 3 days', short: '3d', hours: 72 },
	{ key: '7d', label: 'Last 7 days', short: '7d', hours: 168 },
	{ key: '30d', label: 'Last 30 days', short: '30d', hours: 720 }
] as const;

export type PresetKey = (typeof PRESETS)[number]['key'];
export type RangeKey = PresetKey | 'custom';

export const DEFAULT_RANGE: PresetKey = '7d';
export const MAX_CUSTOM_DAYS = 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null): value is string {
	return value !== null && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

/** YYYY-MM-DD for `date` as seen in `timeZone`. */
export function toLocalIsoDate(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}
