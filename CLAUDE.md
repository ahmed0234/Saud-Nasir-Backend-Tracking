# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

One central backend that tracks leads from **three WordPress websites** (Platinum SG, Clean Master, EMG Air). Each site runs its own copy of a global JavaScript snippet that sends the site's identifier; when a visitor clicks a CTA (phone, booking, email/SMS, Elementor button) or submits a lead form, the snippet POSTs to this backend, which stores it in Neon Postgres, emails a notification, and shows everything in a read-only analytics dashboard (`/` and `/analytics`, filterable per website from the sidebar, behind a sign-in at `/login`). It is not a CRM. Opening the dashboard must never create events or send email.

```
WordPress site A ─┐
WordPress site B ─┼─ <site>-tracker.js ─────POST /api/cta-click──▶ SvelteKit on Vercel ──▶ Neon Postgres (cta_clicks)
WordPress site C ─┘   (fetch keepalive, text/plain)                     │                        ▲
                                                                        └─▶ Gmail SMTP email      └── dashboard / , /analytics
```

- **Production backend:** `https://fluxpoint-omega.vercel.app` (endpoint `https://fluxpoint-omega.vercel.app/api/cta-click`). Deployed by the user; we never deploy.
- **Sites** are defined once in `src/lib/sites.ts` (`platinum-sg`, `clean-master`, `emg-air`: name, URL, hosts, dashboard accent). Never rename an id once leads are stored with it.
- **Each lead row** (`cta_clicks`) stores `site`, `event_type` (`cta_click` | `form_submit`), `button_type` (call, sms, email, booking, button, elementor_form, fluent_form, cf7_form, wpforms_form, gravity_form, form, or a `data-cta` value), `button_text`, `form_name`, `page_url`, a generated `page_path` (route), city/state and `clicked_at`. Rows recorded before migration 0001 have null button fields; `site` is null for domains outside the three sites (2 old Ridgewell rows).
- **Site resolution in the API:** a production host listed in `sites.ts` decides the site (a snippet pasted on the wrong site can't mislabel leads); otherwise the snippet's `site` id is used (staging domains). Old payloads without `site` still work.

### The WordPress sites

Every site's exact origin (scheme + host as the browser sends it, after redirects) must be in `CORS_ALLOWED_ORIGINS` in **Vercel** (build and runtime), then redeploy. `.env.example` is only a template and is never read at runtime.

| Site         | Snippet                                          | Origin to allow (verified 2026-10-29)                             | Lead forms                              |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| Platinum SG  | `code-snippet-wordpress/platinum-sg-tracker.js`  | `https://www.platinumsg.com` (non-www 301s to www)                | Elementor Pro form (contact page)       |
| Clean Master | `code-snippet-wordpress/clean-master-tracker.js` | `https://www.cleanmastercarpetcleaning.com` (non-www 301s to www) | CTAs are `tel:` and Housecall Pro links |
| EMG Air      | `code-snippet-wordpress/emg-air-tracker.js`      | `https://www.emgair.com` (non-www 301s to www)                    | Fluent Forms (not Elementor)            |

Platinum SG's homepage is a static HTML page (not WordPress), so a WPCode snippet does not run there; its other pages are WordPress + Elementor. Ridgewell Colorado (`https://ridgewellcolorado.com`) was an earlier site; its old rows remain with `site = null`.

### The WordPress snippets (`code-snippet-wordpress/<site>-tracker.js`)

One file per site, identical except for `var SITE = '...'` and the header; keep them in sync when changing tracking logic. Installed via WPCode → JavaScript Snippet → Site Wide Footer → Active, replacing the old `cta-click-tracker.js` (same `window.__cmCtaTracker` guard, so an old and a new copy never both send). Plain browser JS, linted by the project config.

- **CTA clicks** (`eventType: 'cta_click'`) are detected by destination, not text: `tel:` → call, `sms:` → sms, `mailto:` → email, `*.housecallpro.com` / `hcp-button` / `HCPWidget` → booking, Elementor and add-on button widgets (`.elementor-button`, CTA/price table/flip box/slides buttons, ElementsKit, Essential Addons, Premium Addons, Royal Addons) → button. `data-cta="name"` opts in, `data-cta-ignore` opts out. Buttons inside forms (multi-step Next/Previous) are not CTAs. The same element within 1s is deduped.
- **Form submissions** (`eventType: 'form_submit'`) are recorded on the `submit` event (submit button click, Enter, mobile "Go"), plus a fallback after a submit-button click for plugins that cancel the click and send via AJAX. Only filled-in forms count: HTML validity plus `aria-required="true"` fields (how Fluent Forms marks required fields). One record per form per 3s. Search, login, comment and WooCommerce forms are skipped. Field values are never sent, only the submit button label and the form name.
- One capture-phase `click` + `submit` listener on `document` (+ middle-click `auxclick`); never `preventDefault`/`stopPropagation`.
- **Transport:** `fetch(..., { keepalive: true })` with a `text/plain` JSON body (no CORS preflight, survives navigation). `navigator.sendBeacon` is only a fallback: browsers type beacons as `ping`, and EasyPrivacy's `*$ping,third-party` rule blocks them → `net::ERR_BLOCKED_BY_CLIENT`. Don't switch back to sendBeacon-first.
- Skips the Elementor editor (`?elementor-preview=`) and `/wp-admin/`. **Debug:** `?cta_debug=1` logs e.g. `elementor_form submission sent via fetch`.
- Caching/optimization plugins must not delay it (exclude from WP Rocket/LiteSpeed "delay JS"); clear caches after updating it.
- Verified 2026-10-29 in headless Chrome (desktop and iPhone emulation) against saved copies of the real Platinum SG contact page, EMG Air contact page and Clean Master homepage.

### Status (as of 2026-10-29)

**Verified working:** live DB schema matches Drizzle (1 migration applied); end-to-end click → row → dashboard/analytics in a production build; CORS + CSRF behavior on the live endpoint for both allowed origins; Gmail sending locally and in a production build; test-email button; rate limiting; security headers deployed; snippet detection against the real Clean Master pages (simulated browser); user confirmed tracking works on the live sites.

**Pending deploy steps for multi-site + form tracking:** run `bun run db:migrate` (migration `0001_add_site_and_lead_type`; additive and safe for the currently deployed code), set `CORS_ALLOWED_ORIGINS` in Vercel to include all three origins, redeploy, then install the three snippets.

**Open items / not yet verified:**

- **Auth env vars must be set in Vercel** (`AUTH_USERNAME`, `AUTH_PASSWORD` ≥ 12 chars, `AUTH_SECRET` ≥ 32 chars), then redeploy. Until then nobody can sign in to the dashboard; tracking keeps working. Built and verified locally 2026-10-30 (curl + headless Chrome), not yet deployed.
- Gmail delivery _from Vercel_ specifically (Google can block data-center logins; check for a security alert after the first production email).
- Optional backend additions discussed but not built: `user_agent`/browser column (user-agent is already received, only emailed), first-party proxy for strict ad blockers, Vercel Firewall rate-limit rule.
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

- **Env vars** are declared in `src/env.ts` with `defineEnvVars` (SvelteKit 3's replacement for `$env/*`) and imported from `$app/env/private`. `CORS_ALLOWED_ORIGINS` is parsed there into a `string[]`. The `AUTH_*` vars are deliberately optional (null when missing) so a missing value can't take the tracking endpoint down.
- **Auth:** single account from `AUTH_USERNAME`/`AUTH_PASSWORD`, checked only on the server (`src/lib/server/auth.ts`, constant-time). `src/hooks.server.ts` protects every route except `PUBLIC_ROUTES` (`/login`, `/logout`, `/api/cta-click`; the tracking endpoint must stay public). Unauthenticated page and data requests get a 303 to `/login?redirectTo=…` (validated same-origin only); other requests get 401. Sessions are stateless: an HMAC-signed `v1.<expiry>.<sig>` cookie (`__Host-session` on HTTPS, `session` on http dev; httpOnly, SameSite=Lax, 7 days), signed with a key derived from `AUTH_SECRET` + the credentials, so changing either signs everyone out. Sign-in is rate limited (10 per IP per 15 min, per instance) and same-origin only, like `/logout` (POST). The login page (`src/routes/login`) plays a CSS opening animation while `preloadData` loads the dashboard, then `goto`s; it falls back to a full page load if that fails. Every full load of the dashboard (open, reload, and right after sign-in, continuing the login veil) plays `#lib/components/dashboard/opening-intro.svelte`: server-rendered, CSS-only (transform/opacity), ~0.9s, never replays on client-side navigation, hidden under `prefers-reduced-motion`.
- **Database:** Drizzle ORM over Neon's HTTP driver (`drizzle-orm/neon-http`). Client in `src/lib/server/db/index.ts`, schema in `src/lib/server/db/schema.ts`. Drizzle Kit owns migrations in `drizzle/` (excluded from Prettier). Don't introduce Prisma.
- **Endpoint:** `POST /api/cta-click` (`src/routes/api/cta-click/+server.ts`) accepts `{ site?, eventType?, buttonType?, buttonText?, formName?, pageUrl, city?, state?, clickedAt? }`. `pageUrl`'s origin must be in `CORS_ALLOWED_ORIGINS`. Missing city/state fall back to edge geo headers (`src/lib/server/geo.ts`: Vercel `x-vercel-ip-*`, Cloudflare `cf-*` fallback); a missing or implausible `clickedAt` falls back to server time. The body is parsed as JSON regardless of content type, so the snippet's `text/plain` requests (no CORS preflight) work; replies 204 on success, 400/403/405/413/429 otherwise.
- **Email:** after the insert, the endpoint returns 204 and sends a notification via `waitUntil` from `@vercel/functions` (a no-op outside Vercel). `src/lib/server/email/index.ts` sends through Gmail SMTP (Nodemailer 10, which ships its own types) and never throws; on Gmail quota/rate-limit/auth errors it pauses sending per instance. The HTML template lives in `src/lib/server/email/cta-click-email.ts` and must escape every interpolated value.
- **Production hardening:** `src/hooks.server.ts` sets security headers (nosniff, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`); `/api/cta-click` is rate limited per client IP (`src/lib/server/rate-limit.ts`, in-memory, per instance, best-effort); the `sendTestEmail` action, sign-in and sign-out only accept same-origin requests (`csrf.trustedOrigins` also admits the WordPress sites). `vite.config.ts` sets `maxDuration: 60` on the Vercel function and fails the build if `CORS_ALLOWED_ORIGINS` is empty. `package.json` pins Node `24.x` (Vercel otherwise builds on the newest Node, which the adapter rejects) and `vite.config.ts` pins the `nodejs24.x` function runtime and overrides `zod` to a patched version.
- **CORS/CSRF coupling:** SvelteKit's CSRF check rejects cross-origin text/plain POSTs before hooks run, so `vite.config.ts` also feeds `CORS_ALLOWED_ORIGINS` into `csrf.trustedOrigins` at build time — changing allowed origins needs a redeploy. The CSRF check is skipped in dev.
- **Routes:** the dashboard lives in the `src/routes/(app)` group (its layout holds the sidebar shell and `getSiteCounts`); the root layout only sets up theme, toasts and the time-zone cookie, so `/login` renders without the shell. In SvelteKit 3, `resolve()` takes a route ID (leading `/`, e.g. `resolve('/(app)/analytics')`) or a pathname (no leading slash). **Links with a query string must use the pathname form** (`resolve(`?${params}`)`, `resolve(`analytics?${params}`)`): the route-ID form only drops the `(app)` group when it is a whole segment, so `resolve('/(app)?site=x')` produced `/(app)?site=x`, which 404s. `route.id` is `'/(app)/analytics'`.
- **Dashboard:** the `(app)` layout has a glass sidebar (`#lib/components/dashboard/app-sidebar.svelte`; a Sheet below `lg`) listing All websites + the three sites with all-time counts (`getSiteCounts` in `(app)/+layout.server.ts`) and a sign-out button. The selected site lives in the `site` URL param; every analytics query takes it (`null` = all). Server `load` functions (no client-side DB access) call `src/lib/server/analytics.ts`, which does all aggregation in Postgres. `/analytics` filters live in URL params (`range=24h|3d|7d|30d|custom&from&to`). Time-series buckets come from `generate_series`, so empty periods are zero. UI uses the shadcn-svelte components in `src/lib/components/ui`, layerchart 2 via `ui/chart`, and app components in `src/lib/components/dashboard`; the `glass` surface utility is defined in `layout.css`. **View transitions** (CSS only, `.dashboard-view` in `layout.css`): when the page or website changes (not filters), the `(app)` layout's `{#key}` remounts the view; while the next one loads it gets `data-leaving` (dims), then its sections and the children of any `data-stagger` element rise in. The sidebar highlights (sites and views) move on click via `navigating.to`, while `aria-current` stays on the page actually shown.
- **Time zones:** timestamps are stored and sent as UTC ISO strings. `+layout.svelte` writes the browser's IANA zone to the `tz` cookie (`src/lib/timezone.ts`) and refreshes once; server loads use it for local-day boundaries (`AT TIME ZONE`) and pass `timeZone` to pages so server and client format dates identically. In SQL, parenthesize `x` in `x AT TIME ZONE tz` when `x` is an expression.
- **Test email:** the `sendTestEmail` form action on `/` calls `sendTestEmail()` from the email module, throttled to one per 30s per instance.
- **Browser info is not stored.** The schema has no browser/user-agent column; the endpoint only forwards the `User-Agent` header to the email.
- `page_path` is a Postgres generated column (`generatedAlwaysAs` in the schema), so it can't drift from `page_url`.
- SvelteKit 3: use `refreshAll` (not `invalidateAll`), `goto(url, { reset: false })` (not `noScroll`/`keepFocus`), and `resolve()` from `$app/paths` for internal links (ESLint enforces it; external WordPress links need an eslint-disable block).
- `#lib/*` subpath imports need explicit file extensions (e.g. `#lib/server/geo.ts`).

## Code style

Prettier: tabs, single quotes, no trailing commas, print width 100. ESLint uses typescript-eslint + eslint-plugin-svelte with `no-undef` disabled and `_`-prefixed args allowed; it respects `.gitignore` and skips `.agents/` and `.claude/` (agent skill bundles, also in `.prettierignore`). `bun run lint` passes cleanly; keep it that way.
