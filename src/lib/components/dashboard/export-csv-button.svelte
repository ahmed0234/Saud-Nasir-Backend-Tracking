<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatNumber } from '#lib/format.ts';
	import { SITE_URL_PARAM } from '#lib/sites.ts';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';

	// Downloads /analytics/export as a CSV file. Fetched (rather than a plain link) so the button
	// can show progress and report how many leads were exported, or why it failed.
	let {
		start,
		end,
		site,
		disabled = false
	}: {
		/** The [start, end) instants shown on the page (UTC ISO). */
		start: string;
		end: string;
		site: string | null;
		disabled?: boolean;
	} = $props();

	let status = $state<'idle' | 'exporting' | 'done'>('idle');
	let doneTimer: ReturnType<typeof setTimeout> | undefined;

	async function exportCsv() {
		if (status === 'exporting') return;
		status = 'exporting';
		const params = new URLSearchParams(
			site ? { start, end, [SITE_URL_PARAM]: site } : { start, end }
		);

		try {
			const response = await fetch(resolve(`analytics/export?${params}`));
			const type = response.headers.get('content-type') ?? '';
			if (!response.ok || !type.startsWith('text/csv')) {
				throw new Error(
					response.status === 401 || type.startsWith('text/html')
						? 'Your session has expired. Sign in again and retry.'
						: (await response.text()) || `Server responded with ${response.status}.`
				);
			}

			const filename =
				/filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
				'leads.csv';
			const count = Number(response.headers.get('x-lead-count') ?? 0);
			const href = URL.createObjectURL(await response.blob());
			const link = Object.assign(document.createElement('a'), { href, download: filename });
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(href), 10_000);

			toast.success('CSV exported', {
				description: `${formatNumber(count)} ${count === 1 ? 'lead' : 'leads'} saved to ${filename}.`
			});
			status = 'done';
			clearTimeout(doneTimer);
			doneTimer = setTimeout(() => (status = 'idle'), 1800);
		} catch (error) {
			status = 'idle';
			toast.error('Export failed', {
				description: error instanceof Error ? error.message : 'Please try again.'
			});
		}
	}
</script>

<Button
	onclick={exportCsv}
	disabled={disabled || status === 'exporting'}
	aria-busy={status === 'exporting'}
	title="Download every lead in the selected period as a CSV file"
	class="bg-emerald-700 text-white shadow-lg ring-1 shadow-emerald-700/25 ring-emerald-500/40 hover:bg-emerald-600 hover:shadow-emerald-600/30 focus-visible:ring-emerald-400/50 dark:bg-emerald-500 dark:text-emerald-950 dark:shadow-emerald-500/20 dark:ring-emerald-300/40 dark:hover:bg-emerald-400"
>
	{#if status === 'exporting'}
		<Loader2Icon class="animate-spin" />
		Exporting…
	{:else if status === 'done'}
		<CheckIcon class="animate-in duration-300 zoom-in-50" />
		Exported
	{:else}
		<FileDownIcon />
		Export CSV
	{/if}
</Button>
