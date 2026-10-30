import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
			adapter: adapter({ runtime: 'nodejs24.x', maxDuration: 60 }),
			csrf: {
				// SvelteKit's built-in check only knows origins listed at build time, but registered
				// websites (which post text/plain tracking events cross-origin) change at runtime. So it
				// is turned off here and src/hooks.server.ts enforces same-origin for every other
				// state-changing request instead.
				trustedOrigins: ['*']
			}
		})
	]
});
