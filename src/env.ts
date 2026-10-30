import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Neon PostgreSQL connection string (pooled).',
		schema: (value) => required('DATABASE_URL', value)
	},
	GMAIL_USER: {
		description: 'Gmail address that sends notification emails (SMTP login).',
		schema: (value) => required('GMAIL_USER', value)
	},
	GMAIL_APP_PASSWORD: {
		description: 'Google App Password for GMAIL_USER (16 characters; spaces are ignored).',
		// Google displays app passwords in groups of four separated by spaces.
		schema: (value) => required('GMAIL_APP_PASSWORD', value).replace(/\s+/g, '')
	},
	NOTIFICATION_EMAIL_TO: {
		description: 'Comma-separated recipient address(es) for CTA click notifications.',
		schema: (value) => {
			const recipients = parseList(required('NOTIFICATION_EMAIL_TO', value));
			if (recipients.length === 0) throw new Error('NOTIFICATION_EMAIL_TO is required');
			return recipients;
		}
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

function parseList(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function required(name: string, value: string | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) throw new Error(`${name} is required`);
	return trimmed;
}
