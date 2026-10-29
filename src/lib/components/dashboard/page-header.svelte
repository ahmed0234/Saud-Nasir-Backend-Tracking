<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, description, actions }: { title: string; description: string; actions?: Snippet } =
		$props();
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
	<div class="space-y-1.5">
		<h1 class="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
		<p class="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">{description}</p>
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</div>
