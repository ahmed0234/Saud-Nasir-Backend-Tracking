import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { MAX_CUSTOM_DAYS } from '#lib/date-range.ts';
import { db } from './db/index.ts';
import { ctaClicks } from './db/schema.ts';

// Permanent deletion of leads from the dashboard. Callers are signed-in, same-origin form actions;
// everything here still validates its input so a crafted request can only delete what it names.

/** Most leads one "delete selected" request may name (the overview lists at most 50). */
export const MAX_DELETE_IDS = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60_000;

/** The distinct, well-formed lead ids in `values`, or null if any value is not a lead id. */
export function parseLeadIds(values: FormDataEntryValue[]): string[] | null {
	const ids = new Set<string>();
	for (const value of values) {
		if (typeof value !== 'string' || !UUID.test(value)) return null;
		ids.add(value.toLowerCase());
	}
	return [...ids];
}

/**
 * The [start, end) instants of a range shown on /analytics, or null if they are not valid ISO
 * timestamps or span more than the longest range the dashboard can show.
 */
export function parseRange(startValue: unknown, endValue: unknown) {
	if (typeof startValue !== 'string' || typeof endValue !== 'string') return null;
	const start = new Date(startValue);
	const end = new Date(endValue);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;
	// A custom range is at most MAX_CUSTOM_DAYS local days; allow an extra day for DST shifts.
	if (end.getTime() - start.getTime() > (MAX_CUSTOM_DAYS + 1) * DAY_MS) return null;
	return { start, end };
}

/** Deletes the leads with these ids. Returns how many rows were removed. */
export async function deleteLeadsById(ids: string[]): Promise<number> {
	if (ids.length === 0) return 0;
	const deleted = await db
		.delete(ctaClicks)
		.where(inArray(ctaClicks.id, ids))
		.returning({ id: ctaClicks.id });
	return deleted.length;
}

/**
 * Deletes every lead recorded in [start, end), for one website or (site = null) all of them.
 * Returns how many rows were removed.
 */
export async function deleteLeadsInRange(
	start: Date,
	end: Date,
	site: string | null
): Promise<number> {
	const deleted = await db
		.delete(ctaClicks)
		.where(
			and(
				gte(ctaClicks.clickedAt, start),
				lt(ctaClicks.clickedAt, end),
				site ? eq(ctaClicks.site, site) : undefined
			)
		)
		.returning({ id: ctaClicks.id });
	return deleted.length;
}
