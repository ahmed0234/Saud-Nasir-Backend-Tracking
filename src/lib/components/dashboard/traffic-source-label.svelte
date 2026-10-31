<script lang="ts">
	import { trafficSourceOf } from '#lib/lead-attribution.ts';
	import TrafficSourceBadge from './traffic-source-badge.svelte';

	// A row label in the "Lead sources" lists: the source badge and its channel.
	let { source, channel }: { source: string | null; channel: string | null } = $props();

	const traffic = $derived(trafficSourceOf({ trafficSource: source, trafficChannel: channel }));
</script>

<span class="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
	<TrafficSourceBadge {source} {channel} class="text-xs" />
	{#if !traffic}
		<span class="text-muted-foreground">older leads, or an old tracking snippet</span>
	{:else if traffic.channelLabel && traffic.channelLabel !== traffic.source}
		<span class="text-muted-foreground">{traffic.channelLabel}</span>
	{/if}
</span>
