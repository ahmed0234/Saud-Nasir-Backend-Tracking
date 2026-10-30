import { createTransport, type Transporter } from 'nodemailer';
import { GMAIL_APP_PASSWORD, GMAIL_USER, NOTIFICATION_EMAIL_TO } from '$app/env/private';
import { renderCtaClickEmail, type CtaClickEmailDetails } from './cta-click-email.ts';

type SmtpError = Error & {
	code?: string;
	responseCode?: number;
	response?: string;
	command?: string;
	originalCode?: string;
};
type FailureKind = 'quota' | 'rate_limit' | 'auth' | 'connection' | 'tls' | 'rejected' | 'unknown';

// Certificate failures mean something between this machine and Gmail replaced Gmail's
// certificate, typically antivirus email scanning (e.g. Avast/AVG Mail Shield) or a proxy.
const TLS_CERT_CODES = new Set([
	'SELF_SIGNED_CERT_IN_CHAIN',
	'DEPTH_ZERO_SELF_SIGNED_CERT',
	'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
	'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
	'CERT_HAS_EXPIRED',
	'ERR_TLS_CERT_ALTNAME_INVALID'
]);

// Nodemailer connection-stage codes plus Node socket errnos it can pass through.
const CONNECTION_CODES = new Set([
	'ECONNECTION',
	'ETIMEDOUT',
	'ESOCKET',
	'EDNS',
	'ETLS',
	'ECONNREFUSED',
	'ECONNRESET',
	'ENETUNREACH',
	'EHOSTUNREACH',
	'ENOTFOUND',
	'EAI_AGAIN'
]);

export type DeliveryResult =
	{ ok: true; recipients: string[] } | { ok: false; kind: FailureKind | 'paused'; message: string };

// Pause sending after Gmail pushes back, so a burst of clicks doesn't keep hitting a rejecting
// server (repeated failed logins can get the account temporarily locked). This is per function
// instance, so it's best-effort; skipped notifications are logged and the click is still saved.
const COOLDOWN_MS: Record<FailureKind, number> = {
	quota: 60 * 60_000,
	rate_limit: 5 * 60_000,
	auth: 15 * 60_000,
	connection: 0,
	tls: 0,
	rejected: 0,
	unknown: 0
};

const FAILURE_MESSAGES: Record<FailureKind, string> = {
	quota: 'Gmail daily sending quota reached. Sending is paused for an hour.',
	rate_limit: 'Gmail is rate limiting this account. Sending is paused for a few minutes.',
	auth: 'Gmail rejected the login. Check GMAIL_USER and GMAIL_APP_PASSWORD.',
	connection: 'Could not connect to Gmail’s mail server (smtp.gmail.com:465).',
	tls: 'The secure connection to Gmail was intercepted on this machine, usually by antivirus email scanning or a proxy.',
	rejected: 'Gmail refused the message. Check NOTIFICATION_EMAIL_TO.',
	unknown: 'Sending failed with an unexpected error.'
};

/** Error code and SMTP status only: safe to show, never includes credentials or addresses. */
function errorReference(err: SmtpError): string {
	const parts = [err.code, err.originalCode, err.responseCode && `SMTP ${err.responseCode}`].filter(
		Boolean
	);
	return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

let pausedUntil = 0;
let pauseReason: FailureKind | null = null;
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
	transporter ??= createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
		// Bound the time a serverless invocation can spend on a slow SMTP handshake.
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 20_000
	});
	return transporter;
}

/** Sends the notification for a recorded click. Never throws; failures are logged. */
export async function sendCtaClickNotification(click: CtaClickEmailDetails): Promise<void> {
	await deliver(click, `click ${click.id}`);
}

/** Sends a sample notification to the configured recipients. Never throws. */
export async function sendTestEmail(): Promise<DeliveryResult> {
	return deliver(
		{
			id: crypto.randomUUID(),
			site: null,
			eventType: 'cta_click',
			buttonType: 'call',
			buttonText: 'Call Now',
			formName: null,
			pageUrl: 'https://www.example.com/sample-page/',
			siteName: 'Sample website',
			city: 'Austin',
			state: 'TX',
			clickedAt: new Date(),
			country: 'US',
			userAgent: 'Sample user agent (test email)',
			ctaPlacement: 'header',
			sourceCtaType: null,
			sourceCtaText: null,
			sourceCtaPlacement: null,
			utmSource: 'google',
			utmMedium: 'cpc',
			utmCampaign: 'sample-campaign',
			utmTerm: null,
			utmContent: null,
			gclid: 'sample-gclid',
			gbraid: null,
			wbraid: null,
			fbclid: null
		},
		'test email',
		{ test: true }
	);
}

async function deliver(
	click: CtaClickEmailDetails,
	label: string,
	options: { test?: boolean } = {}
): Promise<DeliveryResult> {
	if (Date.now() < pausedUntil && pauseReason) {
		const until = new Date(pausedUntil).toISOString();
		console.warn(`[cta-email] Skipped ${label}: sending paused (${pauseReason}) until ${until}`);
		return {
			ok: false,
			kind: 'paused',
			message: `${FAILURE_MESSAGES[pauseReason]} Paused until ${until}.`
		};
	}

	const { subject, html, text } = renderCtaClickEmail(click, options);
	const send = () =>
		getTransporter().sendMail({
			from: { name: 'CTA Tracking', address: GMAIL_USER },
			to: NOTIFICATION_EMAIL_TO,
			subject,
			html,
			text
		});

	try {
		try {
			await send();
		} catch (error) {
			if (classify(error as SmtpError) !== 'connection') throw error;
			// A connection-level failure can stick to a long-lived process (seen in local dev);
			// retry once on a freshly created transporter before reporting it.
			console.warn(`[cta-email] Connection failed for ${label}, retrying once`, {
				code: (error as SmtpError).code,
				originalCode: (error as SmtpError).originalCode
			});
			transporter = undefined;
			await send();
		}
		return { ok: true, recipients: NOTIFICATION_EMAIL_TO };
	} catch (error) {
		const err = error as SmtpError;
		const kind = classify(err);
		if (kind === 'connection' || kind === 'tls') transporter = undefined;

		if (COOLDOWN_MS[kind] > 0) {
			pausedUntil = Date.now() + COOLDOWN_MS[kind];
			pauseReason = kind;
		}

		console.error(`[cta-email] Failed to send ${label} (${kind})`, {
			code: err.code,
			responseCode: err.responseCode,
			command: err.command,
			originalCode: err.originalCode,
			response: err.response,
			message: err.message
		});
		return { ok: false, kind, message: `${FAILURE_MESSAGES[kind]}${errorReference(err)}` };
	}
}

// Gmail SMTP replies: 550 5.4.5 daily sending quota exceeded; 421/454 4.7.x temporary
// rate limiting or too many login attempts; 535 5.7.8 bad credentials or app password revoked.
function classify(err: SmtpError): FailureKind {
	const response = err.response ?? '';
	if (response.includes('5.4.5') || /quota/i.test(response)) return 'quota';
	if (err.code === 'EAUTH' || err.responseCode === 535 || err.responseCode === 534) return 'auth';
	if (
		err.responseCode === 421 ||
		err.responseCode === 454 ||
		response.includes('4.7.') ||
		/rate|too many/i.test(response)
	) {
		return 'rate_limit';
	}
	if (err.originalCode && TLS_CERT_CODES.has(err.originalCode)) return 'tls';
	if (err.code && CONNECTION_CODES.has(err.code)) return 'connection';
	if (err.code === 'EENVELOPE' || err.code === 'EMESSAGE' || (err.responseCode ?? 0) >= 500) {
		return 'rejected';
	}
	return 'unknown';
}
