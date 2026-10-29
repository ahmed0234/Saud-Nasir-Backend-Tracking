/**
 * Fixed-window, in-memory rate limiter keyed by client IP. On Vercel each function instance has
 * its own memory, so this is best-effort: it stops a single script from flooding the database
 * and the Gmail quota, but a determined distributed attacker needs a Vercel Firewall rule.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
	const hits = new Map<string, { count: number; resetAt: number }>();

	return function check(key: string): { allowed: boolean; retryAfterSeconds: number } {
		const now = Date.now();

		// Keep memory bounded on long-lived instances.
		if (hits.size > 10_000) {
			for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
		}

		const entry = hits.get(key);
		if (!entry || entry.resetAt <= now) {
			hits.set(key, { count: 1, resetAt: now + windowMs });
			return { allowed: true, retryAfterSeconds: 0 };
		}

		entry.count += 1;
		return {
			allowed: entry.count <= limit,
			retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000)
		};
	};
}
