<script lang="ts">
	import { cn } from '#lib/utils.js';
	import PanelTopIcon from '@lucide/svelte/icons/panel-top';

	// Marks a lead that came from a CTA in the website's header (or mobile menu).
	let { class: className }: { class?: string } = $props();
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300',
		className
	)}
	title="This lead came from a CTA in the website header or mobile menu"
>
	<PanelTopIcon class="size-3" />
	Header CTA
</span>
