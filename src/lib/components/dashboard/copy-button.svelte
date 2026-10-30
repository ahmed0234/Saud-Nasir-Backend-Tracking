<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { toast } from 'svelte-sonner';

	// Copies `text` (or what `load` returns) to the clipboard and confirms it in place.
	let {
		text,
		load,
		label = 'Copy',
		class: className
	}: {
		text?: string;
		/** For large text fetched on demand; called on click. */
		load?: () => Promise<string>;
		label?: string;
		class?: string;
	} = $props();

	let status = $state<'idle' | 'loading' | 'copied'>('idle');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		if (status === 'loading') return;
		try {
			if (load) {
				status = 'loading';
				// Safari only allows clipboard writes during the click; ClipboardItem accepts a promise.
				if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
					const blob = load().then((value) => new Blob([value], { type: 'text/plain' }));
					await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
				} else {
					await navigator.clipboard.writeText(await load());
				}
			} else {
				await navigator.clipboard.writeText(text ?? '');
			}
			status = 'copied';
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (status = 'idle'), 1800);
		} catch (error) {
			status = 'idle';
			toast.error('Couldn’t copy', {
				description:
					error instanceof Error && error.name === 'NotAllowedError'
						? 'Your browser blocked clipboard access. Select the code and copy it manually.'
						: 'Please try again.'
			});
		}
	}
</script>

<Button
	type="button"
	variant="outline"
	size="sm"
	onclick={copy}
	aria-live="polite"
	class={cn(
		'min-w-[5.5rem] transition-colors',
		status === 'copied' &&
			'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300',
		className
	)}
>
	{#if status === 'loading'}
		<Loader2Icon class="animate-spin" />
		Copying…
	{:else if status === 'copied'}
		<CheckIcon class="animate-in duration-200 zoom-in-50" />
		Copied
	{:else}
		<CopyIcon />
		{label}
	{/if}
</Button>
