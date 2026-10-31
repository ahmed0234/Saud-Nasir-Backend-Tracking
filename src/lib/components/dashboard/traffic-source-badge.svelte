<script lang="ts">
	import { trafficSourceOf } from '#lib/lead-attribution.ts';
	import { SOURCE_NOT_RECORDED, type TrafficChannel } from '#lib/traffic-source.ts';
	import { cn } from '#lib/utils.js';

	// Where a lead's visitor came from ("Google Ads", "ChatGPT", "Direct"), coloured by channel.
	let {
		source,
		channel,
		title,
		class: className
	}: {
		source: string | null;
		channel: string | null;
		title?: string;
		class?: string;
	} = $props();

	const DOTS: Record<TrafficChannel, string> = {
		paid: 'bg-amber-500',
		search: 'bg-sky-500',
		social: 'bg-violet-500',
		ai: 'bg-emerald-500',
		email: 'bg-rose-500',
		referral: 'bg-teal-500',
		campaign: 'bg-indigo-500',
		direct: 'bg-muted-foreground'
	};

	const traffic = $derived(trafficSourceOf({ trafficSource: source, trafficChannel: channel }));
	const isPaid = $derived(traffic?.channel === 'paid');
</script>

<span
	class={cn(
		'inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
		isPaid
			? 'bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-200'
			: 'bg-foreground/[0.06] text-foreground/80 ring-foreground/10',
		className
	)}
	title={title ??
		(traffic?.channelLabel ? `Source: ${traffic.source} · ${traffic.channelLabel}` : undefined)}
>
	<span
		class={cn(
			'size-1.5 shrink-0 rounded-full',
			traffic?.channel ? DOTS[traffic.channel] : 'bg-muted-foreground/50'
		)}
	></span>
	<span class="truncate">{traffic?.source ?? SOURCE_NOT_RECORDED}</span>
</span>
