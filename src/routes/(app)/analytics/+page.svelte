<script lang="ts">
	import ClicksAreaChart from '#lib/components/dashboard/clicks-area-chart.svelte';
	import ClicksBarChart from '#lib/components/dashboard/clicks-bar-chart.svelte';
	import DateRangeFilter from '#lib/components/dashboard/date-range-filter.svelte';
	import PageHeader from '#lib/components/dashboard/page-header.svelte';
	import RankedList from '#lib/components/dashboard/ranked-list.svelte';
	import SiteBadge from '#lib/components/dashboard/site-badge.svelte';
	import StatCard from '#lib/components/dashboard/stat-card.svelte';
	import StateMessage from '#lib/components/dashboard/state-message.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { PRESETS, toLocalIsoDate } from '#lib/date-range.ts';
	import { formatDateTime, formatNumber, formatPercent, splitUrl } from '#lib/format.ts';
	import { buttonTypeLabel, EVENT_TYPE_LABELS, getSite, isEventType } from '#lib/sites.ts';
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
	import { refreshAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let refreshing = $state(false);
	const loading = $derived(refreshing || navigating.to?.route.id === '/(app)/analytics');

	const site = $derived(getSite(data.site));
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
		{/snippet}
	</PageHeader>

	<div class="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
		{#if rangeText}<span>{rangeText} · {data.timeZone}</span>{/if}
		{#if loading}
			<span class="inline-flex items-center gap-1.5" role="status">
				<Loader2Icon class="size-3 animate-spin" /> Updating…
			</span>
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

				{#if !site}
					<RankedList
						title="Leads by website"
						description="Which website each lead came from"
						items={analytics.sites.map((row) => ({ ...row, key: row.site ?? 'other' }))}
						total={summary.total}
					>
						{#snippet label(item)}
							{@const itemSite = getSite(item.site)}
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
