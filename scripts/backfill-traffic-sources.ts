// One-off: gives leads recorded before migration 0004 a traffic source from the campaign
// parameters they already stored (UTMs, gclid, fbclid, ...), with the same rules the endpoint
// uses for new leads. Leads with no campaign data keep a null source ("Not recorded"): their
// tracker didn't report the referrer, so "Direct" would be a guess. Safe to run more than once.
//
//   bun run db:backfill-sources            (reads DATABASE_URL from .env)

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { and, eq, isNull, or, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { ctaClicks } from '../src/lib/server/db/schema.ts';
import { classifyTrafficSource } from '../src/lib/traffic-source.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const db = drizzle({ client: neon(process.env.DATABASE_URL) });

const rows = await db
	.select()
	.from(ctaClicks)
	.where(
		and(
			isNull(ctaClicks.trafficSource),
			or(
				isNotNull(ctaClicks.utmSource),
				isNotNull(ctaClicks.utmMedium),
				isNotNull(ctaClicks.gclid),
				isNotNull(ctaClicks.gbraid),
				isNotNull(ctaClicks.wbraid),
				isNotNull(ctaClicks.fbclid),
				isNotNull(ctaClicks.msclkid),
				isNotNull(ctaClicks.ttclid),
				isNotNull(ctaClicks.liFatId),
				isNotNull(ctaClicks.twclid)
			)
		)
	);

for (const row of rows) {
	const { source, channel } = classifyTrafficSource(row);
	await db
		.update(ctaClicks)
		.set({ trafficSource: source, trafficChannel: channel })
		.where(and(eq(ctaClicks.id, row.id), isNull(ctaClicks.trafficSource)));
	console.log(`${row.id}  ${source} (${channel})`);
}
console.log(`Backfilled ${rows.length} lead(s).`);
