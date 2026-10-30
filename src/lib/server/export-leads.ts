import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { leadOrigin } from '#lib/lead-attribution.ts';
import { buttonTypeLabel, CAMPAIGN_FIELDS, EVENT_TYPE_LABELS, isEventType } from '#lib/sites.ts';
import { db } from './db/index.ts';
import { ctaClicks } from './db/schema.ts';

// CSV export of the leads behind /analytics. RFC 4180: comma-separated, CRLF line ends, fields
// quoted when needed, with a UTF-8 byte order mark so Excel reads accented city names correctly.

/** UTF-8 byte order mark, so Excel opens the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

const COLUMNS = [
	'Date',
	'Time',
	'Time Zone',
	'Date & Time (UTC)',
	'Website',
	'Lead Type',
	'Action',
	'Button / Link Text',
	'Form Name',
	'Page',
	'Page URL',
	'City',
	'State / Region',
	'Lead Origin',
	'Header CTA',
	'Source CTA',
	'Source CTA Type',
	'Source CTA Page',
	'Source CTA Clicked At (UTC)',
	...CAMPAIGN_FIELDS.map((field) => field.label),
	'Lead ID'
];

/** Every lead in [start, end) for one website (or all, when site is null), oldest first. */
export async function getLeadsForExport(start: Date, end: Date, site: string | null) {
	return db
		.select()
		.from(ctaClicks)
		.where(
			and(
				gte(ctaClicks.clickedAt, start),
				lt(ctaClicks.clickedAt, end),
				site ? eq(ctaClicks.site, site) : undefined
			)
		)
		.orderBy(asc(ctaClicks.clickedAt), asc(ctaClicks.id));
}

type ExportRow = Awaited<ReturnType<typeof getLeadsForExport>>[number];

/** `siteNames`: website name by site key. */
export function leadsToCsv(
	rows: ExportRow[],
	timeZone: string,
	siteNames: Map<string, string>
): string {
	// sv-SE formats as "2026-10-30 13:52:07": sortable and unambiguous in any spreadsheet locale.
	const local = new Intl.DateTimeFormat('sv-SE', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	});

	const lines = rows.map((row) => {
		const [date, time] = local.format(row.clickedAt).split(' ');
		return [
			date,
			time,
			timeZone,
			isoSeconds(row.clickedAt),
			(row.site && siteNames.get(row.site)) || hostOf(row.pageUrl) || 'Other',
			isEventType(row.eventType) ? EVENT_TYPE_LABELS[row.eventType] : row.eventType,
			buttonTypeLabel(row.buttonType),
			row.buttonText,
			row.formName,
			row.pagePath,
			row.pageUrl,
			row.city,
			row.state,
			leadOrigin(row),
			row.isHeaderCta ? 'Yes' : 'No',
			row.sourceCtaText,
			buttonTypeLabel(row.sourceCtaType),
			row.sourceCtaPageUrl,
			row.sourceCtaClickedAt ? isoSeconds(row.sourceCtaClickedAt) : null,
			...CAMPAIGN_FIELDS.map((field) => row[field.key]),
			row.id
		]
			.map(csvField)
			.join(',');
	});

	return `${BOM}${[COLUMNS.join(','), ...lines].join('\r\n')}\r\n`;
}

function csvField(value: string | null | undefined): string {
	let text = value ?? '';
	// Lead text comes from public websites. A leading =, +, -, @, tab or CR would make Excel or
	// Sheets evaluate the cell as a formula (CSV injection), so it is prefixed with an apostrophe.
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function isoSeconds(date: Date): string {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return '';
	}
}
