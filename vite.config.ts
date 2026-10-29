import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { parseOrigins } from './src/env.ts';

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const trustedOrigins = parseOrigins(env.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ALLOWED_ORIGINS);

	// Without these, SvelteKit's CSRF check silently rejects every sendBeacon request from the
	// WordPress site in production, so fail the build instead of deploying a broken tracker.
	if (command === 'build' && trustedOrigins.length === 0) {
		throw new Error('CORS_ALLOWED_ORIGINS must be set at build time (e.g. in Vercel env vars).');
	}

	return {
		plugins: [
			enhancedImages(),
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				// Covers the slowest path: a notification or test email whose first SMTP connection
				// fails and is retried (two attempts of up to ~30s each).
				adapter: adapter({ maxDuration: 60 }),
				csrf: {
					// SvelteKit rejects cross-origin text/plain POSTs (what navigator.sendBeacon sends)
					// unless the origin is trusted. Read at build time, so redeploy after changing it.
					trustedOrigins
				}
			})
		]
	};
});
