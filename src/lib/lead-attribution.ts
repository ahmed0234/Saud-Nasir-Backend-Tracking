import {
	buttonTypeLabel,
	CAMPAIGN_FIELDS,
	CTA_PLACEMENT_LABELS,
	isCtaPlacement,
	type Campaign
} from './sites.ts';
import {
	isTrafficChannel,
	SOURCE_NOT_RECORDED,
	TRAFFIC_CHANNEL_LABELS,
	type TrafficChannel
} from './traffic-source.ts';

// Human-readable attribution for a lead, shared by the dashboard, the CSV export and the email.

export type LeadAttribution = Campaign & {
	eventType: string;
	ctaPlacement: string | null;
	sourceCtaType: string | null;
	sourceCtaText: string | null;
	sourceCtaPlacement: string | null;
};

export function placementLabel(value: string | null): string | null {
	return isCtaPlacement(value) ? CTA_PLACEMENT_LABELS[value] : null;
}

/**
 * Where the lead came from: the clicked CTA's location for a CTA click, the credited CTA's
 * location for a form submission, or null when unknown (older leads, forms with no CTA before).
 */
export function leadOrigin(lead: LeadAttribution): string | null {
	return placementLabel(
		lead.eventType === 'form_submit' ? lead.sourceCtaPlacement : lead.ctaPlacement
	);
}

/** The CTA a form submission is credited to, e.g. `"Book Now" (Header CTA)`, or null. */
export function sourceCtaSummary(lead: LeadAttribution): string | null {
	if (lead.eventType !== 'form_submit') return null;
	const name = lead.sourceCtaText ? `“${lead.sourceCtaText}”` : buttonTypeLabel(lead.sourceCtaType);
	const where = placementLabel(lead.sourceCtaPlacement);
	if (!name && !where) return null;
	return [name ?? 'CTA', where && `(${where})`].filter(Boolean).join(' ');
}

/** UTM source / medium and campaign, e.g. "google / cpc · spring-sale", or null. */
export function campaignSummary(campaign: Campaign): string | null {
	const sourceMedium = [campaign.utmSource, campaign.utmMedium].filter(Boolean).join(' / ');
	return [sourceMedium, campaign.utmCampaign].filter(Boolean).join(' · ') || null;
}

export type LeadTraffic = {
	trafficSource: string | null;
	trafficChannel: string | null;
	referrer?: string | null;
	landingPageUrl?: string | null;
};

/** The lead's traffic source and channel, e.g. { source: "Google Ads", channel: "paid" }, or null. */
export function trafficSourceOf(
	lead: Pick<LeadTraffic, 'trafficSource' | 'trafficChannel'>
): { source: string; channel: TrafficChannel | null; channelLabel: string | null } | null {
	if (!lead.trafficSource) return null;
	const channel = isTrafficChannel(lead.trafficChannel) ? lead.trafficChannel : null;
	return {
		source: lead.trafficSource,
		channel,
		channelLabel: channel ? TRAFFIC_CHANNEL_LABELS[channel] : null
	};
}

/** "Google Ads (Paid ads)", or "Not recorded" for leads without a source. */
export function trafficSourceSummary(lead: LeadTraffic): string {
	const traffic = trafficSourceOf(lead);
	if (!traffic) return SOURCE_NOT_RECORDED;
	return traffic.channelLabel && traffic.channelLabel !== traffic.source
		? `${traffic.source} (${traffic.channelLabel})`
		: traffic.source;
}

/** Every campaign value present, labelled (for tooltips and emails). */
export function campaignDetails(campaign: Campaign): { label: string; value: string }[] {
	return CAMPAIGN_FIELDS.flatMap(({ key, label }) => {
		const value = campaign[key];
		return value ? [{ label, value }] : [];
	});
}
