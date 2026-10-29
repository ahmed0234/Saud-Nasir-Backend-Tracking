<script lang="ts">
	import { getSite, SITES } from '#lib/sites.ts';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';

	let { siteId }: { siteId: string | null } = $props();

	const site = $derived(getSite(siteId));
</script>

{#if site}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- external WordPress site -->
	<a
		href={site.url}
		target="_blank"
		rel="noopener noreferrer"
		class="group/site inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] py-0.5 pr-2 pl-1.5 ring-1 ring-foreground/10 transition-colors hover:text-foreground"
	>
		<span class="size-2 rounded-full" style:background-color={site.accent}></span>
		{new URL(site.url).host}
		<ArrowUpRightIcon class="size-3 opacity-60 transition-opacity group-hover/site:opacity-100" />
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<span
		class="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] py-0.5 pr-2 pl-1.5 ring-1 ring-foreground/10"
	>
		<span class="flex -space-x-1" aria-hidden="true">
			{#each SITES as item (item.id)}
				<span
					class="size-2 rounded-full ring-1 ring-background"
					style:background-color={item.accent}
				></span>
			{/each}
		</span>
		{SITES.length} websites
	</span>
{/if}
