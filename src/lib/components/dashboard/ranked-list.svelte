<script lang="ts" generics="T extends { key: string; clicks: number }">
	import { formatNumber, formatPercent } from '#lib/format.ts';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import type { Snippet } from 'svelte';
	import StateMessage from './state-message.svelte';

	let {
		title,
		description,
		items,
		total,
		label
	}: {
		title: string;
		description: string;
		items: T[];
		/** Clicks in the whole range, used for each row's share. */
		total: number;
		label: Snippet<[T]>;
	} = $props();

	const headingId = $props.id();
	const max = $derived(Math.max(1, ...items.map((item) => item.clicks)));
</script>

<section class="flex flex-col rounded-2xl glass" aria-labelledby={headingId}>
	<header class="space-y-1 px-5 pt-5 pb-3">
		<h2 id={headingId} class="font-medium">{title}</h2>
		<p class="text-sm text-muted-foreground">{description}</p>
	</header>

	{#if items.length === 0}
		<StateMessage
			icon={InboxIcon}
			title="No clicks in this range"
			description="Try a wider date range."
			class="py-10"
		/>
	{:else}
		<ol class="flex flex-col gap-1 px-3 pb-4">
			{#each items as item, index (item.key)}
				<li
					class="group relative rounded-lg px-2 py-2 transition-colors hover:bg-foreground/[0.04]"
				>
					<div class="flex items-start gap-3">
						<span class="w-5 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums"
							>{index + 1}</span
						>
						<div class="min-w-0 flex-1 space-y-2">
							<div class="flex items-baseline justify-between gap-3">
								<div class="min-w-0 text-sm">{@render label(item)}</div>
								<div class="shrink-0 text-right text-sm tabular-nums">
									<span class="font-medium">{formatNumber(item.clicks)}</span>
									<span class="ml-1.5 text-xs text-muted-foreground"
										>{formatPercent(total === 0 ? 0 : item.clicks / total)}</span
									>
								</div>
							</div>
							<div class="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
								<div
									class="h-full rounded-full bg-foreground/70 transition-[width] duration-500 ease-out"
									style:width={`${(item.clicks / max) * 100}%`}
								></div>
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</section>
