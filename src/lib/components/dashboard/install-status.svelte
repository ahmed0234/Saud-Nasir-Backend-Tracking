<script lang="ts">
	import { formatDateTime, formatRelative } from '#lib/format.ts';
	import type { Website } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import { onMount } from 'svelte';

	// Whether a website's tracking script has reported in: disabled, waiting or active.
	let {
		website,
		timeZone,
		class: className
	}: { website: Website; timeZone?: string; class?: string } = $props();

	// "Last seen 3 minutes ago" keeps itself current while the page stays open.
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const status = $derived(
		website.disabled ? 'disabled' : website.lastSeenAt ? 'active' : 'waiting'
	);
	const title = $derived(
		website.lastSeenAt
			? `Last seen ${formatDateTime(website.lastSeenAt, timeZone ?? 'UTC')}${website.lastSeenUrl ? ` on ${website.lastSeenUrl}` : ''}`
			: undefined
	);
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
		status === 'active' &&
			'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
		status === 'waiting' && 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
		status === 'disabled' && 'bg-foreground/[0.05] text-muted-foreground ring-foreground/10',
		className
	)}
	{title}
>
	<span class="relative flex size-1.5">
		{#if status === 'waiting'}
			<span
				class="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:animate-none"
			></span>
		{/if}
		<span
			class={cn(
				'relative inline-flex size-1.5 rounded-full',
				status === 'active' && 'bg-emerald-500',
				status === 'waiting' && 'bg-amber-500',
				status === 'disabled' && 'bg-muted-foreground'
			)}
		></span>
	</span>
	{#if status === 'disabled'}
		Disabled
	{:else if status === 'waiting'}
		Waiting for installation
	{:else if website.lastSeenAt}
		Active · seen {formatRelative(website.lastSeenAt, now)}
	{/if}
</span>
