<script lang="ts">
	import { buttonVariants, Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { MAX_CUSTOM_DAYS, PRESETS, type RangeKey } from '#lib/date-range.ts';
	import { SITE_URL_PARAM } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let {
		range,
		today,
		site,
		disabled = false
	}: {
		range: { key: RangeKey; from: string; to: string };
		/** Viewer's local date (YYYY-MM-DD), the latest selectable day. */
		today: string;
		/** Selected website, kept when the range changes. */
		site: string | null;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let from = $state('');
	let to = $state('');
	let customError = $state<string | null>(null);

	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
	const customLabel = $derived(
		range.key === 'custom'
			? `${formatter.format(new Date(range.from))} – ${formatter.format(new Date(range.to))}`
			: 'Custom'
	);

	function navigate(params: Record<string, string>) {
		const query = new URLSearchParams(site ? { [SITE_URL_PARAM]: site, ...params } : params);
		goto(resolve(`/(app)/analytics?${query}`), { reset: false });
	}

	function onOpenChange(next: boolean) {
		if (next) {
			from = range.from;
			to = range.to;
			customError = null;
		}
	}

	function applyCustom(event: SubmitEvent) {
		event.preventDefault();
		if (!from || !to) {
			customError = 'Choose a start and end date.';
		} else if (from > to) {
			customError = 'The start date must be on or before the end date.';
		} else if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= MAX_CUSTOM_DAYS) {
			customError = `Choose a range of at most ${MAX_CUSTOM_DAYS} days.`;
		} else {
			open = false;
			navigate({ range: 'custom', from, to });
		}
	}
</script>

<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
	<ToggleGroup.Root
		type="single"
		variant="outline"
		value={range.key === 'custom' ? '' : range.key}
		onValueChange={(value) => value && navigate({ range: value })}
		{disabled}
		class="rounded-lg glass"
	>
		{#each PRESETS as preset (preset.key)}
			<ToggleGroup.Item
				value={preset.key}
				aria-label={preset.label}
				title={preset.label}
				class="px-3 data-[state=on]:bg-foreground data-[state=on]:text-background"
			>
				{preset.short}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	<Popover.Root bind:open {onOpenChange}>
		<Popover.Trigger
			{disabled}
			class={cn(
				buttonVariants({ variant: 'outline' }),
				'glass',
				range.key === 'custom' && 'bg-foreground text-background hover:bg-foreground/90'
			)}
		>
			<CalendarRangeIcon />
			{customLabel}
		</Popover.Trigger>
		<Popover.Content align="end" class="w-80">
			<form class="grid gap-4" onsubmit={applyCustom} novalidate>
				<div class="space-y-1">
					<p class="font-medium">Custom range</p>
					<p class="text-xs text-muted-foreground">Whole days in your local time zone.</p>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="grid gap-1.5">
						<Label for="range-from">From</Label>
						<Input id="range-from" type="date" bind:value={from} max={to || today} required />
					</div>
					<div class="grid gap-1.5">
						<Label for="range-to">To</Label>
						<Input id="range-to" type="date" bind:value={to} min={from} max={today} required />
					</div>
				</div>
				{#if customError}
					<p class="text-xs text-destructive" role="alert">{customError}</p>
				{/if}
				<Button type="submit">Apply range</Button>
			</form>
		</Popover.Content>
	</Popover.Root>
</div>
