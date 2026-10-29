<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { Component, Snippet } from 'svelte';

	let {
		icon: Icon,
		title,
		description,
		tone = 'neutral',
		action,
		class: className
	}: {
		icon: Component<{ class?: string }>;
		title: string;
		description: string;
		tone?: 'neutral' | 'error';
		action?: Snippet;
		class?: string;
	} = $props();
</script>

<div
	role={tone === 'error' ? 'alert' : 'status'}
	class={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
>
	<span
		class={cn(
			'grid size-11 place-items-center rounded-xl ring-1',
			tone === 'error'
				? 'bg-destructive/10 text-destructive ring-destructive/20'
				: 'bg-foreground/5 text-muted-foreground ring-foreground/10'
		)}
	>
		<Icon class="size-5" />
	</span>
	<div class="space-y-1">
		<p class="font-medium">{title}</p>
		<p class="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
	</div>
	{#if action}
		<div class="pt-1">{@render action()}</div>
	{/if}
</div>
