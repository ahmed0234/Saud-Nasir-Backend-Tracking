<script lang="ts">
	import ConfirmDeleteDialog from '#lib/components/dashboard/confirm-delete-dialog.svelte';
	import { showDeleted } from '#lib/components/dashboard/deleted-pop.svelte';
	import LeadRow from '#lib/components/dashboard/lead-row.svelte';
	import PageHeader from '#lib/components/dashboard/page-header.svelte';
	import InstallStatus from '#lib/components/dashboard/install-status.svelte';
	import { openWebsiteDialog } from '#lib/components/dashboard/website-dialog.svelte';
	import SiteBadge from '#lib/components/dashboard/site-badge.svelte';
	import StatCard from '#lib/components/dashboard/stat-card.svelte';
	import StateMessage from '#lib/components/dashboard/state-message.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { formatDateTime, formatNumber } from '#lib/format.ts';
	import type { RecentClick } from '#lib/server/analytics.ts';
	import { EVENT_TYPE_LABELS, findWebsite, isEventType, SITE_URL_PARAM } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import CodeIcon from '@lucide/svelte/icons/code';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ServerCrashIcon from '@lucide/svelte/icons/server-crash';
	import SunIcon from '@lucide/svelte/icons/sun';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UsersIcon from '@lucide/svelte/icons/users';
	import XIcon from '@lucide/svelte/icons/x';
	import { enhance } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionResult } from '$app/forms';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let refreshing = $state(false);
	let sendingTest = $state(false);

	// Selection and deletion. Deleted rows are hidden as soon as the server confirms (playing their
	// exit animation), before the refresh that updates the stats and sidebar counts lands.
	const selected = new SvelteSet<string>();
	const removed = new SvelteSet<string>();
	let deleteOpen = $state(false);
	let deleteTarget = $state<{ ids: string[]; title: string; description: string }>({
		ids: [],
		title: '',
		description: ''
	});

	function askDelete(leads: RecentClick[]) {
		if (leads.length === 0) return;
		const [first] = leads;
		deleteTarget =
			leads.length === 1
				? {
						ids: [first.id],
						title: 'Delete this lead?',
						description: `The ${leadSummary(first)} from ${formatDateTime(first.clickedAt, data.timeZone)} will be permanently deleted from the database. This can't be undone.`
					}
				: {
						ids: leads.map((lead) => lead.id),
						title: `Delete ${formatNumber(leads.length)} leads?`,
						description: `The ${formatNumber(leads.length)} selected leads will be permanently deleted from the database. This can't be undone.`
					};
		deleteOpen = true;
	}

	function leadSummary(lead: RecentClick) {
		const kind = isEventType(lead.eventType) ? EVENT_TYPE_LABELS[lead.eventType] : 'lead';
		const label = lead.buttonText ?? lead.formName;
		return `${kind.toLowerCase()}${label ? ` “${label}”` : ''}`;
	}

	async function onDeleteResult(result: ActionResult) {
		if (result.type === 'success') {
			const deleted = Number(result.data?.deleted ?? 0);
			for (const id of deleteTarget.ids) {
				removed.add(id);
				selected.delete(id);
			}
			deleteOpen = false;
			if (deleted > 0) showDeleted(deleted);
			else toast.info('Nothing to delete', { description: 'These leads were already deleted.' });
			await refresh();
			removed.clear();
		} else {
			deleteOpen = false;
			toast.error('Delete failed', {
				description:
					result.type === 'failure'
						? String(result.data?.message ?? 'Please try again.')
						: 'Unexpected server error. Nothing was deleted.'
			});
		}
	}

	// Collapses a deleted row: fades and slides it out while closing the gap it leaves.
	function leaveRow(node: HTMLElement) {
		const height = node.offsetHeight;
		return {
			duration: prefersReducedMotion.current ? 0 : 320,
			easing: cubicOut,
			css: (t: number) => `
				overflow: hidden;
				opacity: ${t};
				height: ${t * height}px;
				margin-bottom: ${(t - 1) * 8}px;
				transform: translateX(${(1 - t) * -16}px) scale(${0.98 + t * 0.02});
			`
		};
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

	const site = $derived(findWebsite(data.websites, data.site));
	const summary = $derived(data.dashboard?.summary);
	const recent = $derived((data.dashboard?.recent ?? []).filter((lead) => !removed.has(lead.id)));
	// Only rows still on screen count as selected (a refresh can drop older ones off the list).
	const selectedLeads = $derived(recent.filter((lead) => selected.has(lead.id)));
	const allSelected = $derived(recent.length > 0 && selectedLeads.length === recent.length);

	function toggleAll(checked: boolean) {
		selected.clear();
		if (checked) for (const lead of recent) selected.add(lead.id);
	}

	function toggleLead(id: string, checked: boolean) {
		if (checked) selected.add(id);
		else selected.delete(id);
	}
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
			: 'CTA clicks and form submissions from all your websites, recorded in real time.'}
	>
		{#snippet eyebrow()}
			<span class="font-medium tracking-wider uppercase">Overview</span>
			<SiteBadge siteId={data.site} />
			{#if site}<InstallStatus website={site} timeZone={data.timeZone} />{/if}
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

	{#if site && !site.disabled && !site.lastSeenAt}
		<div
			class="flex flex-col gap-3 rounded-2xl bg-amber-500/[0.07] px-5 py-4 ring-1 ring-amber-500/25 sm:flex-row sm:items-center sm:justify-between"
			role="status"
		>
			<div class="space-y-0.5">
				<p class="font-medium">Waiting for the tracking code</p>
				<p class="text-sm text-muted-foreground">
					Install it on {site.name} once. This page shows leads as soon as the website sends its first
					event.
				</p>
			</div>
			<Button
				class="shrink-0"
				onclick={() => openWebsiteDialog({ mode: 'install', key: site.key })}
			>
				<CodeIcon />
				View install code
			</Button>
		</div>
	{/if}

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
				<div
					class={cn(
						'mx-3 mb-2 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-1.5 transition-colors sm:px-4',
						selectedLeads.length > 0 && 'bg-foreground/[0.05]'
					)}
				>
					<label class="flex cursor-pointer items-center gap-3 text-sm select-none">
						<Checkbox
							checked={allSelected}
							indeterminate={selectedLeads.length > 0 && !allSelected}
							onCheckedChange={toggleAll}
							aria-label="Select all leads shown"
						/>
						{#if selectedLeads.length > 0}
							<span class="font-medium tabular-nums">
								{formatNumber(selectedLeads.length)} of {formatNumber(recent.length)} selected
							</span>
						{:else}
							<span class="text-muted-foreground">Select all</span>
						{/if}
					</label>
					{#if selectedLeads.length > 0}
						<div class="flex items-center gap-1.5" transition:fly={{ x: 8, duration: 180 }}>
							<Button variant="ghost" size="sm" onclick={() => selected.clear()}>
								<XIcon />
								Clear
							</Button>
							<Button variant="destructive" size="sm" onclick={() => askDelete(selectedLeads)}>
								<Trash2Icon />
								Delete {formatNumber(selectedLeads.length)}
							</Button>
						</div>
					{/if}
				</div>
				<ul
					class={cn('flex flex-col gap-2 px-3 pb-3 transition-opacity', refreshing && 'opacity-60')}
				>
					{#each recent as lead, index (lead.id)}
						<li
							class="animate-in duration-500 ease-out fade-in-0 fill-mode-backwards slide-in-from-bottom-2 motion-reduce:animate-none"
							style:animation-delay="{Math.min(index, 12) * 35}ms"
							out:leaveRow
						>
							<LeadRow
								{lead}
								timeZone={data.timeZone}
								showSite={!site}
								selected={selected.has(lead.id)}
								onSelectedChange={(checked) => toggleLead(lead.id, checked)}
								onDelete={() => askDelete([lead])}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	title={deleteTarget.title}
	description={deleteTarget.description}
	confirmLabel={deleteTarget.ids.length === 1 ? 'Delete lead' : `Delete ${deleteTarget.ids.length}`}
	action="?/deleteLeads"
	fields={deleteTarget.ids.map((id) => ['id', id])}
	onresult={onDeleteResult}
/>
