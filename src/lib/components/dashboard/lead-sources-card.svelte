<script lang="ts">
	import { formatNumber, formatPercent } from '#lib/format.ts';
	import type { SourceBreakdown } from '#lib/server/analytics.ts';
	import { LEAD_SOURCE_DESCRIPTIONS, LEAD_SOURCE_LABELS } from '#lib/traffic-source.ts';
	import { cn } from '#lib/utils.js';
	import LeadSourceIcon from './lead-source-icon.svelte';
	import { LEAD_SOURCE_STYLES } from './lead-source-style.ts';

	// "Lead sources": the six sources as a share bar and one row each, always all six in the same
	// colours as the lead badges. Shares are of all leads, so the six add up to the total.
	let {
		breakdown,
		description,
		class: className
	}: { breakdown: SourceBreakdown; description: string; class?: string } = $props();

	const headingId = $props.id();
	const max = $derived(Math.max(1, ...breakdown.items.map((item) => item.leads)));
	const shareOf = (leads: number) => (breakdown.total === 0 ? 0 : leads / breakdown.total);
	const segments = $derived(breakdown.items.filter((item) => item.leads > 0));

	const HINTS = {
		organic: 'Search & direct visits',
		yelp: 'Yelp listing & app',
		instagram: 'Profile, posts & stories',
		facebook: 'Page, posts & Messenger',
		google_business_profile: 'Maps & local listing',
		ai: 'ChatGPT & AI assistants'
	} as const;

	// "Google search 12 · Direct visit 30"; nothing when the only split is plain organic.
	function detailLine(details: SourceBreakdown['items'][number]['details']): string | null {
		if (details.length === 0 || (details.length === 1 && details[0].label === 'Organic')) {
			return null;
		}
		return details.map((detail) => `${detail.label} ${formatNumber(detail.leads)}`).join(' · ');
	}
</script>

<section
	class={cn('@container flex flex-col rounded-2xl glass', className)}
	aria-labelledby={headingId}
>
	<header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-5 pt-5 pb-4">
		<div class="space-y-1">
			<h2 id={headingId} class="font-medium">Lead sources</h2>
			<p class="text-sm text-muted-foreground">{description}</p>
		</div>
		<p class="text-sm text-muted-foreground tabular-nums">
			<span class="font-medium text-foreground">{formatNumber(breakdown.total)}</span>
			{breakdown.total === 1 ? 'lead' : 'leads'}
		</p>
	</header>

	<div class="px-5">
		<div
			class="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-foreground/[0.06]"
			role="img"
			aria-label={segments.length
				? segments
						.map((item) => `${LEAD_SOURCE_LABELS[item.key]} ${formatPercent(shareOf(item.leads))}`)
						.join(', ')
				: 'No leads yet'}
		>
			{#each segments as item (item.key)}
				<div
					class={cn(
						'h-full transition-[flex-grow] duration-500 ease-out first:rounded-l-full last:rounded-r-full',
						LEAD_SOURCE_STYLES[item.key].bar
					)}
					style:flex-grow={item.leads}
					title={`${LEAD_SOURCE_LABELS[item.key]}: ${formatNumber(item.leads)} (${formatPercent(shareOf(item.leads))})`}
				></div>
			{/each}
		</div>
	</div>

	<ol class="grid gap-1 px-3 pt-3 pb-3 @2xl:grid-cols-2 @2xl:gap-x-4">
		{#each breakdown.items as item (item.key)}
			{@const details = detailLine(item.details)}
			<li
				class={cn(
					'rounded-xl px-2 py-2.5 transition-[background-color,opacity] hover:bg-foreground/[0.04]',
					item.leads === 0 && 'opacity-55'
				)}
				title={LEAD_SOURCE_DESCRIPTIONS[item.key]}
			>
				<div class="flex items-center gap-3">
					<span
						class={cn(
							'grid size-9 shrink-0 place-items-center rounded-xl shadow-sm ring-1 ring-black/5',
							LEAD_SOURCE_STYLES[item.key].tile
						)}
					>
						<LeadSourceIcon source={item.key} class="size-4" />
					</span>
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex items-baseline justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium">{LEAD_SOURCE_LABELS[item.key]}</p>
								<p class="truncate text-xs text-muted-foreground">
									{details ?? HINTS[item.key]}
								</p>
							</div>
							<div class="shrink-0 text-right tabular-nums">
								<span class="text-sm font-semibold">{formatNumber(item.leads)}</span>
								<span class="ml-1 text-xs text-muted-foreground"
									>{formatPercent(shareOf(item.leads))}</span
								>
							</div>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
							<div
								class={cn(
									'h-full rounded-full transition-[width] duration-500 ease-out',
									LEAD_SOURCE_STYLES[item.key].bar
								)}
								style:width={`${(item.leads / max) * 100}%`}
							></div>
						</div>
					</div>
				</div>
			</li>
		{/each}
	</ol>
</section>
