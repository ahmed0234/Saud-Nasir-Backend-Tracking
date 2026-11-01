<script lang="ts">
	import { trafficSourceOf } from '#lib/lead-attribution.ts';
	import { LEAD_SOURCE_LABELS, leadSourceOf } from '#lib/traffic-source.ts';
	import { cn } from '#lib/utils.js';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LeadSourceIcon from './lead-source-icon.svelte';
	import { LEAD_SOURCE_STYLES } from './lead-source-style.ts';

	// Where a lead came from: one of the six lead sources (Organic, Yelp, Instagram, Facebook,
	// Google Business Profile, AI) in its own colours, with the detail ("Google search", "Direct
	// visit", "ChatGPT", "Ad") after it. A known source outside the six (Google Ads, an email, another
	// website) gets a neutral badge with its own name; a lead without source data renders nothing.
	let {
		source,
		channel,
		title,
		showDetail = true,
		class: className
	}: {
		source: string | null;
		channel: string | null;
		title?: string;
		showDetail?: boolean;
		class?: string;
	} = $props();

	const match = $derived(leadSourceOf(source, channel));
	const traffic = $derived(trafficSourceOf({ trafficSource: source, trafficChannel: channel }));
	const label = $derived(match ? LEAD_SOURCE_LABELS[match.key] : traffic?.source);
	const detail = $derived(showDetail ? (match ? match.detail : traffic?.channelLabel) : null);
	const tooltip = $derived(
		title ?? (label ? `Lead source: ${label}${detail ? ` · ${detail}` : ''}` : undefined)
	);
</script>

{#if match}
	<span
		class={cn(
			'inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5 text-[11px] font-medium ring-1',
			LEAD_SOURCE_STYLES[match.key].chip,
			className
		)}
		title={tooltip}
	>
		<span
			class={cn(
				'grid size-4 shrink-0 place-items-center rounded-full shadow-sm',
				LEAD_SOURCE_STYLES[match.key].tile
			)}
		>
			<LeadSourceIcon source={match.key} class="size-2.5" />
		</span>
		<span class="truncate">{label}</span>
		{#if detail}
			<span class="truncate font-normal opacity-70">{detail}</span>
		{/if}
	</span>
{:else if traffic}
	<span
		class={cn(
			'inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5 text-[11px] font-medium text-foreground/75 ring-1 ring-foreground/10',
			'bg-foreground/[0.05]',
			className
		)}
		title={tooltip}
	>
		<span
			class="grid size-4 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground/70"
		>
			<GlobeIcon class="size-2.5" strokeWidth={2.5} aria-hidden="true" />
		</span>
		<span class="truncate">{label}</span>
	</span>
{/if}
