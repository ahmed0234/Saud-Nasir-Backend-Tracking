# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

One central backend that tracks CTA clicks (leads) from **three WordPress websites**. Each site runs the same global JavaScript snippet; when a visitor clicks a phone or booking CTA, the snippet POSTs to this backend, which stores the click in Neon Postgres, emails a notification, and shows everything in a read-only analytics dashboard (`/` and `/analytics`). It is not a CRM. Opening the dashboard must never create events or send email.

```
WordPress site A ─┐
WordPress site B ─┼─ cta-click-tracker.js ──POST /api/cta-click──▶ SvelteKit on Vercel ──▶ Neon Postgres (cta_clicks)
WordPress site C ─┘   (fetch keepalive, text/plain)                     │                        ▲
                                                                        └─▶ Gmail SMTP email      └── dashboard / , /analytics
```

- **Production backend:** `https://fluxpoint-omega.vercel.app` (endpoint `https://fluxpoint-omega.vercel.app/api/cta-click`). Deployed by the user; we never deploy.
- **Which site a click came from** is only identifiable from the stored `page_url` host. There is no `site` column and no CTA type (call vs booking) column; the snippet sends only `pageUrl` and `clickedAt`.
- **"Leads" = CTA clicks only.** Form submissions on the WordPress sites are not tracked.

### The WordPress sites

Every site's exact origin (scheme + host as the browser sends it, after redirects) must be in `CORS_ALLOWED_ORIGINS` in **Vercel** (build and runtime), then redeploy. `.env.example` is only a template and is never read at runtime.

| Site                         | Origin to allow                                                                                                                                                       | Status (as of 2026-10-29)                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean Master Carpet Cleaning | `https://www.cleanmastercarpetcleaning.com` (non-www 301s to www)                                                                                                     | Allowed in production (verified live). Snippet installed via WPCode.                                                                                              |
| Ridgewell Colorado           | `https://ridgewellcolorado.com` (www and http 301 to it)                                                                                                              | Allowed in production (verified live). Snippet installed; the `ERR_BLOCKED_BY_CLIENT` issue was fixed by the fetch-first snippet change; user confirmed it works. |
| Third site                   | **Unconfirmed.** `https://olivedrab-shark-268292.hostingersite.com` (a Hostinger temp domain) is in `.env`/`.env.example`, possibly the third site or its staging URL | Not verified. Confirm the real domain, add its exact origin in Vercel, redeploy, install the snippet.                                                             |

The `.env` list also contains a bare `ridgewellcolorado.com` (no scheme). It never matches a browser origin; harmless but useless.

### The WordPress snippet (`code-snippet-wordpress/cta-click-tracker.js`)

The same file goes on every site (WPCode → JavaScript Snippet → Site Wide Footer → Active). Plain browser JS; it is linted by the project config.

- **Detection is by link destination, not text or CSS:** `href^="tel:"` → call; `*.housecallpro.com` link, `hcp-button` class or `HCPWidget` onclick → booking; `data-cta="..."` opts any element in; `data-cta-ignore` opts out. One capture-phase `click` listener on `document` (+ middle-click `auxclick`), so it covers Elementor widgets, popups and late-loaded content. On 12 Clean Master pages every CTA was a `tel:` or `book.housecallpro.com` link (no "Call Us Now" text buttons, no HCP widget).
- **Never interferes:** no `preventDefault`/`stopPropagation`; dialer, Housecall Pro and the LeadConnector chat link (a `tel:` link whose onclick opens chat; it is tracked as a call) behave as before.
- **Transport:** `fetch(..., { keepalive: true })` with a `text/plain` JSON body (no CORS preflight, survives navigation). `navigator.sendBeacon` is only a fallback: browsers type beacons as `ping`, and EasyPrivacy's `*$ping,third-party` rule (default in uBlock Origin, AdBlock, AdGuard, Brave) blocks them → `net::ERR_BLOCKED_BY_CLIENT`. Don't switch back to sendBeacon-first. Blockers set to block all third-party requests can still block it; the only full fix would be a first-party proxy on each WordPress domain (not built).
- Skips the Elementor editor (`?elementor-preview=`) and `/wp-admin/`; dedupes repeat clicks on the same element within 1s; guards against double inclusion.
- **Debug:** add `?cta_debug=1` to a page URL; the console logs `call click sent via fetch`.
- Caching/optimization plugins must not delay it (exclude from WP Rocket/LiteSpeed "delay JS"); clear caches after updating it.

### Status (as of 2026-10-29)

**Verified working:** live DB schema matches Drizzle (1 migration applied); end-to-end click → row → dashboard/analytics in a production build; CORS + CSRF behavior on the live endpoint for both allowed origins; Gmail sending locally and in a production build; test-email button; rate limiting; security headers deployed; snippet detection against the real Clean Master pages (simulated browser); user confirmed tracking works on the live sites.

**Open items / not yet verified:**

- **No authentication.** Clerk is not integrated at all (no package, code or env vars). The dashboard and test-email button are public to anyone with the URL. Needs Clerk (user must create a Clerk app and provide keys) or Vercel Deployment Protection.
- Third WordPress site: domain, origin and snippet install (see table).
- Gmail delivery _from Vercel_ specifically (Google can block data-center logins; check for a security alert after the first production email).
- Optional backend additions discussed but not built: CTA type (call/booking) column, `user_agent`/browser column (user-agent is already received, only emailed), first-party proxy for strict ad blockers, Vercel Firewall rate-limit rule.
- The project is not a git repository yet. `.env.example` contains the user's real recipient address; replace it with a placeholder before pushing anywhere public.
- Testing in this repo leaves rows in the shared production database. Label test clicks clearly (e.g. a `__audit-test__` path) and delete them afterwards; never mix fake data with real data.

## Commands

Package manager is **bun** (`bun.lock`); `.npmrc` sets `engine-strict=true`.

- `bun install` — install deps (runs `svelte-kit sync` via `prepare`)
- `bun run dev` — dev server
- `bun run build` / `bun run preview` — production build (Vercel adapter) and local preview
- `bun run check` — `svelte-kit sync` + `svelte-check` type checking
- `bun run lint` — `prettier --check .` then `eslint .`
- `bun run format` — `prettier --write .`
- `bun run db:generate` — generate a SQL migration in `drizzle/` from schema changes
- `bun run db:migrate` — apply pending migrations to the database at `DATABASE_URL`
- `bun run db:studio` — Drizzle Studio

`drizzle.config.ts` loads `.env` via `dotenv`. On Windows, `bun run build` fails at the Vercel adapter step (symlink EPERM) unless Developer Mode is on; the Vite compile before that step is still a valid check.

No test framework is configured.

## Stack specifics worth knowing

These differ from older SvelteKit conventions, so don't assume SvelteKit 2 patterns:

- **SvelteKit 3 / Svelte 5 / Vite 8.** There is no `svelte.config.js` — SvelteKit config (adapter, compiler options) lives inside the `sveltekit({...})` plugin call in `vite.config.ts`.
- **Runes mode is forced** for all project files (`compilerOptions.runes` in `vite.config.ts`). Use `$props()`, `$state()`, `$derived()`, `{@render children()}` — not `export let`, `$:`, or `<slot>`.
- **`#lib` instead of `$lib`.** The lib alias is a Node subpath import defined in `package.json` `imports` (`#lib` → `src/lib/index.js`, `#lib/*` → `src/lib/*`), e.g. `import favicon from '#lib/assets/favicon.svg'`.
- `tsconfig.json` extends `$app/tsconfig` (generated by `svelte-kit sync`); run `bun run check` or `svelte-kit sync` if generated `./$types` imports fail to resolve.
- **Tailwind CSS v4** with no `tailwind.config.*`: configuration and plugins (`@tailwindcss/forms`, `@tailwindcss/typography`) are declared in `src/routes/layout.css`, which is imported by the root `+layout.svelte`. Prettier's Tailwind plugin also points at this file for class sorting.
- `@sveltejs/enhanced-img` is enabled for optimized images.
- Deploy target is Vercel (`@sveltejs/adapter-vercel`).

## Architecture

- **Env vars** are declared in `src/env.ts` with `defineEnvVars` (SvelteKit 3's replacement for `$env/*`) and imported from `$app/env/private`. `CORS_ALLOWED_ORIGINS` is parsed there into a `string[]`.
- **Database:** Drizzle ORM over Neon's HTTP driver (`drizzle-orm/neon-http`). Client in `src/lib/server/db/index.ts`, schema in `src/lib/server/db/schema.ts`. Drizzle Kit owns migrations in `drizzle/` (excluded from Prettier). Don't introduce Prisma.
- **Endpoint:** `POST /api/cta-click` (`src/routes/api/cta-click/+server.ts`) accepts `{ pageUrl, city?, state?, clickedAt? }`. `pageUrl`'s origin must be in `CORS_ALLOWED_ORIGINS`. Missing city/state fall back to edge geo headers (`src/lib/server/geo.ts`: Vercel `x-vercel-ip-*`, Cloudflare `cf-*` fallback); a missing or implausible `clickedAt` falls back to server time. The body is parsed as JSON regardless of content type, so the snippet's `text/plain` requests (no CORS preflight) work; replies 204 on success, 400/403/405/413/429 otherwise.
- **Email:** after the insert, the endpoint returns 204 and sends a notification via `waitUntil` from `@vercel/functions` (a no-op outside Vercel). `src/lib/server/email/index.ts` sends through Gmail SMTP (Nodemailer 10, which ships its own types) and never throws; on Gmail quota/rate-limit/auth errors it pauses sending per instance. The HTML template lives in `src/lib/server/email/cta-click-email.ts` and must escape every interpolated value.
- **Production hardening:** `src/hooks.server.ts` sets security headers (nosniff, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`); `/api/cta-click` is rate limited per client IP (`src/lib/server/rate-limit.ts`, in-memory, per instance, best-effort); the `sendTestEmail` action only accepts same-origin requests. `vite.config.ts` sets `maxDuration: 60` on the Vercel function and fails the build if `CORS_ALLOWED_ORIGINS` is empty. `package.json` requires Node ≥ 22.17 (SvelteKit 3) and overrides `zod` to a patched version.
- **CORS/CSRF coupling:** SvelteKit's CSRF check rejects cross-origin text/plain POSTs before hooks run, so `vite.config.ts` also feeds `CORS_ALLOWED_ORIGINS` into `csrf.trustedOrigins` at build time — changing allowed origins needs a redeploy. The CSRF check is skipped in dev.
- **Dashboard:** server `load` functions (no client-side DB access) call `src/lib/server/analytics.ts`, which does all aggregation in Postgres. `/analytics` filters live in URL params (`range=24h|3d|7d|30d|custom&from&to`). Time-series buckets come from `generate_series`, so empty periods are zero. UI uses the shadcn-svelte components in `src/lib/components/ui`, layerchart 2 via `ui/chart`, and app components in `src/lib/components/dashboard`; the `glass` surface utility is defined in `layout.css`.
- **Time zones:** timestamps are stored and sent as UTC ISO strings. `+layout.svelte` writes the browser's IANA zone to the `tz` cookie (`src/lib/timezone.ts`) and refreshes once; server loads use it for local-day boundaries (`AT TIME ZONE`) and pass `timeZone` to pages so server and client format dates identically. In SQL, parenthesize `x` in `x AT TIME ZONE tz` when `x` is an expression.
- **Test email:** the `sendTestEmail` form action on `/` calls `sendTestEmail()` from the email module, throttled to one per 30s per instance.
- **Browser info is not stored.** The schema has no browser/user-agent column; the endpoint only forwards the `User-Agent` header to the email.
- SvelteKit 3: use `refreshAll` (not `invalidateAll`), `goto(url, { reset: false })` (not `noScroll`/`keepFocus`), and `resolve()` from `$app/paths` for internal links (ESLint enforces it; external WordPress links need an eslint-disable block).
- `#lib/*` subpath imports need explicit file extensions (e.g. `#lib/server/geo.ts`).

## Code style

Prettier: tabs, single quotes, no trailing commas, print width 100. ESLint uses typescript-eslint + eslint-plugin-svelte with `no-undef` disabled and `_`-prefixed args allowed; it respects `.gitignore` and skips `.agents/` and `.claude/` (agent skill bundles, also in `.prettierignore`). `bun run lint` passes cleanly; keep it that way.
