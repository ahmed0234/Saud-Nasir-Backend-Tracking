<script lang="ts">
	import ClicksAreaChart from '#lib/components/dashboard/clicks-area-chart.svelte';
	import ClicksBarChart from '#lib/components/dashboard/clicks-bar-chart.svelte';
	import ConfirmDeleteDialog from '#lib/components/dashboard/confirm-delete-dialog.svelte';
	import DateRangeFilter from '#lib/components/dashboard/date-range-filter.svelte';
	import { showDeleted } from '#lib/components/dashboard/deleted-pop.svelte';
	import ExportCsvButton from '#lib/components/dashboard/export-csv-button.svelte';
	import HeaderCtaBadge from '#lib/components/dashboard/header-cta-badge.svelte';
	import { placementLabel } from '#lib/lead-attribution.ts';
	import PageHeader from '#lib/components/dashboard/page-header.svelte';
	import RankedList from '#lib/components/dashboard/ranked-list.svelte';
	import InstallStatus from '#lib/components/dashboard/install-status.svelte';
	import SiteBadge from '#lib/components/dashboard/site-badge.svelte';
	import StatCard from '#lib/components/dashboard/stat-card.svelte';
	import StateMessage from '#lib/components/dashboard/state-message.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { PRESETS, toLocalIsoDate } from '#lib/date-range.ts';
	import { formatDateTime, formatNumber, formatPercent, splitUrl } from '#lib/format.ts';
	import { buttonTypeLabel, EVENT_TYPE_LABELS, findWebsite, isEventType } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ArrowDownRightIcon from '@lucide/svelte/icons/arrow-down-right';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import InfoIcon from '@lucide/svelte/icons/info';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ServerCrashIcon from '@lucide/svelte/icons/server-crash';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { refreshAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import type { ActionResult } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let refreshing = $state(false);
	const loading = $derived(refreshing || navigating.to?.route.id === '/(app)/analytics');

	const site = $derived(findWebsite(data.websites, data.site));
	const analytics = $derived(data.analytics);
	const eventLabel = (value: string) => (isEventType(value) ? EVENT_TYPE_LABELS[value] : value);
	const summary = $derived(analytics?.summary);
	const rangeLabel = $derived(
		data.range.key === 'custom'
			? 'the selected range'
			: (PRESETS.find((p) => p.key === data.range.key)?.label.toLowerCase() ?? '')
	);
	const rangeText = $derived(
		data.range.start && data.range.end
			? `${formatDateTime(data.range.start, data.timeZone)} – ${formatDateTime(data.range.end, data.timeZone)}`
			: ''
	);
	const delta = $derived.by(() => {
		if (!summary || summary.previousTotal === 0) return null;
		return (summary.total - summary.previousTotal) / summary.previousTotal;
	});

	// Deleting or exporting the range covers exactly the leads counted on screen: the range's start,
	// up to its end or the moment the page loaded, whichever is earlier (a range ending today
	// mustn't take leads that arrived after the numbers were shown).
	let deleteOpen = $state(false);
	const shownEnd = $derived(
		data.range.end && Date.parse(data.range.end) > Date.parse(data.loadedAt)
			? data.loadedAt
			: data.range.end
	);
	const deleteDescription = $derived.by(() => {
		if (!summary || !data.range.start || !shownEnd) return '';
		const leads = summary.total === 1 ? 'The 1 lead' : `All ${formatNumber(summary.total)} leads`;
		const source = site ? `from ${site.name}` : 'from all websites';
		let period: string;
		if (data.range.key === 'custom') {
			const from = dayFormatter.format(new Date(data.range.from));
			const to = dayFormatter.format(new Date(data.range.to));
			period = `${from === to ? `on ${from}` : `from ${from} through ${to}`} (whole days, ${data.timeZone})`;
		} else {
			period = `in the ${rangeLabel} (since ${formatDateTime(data.range.start, data.timeZone)}, ${data.timeZone})`;
		}
		return `${leads} ${source} ${period} will be permanently deleted from the database. This can't be undone.`;
	});
	// `from`/`to` are calendar dates (YYYY-MM-DD), so format them as UTC to keep the same day.
	const dayFormatter = new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	async function onDeleteResult(result: ActionResult) {
		deleteOpen = false;
		if (result.type === 'success') {
			const deleted = Number(result.data?.deleted ?? 0);
			if (deleted > 0) showDeleted(deleted);
			else toast.info('Nothing to delete', { description: 'There are no leads in this range.' });
			await refresh();
		} else {
			toast.error('Delete failed', {
				description:
					result.type === 'failure'
						? String(result.data?.message ?? 'Please try again.')
						: 'Unexpected server error. Nothing was deleted.'
			});
		}
	}

	async function refresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			await refreshAll();
		} finally {
			refreshing = false;
		}
	}
</script>

<svelte:head>
	<title>{site ? `${site.name} · ` : ''}Analytics · Lead Tracking</title>
</svelte:head>

<div class="space-y-8">
	<PageHeader
		title={site?.name ?? 'All websites'}
		description="Trends, lead types, locations and top pages for leads in the selected period."
	>
		{#snippet eyebrow()}
			<span class="font-medium tracking-wider uppercase">Analytics</span>
			<SiteBadge siteId={data.site} />
			{#if site}<InstallStatus website={site} timeZone={data.timeZone} />{/if}
		{/snippet}
		{#snippet actions()}
			<DateRangeFilter
				range={data.range}
				today={toLocalIsoDate(new Date(), data.timeZone)}
				site={data.site}
				disabled={loading}
			/>
			<Button
				variant="outline"
				size="icon"
				class="glass"
				onclick={refresh}
				disabled={loading}
				aria-label="Refresh analytics"
				title="Refresh"
			>
				<RefreshCwIcon class={cn(refreshing && 'animate-spin')} />
			</Button>
			{#if data.range.start && shownEnd}
				<ExportCsvButton
					start={data.range.start}
					end={shownEnd}
					site={data.site}
					disabled={loading || !summary || summary.total === 0}
				/>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
		{#if rangeText}<span>{rangeText} · {data.timeZone}</span>{/if}
		{#if loading}
			<span class="inline-flex items-center gap-1.5" role="status">
				<Loader2Icon class="size-3 animate-spin" /> Updating…
			</span>
		{/if}
		{#if summary && summary.total > 0 && deleteDescription}
			<Button
				variant="ghost"
				size="sm"
				class="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				onclick={() => (deleteOpen = true)}
				disabled={loading}
			>
				<Trash2Icon />
				Delete {formatNumber(summary.total)}
				{summary.total === 1 ? 'lead' : 'leads'} in this range
			</Button>
		{/if}
	</div>

	{#if data.notice}
		<div class="flex items-start gap-3 rounded-xl glass px-4 py-3 text-sm" role="status">
			<InfoIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<p>{data.notice}</p>
		</div>
	{/if}

	{#if data.error || !analytics || !summary}
		<div class="rounded-2xl glass">
			<StateMessage
				icon={ServerCrashIcon}
				tone="error"
				title="Analytics unavailable"
				description={`${data.error ?? 'Something went wrong.'} Check DATABASE_URL and that migrations have run.`}
			>
				{#snippet action()}
					<Button variant="outline" onclick={refresh} disabled={loading}>
						<RefreshCwIcon class={cn(refreshing && 'animate-spin')} />
						Try again
					</Button>
				{/snippet}
			</StateMessage>
		</div>
	{:else}
		<div
			class={cn('space-y-6 transition-opacity duration-300', loading && 'opacity-50')}
			aria-busy={loading}
			data-stagger
		>
			<div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-stagger>
				<StatCard label="Leads" value={formatNumber(summary.total)} icon={MousePointerClickIcon}>
					{#snippet hint()}
						{#if delta === null}
							No leads in the previous period
						{:else}
							<span class="inline-flex items-center gap-1">
								{#if delta > 0}<ArrowUpRightIcon
										class="size-3.5"
									/>{:else if delta < 0}<ArrowDownRightIcon class="size-3.5" />{:else}<MinusIcon
										class="size-3.5"
									/>{/if}
								<span class="font-medium text-foreground"
									>{delta > 0 ? '+' : ''}{formatPercent(delta)}</span
								>
								vs previous period
							</span>
						{/if}
					{/snippet}
				</StatCard>
				<StatCard
					label="Form submissions"
					value={formatNumber(summary.formSubmissions)}
					icon={ClipboardListIcon}
				>
					{#snippet hint()}{formatNumber(summary.ctaClicks)} CTA clicks in {rangeLabel}{/snippet}
				</StatCard>
				<StatCard
					label="Pages with leads"
					value={formatNumber(summary.uniquePages)}
					icon={FileTextIcon}
				>
					{#snippet hint()}Unique page URLs in {rangeLabel}{/snippet}
				</StatCard>
				<StatCard label="Locations" value={formatNumber(summary.uniqueLocations)} icon={MapPinIcon}>
					{#snippet hint()}Distinct city and state pairs · {formatPercent(summary.locatedShare)} of leads
						located{/snippet}
				</StatCard>
			</div>

			{#if summary.total === 0}
				<div class="rounded-2xl glass">
					<StateMessage
						icon={InboxIcon}
						title={site ? `No leads from ${site.name} in this period` : 'No leads in this period'}
						description="Choose a wider date range, or check back once the website records leads."
					/>
				</div>
			{:else}
				<div class="grid gap-6 lg:grid-cols-2" data-stagger>
					<section class="rounded-2xl glass p-5" aria-labelledby="timeline-heading">
						<header class="mb-4 space-y-1">
							<h2 id="timeline-heading" class="font-medium">Leads over time</h2>
							<p class="text-sm text-muted-foreground">
								{analytics.timeline.unit === 'hour' ? 'Hourly' : 'Daily'} leads in {rangeLabel}
							</p>
						</header>
						<ClicksAreaChart
							buckets={analytics.timeline.buckets}
							unit={analytics.timeline.unit}
							color={site?.accent}
							timeZone={data.timeZone}
						/>
					</section>
					<section class="rounded-2xl glass p-5" aria-labelledby="daily-heading">
						<header class="mb-4 space-y-1">
							<h2 id="daily-heading" class="font-medium">Leads by day</h2>
							<p class="text-sm text-muted-foreground">
								Total leads per calendar day ({data.timeZone})
							</p>
						</header>
						<ClicksBarChart
							buckets={analytics.daily}
							timeZone={data.timeZone}
							color={site?.accent}
						/>
					</section>
				</div>

				<div class="grid gap-6 lg:grid-cols-2" data-stagger>
					<RankedList
						title="Lead types"
						description="CTA clicks and form submissions by what was clicked"
						items={analytics.types.map((row) => ({
							...row,
							key: `${row.eventType}|${row.buttonType}`
						}))}
						total={summary.total}
					>
						{#snippet label(item)}
							<span class="font-medium">{buttonTypeLabel(item.buttonType) ?? 'Not recorded'}</span>
							<span class="text-muted-foreground"> · {eventLabel(item.eventType)}</span>
						{/snippet}
					</RankedList>
					<RankedList
						title="Top buttons"
						description="Most used CTA and form submit buttons, by label"
						items={analytics.buttons.map((row) => ({
							...row,
							key: `${row.eventType}|${row.label}`
						}))}
						total={summary.total}
					>
						{#snippet label(item)}
							<span class="font-medium">{item.label}</span>
							<span class="text-muted-foreground"> · {eventLabel(item.eventType)}</span>
						{/snippet}
					</RankedList>
				</div>

				<div class="grid gap-6 lg:grid-cols-2" data-stagger>
					<RankedList
						title="Lead origin"
						description="Where on the website the CTA behind each lead was"
						items={analytics.origins.map((row) => ({ ...row, key: row.placement ?? 'none' }))}
						total={summary.total}
					>
						{#snippet label(item)}
							{#if item.placement === 'header'}
								<HeaderCtaBadge class="text-xs" />
							{:else}
								<span class="font-medium">
									{placementLabel(item.placement) ?? 'No CTA recorded'}
								</span>
								{#if !item.placement}
									<span class="text-muted-foreground">
										· forms filled in directly, older leads</span
									>
								{/if}
							{/if}
						{/snippet}
					</RankedList>
					<RankedList
						title="Campaigns"
						description="UTM source / medium, or the ad network for auto-tagged ad clicks"
						items={analytics.campaigns.map((row) => ({ ...row, key: row.label }))}
						total={summary.total}
					>
						{#snippet label(item)}
							<span class="font-medium">{item.label}</span>
						{/snippet}
					</RankedList>
				</div>

				{#if !site}
					<RankedList
						title="Leads by website"
						description="Which website each lead came from"
						items={analytics.sites.map((row) => ({ ...row, key: row.site ?? 'other' }))}
						total={summary.total}
					>
						{#snippet label(item)}
							{@const itemSite = findWebsite(data.websites, item.site)}
							<span class="inline-flex items-center gap-2 font-medium">
								<span
									class="size-2 rounded-full"
									style:background-color={itemSite?.accent ?? 'var(--muted-foreground)'}
								></span>
								{itemSite?.name ?? 'Other domains'}
							</span>
						{/snippet}
					</RankedList>
				{/if}

				<div class="grid gap-6 lg:grid-cols-2" data-stagger>
					<RankedList
						title="Top cities"
						description="Where leads came from, by city and state"
						items={analytics.cities.map((row) => ({ ...row, key: `${row.label}|${row.detail}` }))}
						total={summary.total}
					>
						{#snippet label(item)}
							<span class="font-medium">{item.label}</span>
							{#if item.detail}<span class="text-muted-foreground">, {item.detail}</span>{/if}
						{/snippet}
					</RankedList>
					<RankedList
						title="Top states"
						description="Leads grouped by state or region"
						items={analytics.states.map((row) => ({ ...row, key: row.label }))}
						total={summary.total}
					>
						{#snippet label(item)}
							<span class="font-medium">{item.label}</span>
						{/snippet}
					</RankedList>
				</div>

				<RankedList
					title="Top pages"
					description="WordPress pages generating the most leads"
					items={analytics.pages.map((row) => ({ ...row, key: row.label }))}
					total={summary.total}
				>
					{#snippet label(item)}
						{@const url = splitUrl(item.label)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external WordPress page -->
						<a
							href={item.label}
							target="_blank"
							rel="noopener noreferrer"
							title={item.label}
							class="block min-w-0 hover:underline"
						>
							<span class="block truncate font-medium">{url.path}</span>
							<span class="block truncate text-xs text-muted-foreground">{url.host}</span>
						</a>
					{/snippet}
				</RankedList>
			{/if}
		</div>
	{/if}
</div>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	title={`Delete ${formatNumber(summary?.total ?? 0)} ${summary?.total === 1 ? 'lead' : 'leads'}?`}
	description={deleteDescription}
	confirmLabel="Delete all in range"
	action="?/deleteRange"
	fields={[
		['start', data.range.start ?? ''],
		['end', shownEnd ?? ''],
		['site', data.site ?? '']
	]}
	onresult={onDeleteResult}
/>
