<script lang="ts">
	import LeadRow from '#lib/components/dashboard/lead-row.svelte';
	import PageHeader from '#lib/components/dashboard/page-header.svelte';
	import SiteBadge from '#lib/components/dashboard/site-badge.svelte';
	import StatCard from '#lib/components/dashboard/stat-card.svelte';
	import StateMessage from '#lib/components/dashboard/state-message.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatDateTime, formatNumber } from '#lib/format.ts';
	import { getSite, SITE_URL_PARAM } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ServerCrashIcon from '@lucide/svelte/icons/server-crash';
	import SunIcon from '@lucide/svelte/icons/sun';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { enhance } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let refreshing = $state(false);
	let sendingTest = $state(false);

	async function refresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			await refreshAll();
		} finally {
			refreshing = false;
		}
	}

	const site = $derived(getSite(data.site));
	const summary = $derived(data.dashboard?.summary);
	const recent = $derived(data.dashboard?.recent ?? []);
	const analyticsHref = $derived(
		data.site
			? resolve(`analytics?${new URLSearchParams({ [SITE_URL_PARAM]: data.site })}`)
			: resolve('/(app)/analytics')
	);
</script>

<svelte:head>
	<title>{site ? `${site.name} · ` : ''}Overview · Lead Tracking</title>
</svelte:head>

<div class="space-y-8">
	<PageHeader
		title={site?.name ?? 'All websites'}
		description={site
			? `CTA clicks and form submissions from ${site.name}, recorded in real time.`
			: 'CTA clicks and form submissions from all three websites, recorded in real time.'}
	>
		{#snippet eyebrow()}
			<span class="font-medium tracking-wider uppercase">Overview</span>
			<SiteBadge siteId={data.site} />
		{/snippet}
		{#snippet actions()}
			<form
				method="POST"
				action="?/sendTestEmail"
				use:enhance={() => {
					sendingTest = true;
					return async ({ result }) => {
						sendingTest = false;
						if (result.type === 'success') {
							toast.success('Test email sent', { description: String(result.data?.message ?? '') });
						} else if (result.type === 'failure') {
							toast.error('Test email failed', { description: String(result.data?.message ?? '') });
						} else if (result.type === 'error') {
							toast.error('Test email failed', { description: 'Unexpected server error.' });
						}
					};
				}}
			>
				<Button
					type="submit"
					variant="outline"
					class="glass"
					disabled={sendingTest}
					aria-busy={sendingTest}
				>
					{#if sendingTest}
						<Loader2Icon class="animate-spin" />
						Sending…
					{:else}
						<MailIcon />
						Send test email
					{/if}
				</Button>
			</form>
			<Button
				variant="outline"
				class="glass"
				onclick={refresh}
				disabled={refreshing}
				aria-busy={refreshing}
			>
				<RefreshCwIcon class={cn(refreshing && 'animate-spin')} />
				{refreshing ? 'Refreshing…' : 'Refresh'}
			</Button>
			<Button href={analyticsHref}>
				<ChartLineIcon />
				Analytics
			</Button>
		{/snippet}
	</PageHeader>

	{#if data.error || !summary}
		<div class="rounded-2xl glass">
			<StateMessage
				icon={ServerCrashIcon}
				tone="error"
				title="Tracking data unavailable"
				description={`${data.error ?? 'Something went wrong.'} Check DATABASE_URL and that migrations have run.`}
			>
				{#snippet action()}
					<Button variant="outline" onclick={refresh} disabled={refreshing}>
						<RefreshCwIcon class={cn(refreshing && 'animate-spin')} />
						Try again
					</Button>
				{/snippet}
			</StateMessage>
		</div>
	{:else}
		<div
			class={cn(
				'grid grid-cols-2 gap-3 transition-opacity sm:gap-4 xl:grid-cols-4',
				refreshing && 'opacity-60'
			)}
			data-stagger
		>
			<StatCard label="Total leads" value={formatNumber(summary.total)} icon={UsersIcon}>
				{#snippet hint()}All time · {formatNumber(summary.uniquePages)} pages with leads{/snippet}
			</StatCard>
			<StatCard
				label="CTA clicks"
				value={formatNumber(summary.ctaClicks)}
				icon={MousePointerClickIcon}
			>
				{#snippet hint()}Calls, bookings and buttons, all time{/snippet}
			</StatCard>
			<StatCard
				label="Form submissions"
				value={formatNumber(summary.formSubmissions)}
				icon={ClipboardListIcon}
			>
				{#snippet hint()}Submitted lead forms, all time{/snippet}
			</StatCard>
			<StatCard label="Today" value={formatNumber(summary.today)} icon={SunIcon}>
				{#snippet hint()}Since midnight, {data.timeZone} · {formatNumber(summary.last7Days)} in the last
					7 days{/snippet}
			</StatCard>
		</div>

		<section class="rounded-2xl glass" aria-labelledby="recent-heading">
			<header class="flex flex-wrap items-end justify-between gap-2 px-5 pt-5 pb-4">
				<div class="space-y-1">
					<h2 id="recent-heading" class="font-medium">Recent leads</h2>
					<p class="text-sm text-muted-foreground">
						Latest {data.dashboard?.limit} CTA clicks and form submissions, newest first. Times in
						{data.timeZone}.
					</p>
				</div>
				<p class="text-xs text-muted-foreground" aria-live="polite">
					Updated {formatDateTime(data.dashboard!.loadedAt, data.timeZone)}
				</p>
			</header>

			{#if recent.length === 0}
				<StateMessage
					icon={InboxIcon}
					title={site ? `No leads from ${site.name} yet` : 'No leads recorded yet'}
					description="Leads appear here as soon as the website's snippet sends them to /api/cta-click."
				/>
			{:else}
				<ul
					class={cn('flex flex-col gap-2 px-3 pb-3 transition-opacity', refreshing && 'opacity-60')}
				>
					{#each recent as lead, index (lead.id)}
						<li
							class="animate-in duration-500 ease-out fade-in-0 fill-mode-backwards slide-in-from-bottom-2 motion-reduce:animate-none"
							style:animation-delay="{Math.min(index, 12) * 35}ms"
						>
							<LeadRow {lead} timeZone={data.timeZone} showSite={!site} />
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
