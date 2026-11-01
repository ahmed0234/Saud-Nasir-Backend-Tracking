import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Neon PostgreSQL connection string (pooled).',
		schema: (value) => required('DATABASE_URL', value)
	},
	// The auth variables are optional so a missing value can never take the tracking endpoint
	// down; without them the dashboard stays locked (see src/lib/server/auth.ts).
	AUTH_USERNAME: {
		description: 'Username for signing in to the dashboard.',
		schema: (value) => value?.trim() || null
	},
	AUTH_PASSWORD: {
		description: 'Password for signing in to the dashboard (at least 12 characters).',
		schema: (value) => value || null
	},
	AUTH_SECRET: {
		description:
			'Random secret (at least 32 characters) that signs session cookies, e.g. `openssl rand -base64 32`. Changing it signs everyone out.',
		schema: (value) => value?.trim() || null
	}
});

function required(name: string, value: string | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) throw new Error(`${name} is required`);
	return trimmed;
}
