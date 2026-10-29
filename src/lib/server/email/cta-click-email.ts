import type { CtaClick } from '../db/schema.ts';

export type CtaClickEmailDetails = Pick<
	CtaClick,
	'id' | 'pageUrl' | 'city' | 'state' | 'clickedAt'
> & {
	country: string | null;
	userAgent: string | null;
};

type Row = { label: string; value: string; href?: string; mono?: boolean };

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const NOT_AVAILABLE = 'Not available';

const utcFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: 'UTC',
	weekday: 'short',
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false
});

export function renderCtaClickEmail(click: CtaClickEmailDetails, { test = false } = {}) {
	const url = new URL(click.pageUrl);
	const path = decodeSafe(url.pathname + url.search) || '/';
	const location = [click.city, click.state].filter(Boolean).join(', ');
	const clickedAtUtc = `${utcFormatter.format(click.clickedAt)} UTC`;
	const heading = test ? 'Test notification' : 'New CTA click recorded';
	const footnote = test
		? 'This is a test email sent from the dashboard. The details above are sample data; no click was recorded.'
		: "Location comes from your website or, when it isn't sent, from the visitor's IP address, so it may be approximate.";

	const subject = singleLine(
		`${test ? '[Test] ' : ''}New CTA click: ${path}${location ? ` · ${location}` : ''}`
	);

	const rows: Row[] = [
		{ label: 'Page URL', value: click.pageUrl, href: click.pageUrl },
		{ label: 'Website', value: url.host },
		{ label: 'Page path', value: path },
		{ label: 'City', value: click.city ?? NOT_AVAILABLE },
		{ label: 'State / region', value: click.state ?? NOT_AVAILABLE },
		{ label: 'Country', value: click.country ?? NOT_AVAILABLE },
		{ label: 'Clicked at (UTC)', value: clickedAtUtc },
		{ label: 'ISO timestamp', value: click.clickedAt.toISOString(), mono: true },
		{ label: 'Event ID', value: click.id, mono: true },
		{ label: 'User agent', value: click.userAgent ?? NOT_AVAILABLE }
	];

	const preheader = `${location || 'Unknown location'} · ${clickedAtUtc}`;

	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f2f2;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f2f2;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #dcdcdc;">
<tr><td style="background-color:#111111;padding:28px 32px;">
<p style="margin:0 0 6px;font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a6a6a6;">CTA tracking</p>
<h1 style="margin:0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:#ffffff;">${heading}</h1>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
<p style="margin:0 0 4px;font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6b6b6b;">Clicked on</p>
<p style="margin:0 0 4px;font-family:${FONT};font-size:18px;line-height:1.4;font-weight:600;color:#111111;word-break:break-word;">${escapeHtml(path)}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:#4a4a4a;">${escapeHtml(location || 'Location not available')} &middot; ${escapeHtml(clickedAtUtc)}</p>
</td></tr>
<tr><td style="padding:20px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e6e6e6;">
${rows.map(renderRow).join('\n')}
</table>
</td></tr>
<tr><td style="padding:24px 32px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background-color:#111111;">
<a href="${escapeHtml(click.pageUrl)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open page &rarr;</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f7f7f7;border-top:1px solid #e6e6e6;padding:16px 32px;">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:#7a7a7a;">${escapeHtml(footnote)} Event ID <span style="font-family:${MONO};color:#4a4a4a;">${escapeHtml(click.id)}</span>.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

	const text = [heading, '', ...rows.map((row) => `${row.label}: ${row.value}`), '', footnote].join(
		'\n'
	);

	return { subject, html, text };
}

function renderRow(row: Row): string {
	const value = escapeHtml(row.value);
	const valueStyle = `font-family:${row.mono ? MONO : FONT};font-size:14px;line-height:1.5;color:#111111;word-break:break-word;`;
	const content = row.href
		? `<a href="${escapeHtml(row.href)}" style="color:#111111;text-decoration:underline;">${value}</a>`
		: value;

	return `<tr>
<td valign="top" width="150" style="padding:12px 16px 12px 0;border-bottom:1px solid #e6e6e6;font-family:${FONT};font-size:12px;line-height:1.5;letter-spacing:0.5px;text-transform:uppercase;color:#6b6b6b;">${escapeHtml(row.label)}</td>
<td valign="top" style="padding:12px 0;border-bottom:1px solid #e6e6e6;${valueStyle}">${content}</td>
</tr>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function singleLine(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').slice(0, 200);
}

function decodeSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
