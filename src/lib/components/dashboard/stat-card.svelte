<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { Component, Snippet } from 'svelte';

	let {
		label,
		value,
		icon: Icon,
		hint,
		class: className
	}: {
		label: string;
		value: string;
		icon: Component<{ class?: string }>;
		hint?: Snippet;
		class?: string;
	} = $props();
</script>

<div
	class={cn(
		'group relative flex flex-col gap-4 overflow-hidden rounded-2xl glass p-5 transition-colors hover:bg-card/70',
		className
	)}
>
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm font-medium text-muted-foreground">{label}</p>
		<span
			class="grid size-8 place-items-center rounded-lg bg-foreground/5 text-muted-foreground ring-1 ring-foreground/10 transition-colors group-hover:text-foreground"
		>
			<Icon class="size-4" />
		</span>
	</div>
	<p class="text-3xl font-semibold tracking-tight">{value}</p>
	{#if hint}
		<p class="text-xs text-muted-foreground">{@render hint()}</p>
	{/if}
</div>
