<script lang="ts">
	import PageHeader from '#lib/components/dashboard/page-header.svelte';
	import StatCard from '#lib/components/dashboard/stat-card.svelte';
	import StateMessage from '#lib/components/dashboard/state-message.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { formatDateTime, formatNumber, formatUtc, splitUrl } from '#lib/format.ts';
	import { cn } from '#lib/utils.js';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import InfoIcon from '@lucide/svelte/icons/info';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ServerCrashIcon from '@lucide/svelte/icons/server-crash';
	import SunIcon from '@lucide/svelte/icons/sun';
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

	const summary = $derived(data.dashboard?.summary);
	const recent = $derived(data.dashboard?.recent ?? []);
</script>

<svelte:head>
	<title>Overview · CTA Tracking</title>
</svelte:head>

<div class="space-y-8">
	<PageHeader
		title="CTA activity"
		description="Clicks on your website's call-to-action buttons, recorded in real time."
	>
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
				<Button type="submit" variant="outline" disabled={sendingTest} aria-busy={sendingTest}>
					{#if sendingTest}
						<Loader2Icon class="animate-spin" />
						Sending…
					{:else}
						<MailIcon />
						Send test email
					{/if}
				</Button>
			</form>
			<Button variant="outline" onclick={refresh} disabled={refreshing} aria-busy={refreshing}>
				<RefreshCwIcon class={cn(refreshing && 'animate-spin')} />
				{refreshing ? 'Refreshing…' : 'Refresh'}
			</Button>
			<Button href={resolve('/analytics')}>
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
				'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4',
				refreshing && 'opacity-60'
			)}
		>
			<StatCard
				label="Total clicks"
				value={formatNumber(summary.total)}
				icon={MousePointerClickIcon}
			>
				{#snippet hint()}All time{/snippet}
			</StatCard>
			<StatCard label="Today" value={formatNumber(summary.today)} icon={SunIcon}>
				{#snippet hint()}Since midnight, {data.timeZone}{/snippet}
			</StatCard>
			<StatCard label="Last 7 days" value={formatNumber(summary.last7Days)} icon={CalendarDaysIcon}>
				{#snippet hint()}Rolling 7 × 24 hours{/snippet}
			</StatCard>
			<StatCard
				label="Pages with clicks"
				value={formatNumber(summary.uniquePages)}
				icon={FileTextIcon}
			>
				{#snippet hint()}Unique page URLs, all time{/snippet}
			</StatCard>
		</div>

		<section class="overflow-hidden rounded-2xl glass" aria-labelledby="recent-heading">
			<header
				class="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 px-5 py-4"
			>
				<div class="space-y-1">
					<h2 id="recent-heading" class="font-medium">Recent activity</h2>
					<p class="text-sm text-muted-foreground">
						Latest {data.dashboard?.limit} clicks, newest first. Times shown in {data.timeZone}.
					</p>
				</div>
				<p class="text-xs text-muted-foreground" aria-live="polite">
					Updated {formatDateTime(data.dashboard!.loadedAt, data.timeZone)}
				</p>
			</header>

			{#if recent.length === 0}
				<StateMessage
					icon={InboxIcon}
					title="No clicks recorded yet"
					description="Clicks appear here as soon as your WordPress snippet sends them to /api/cta-click."
				/>
			{:else}
				<!-- Table on tablet and up -->
				<div
					class={cn(
						'hidden overflow-x-auto transition-opacity md:block',
						refreshing && 'opacity-60'
					)}
				>
					<table class="w-full text-sm">
						<thead>
							<tr
								class="border-b border-border/60 text-left text-xs tracking-wide text-muted-foreground uppercase"
							>
								<th scope="col" class="px-5 py-3 font-medium">Page</th>
								<th scope="col" class="px-3 py-3 font-medium">City</th>
								<th scope="col" class="px-3 py-3 font-medium">State</th>
								<th scope="col" class="px-3 py-3 font-medium">
									<Tooltip.Root>
										<Tooltip.Trigger class="inline-flex items-center gap-1 uppercase">
											Browser <InfoIcon class="size-3" />
										</Tooltip.Trigger>
										<Tooltip.Content class="max-w-60 normal-case">
											Browser isn't stored yet. It needs a user_agent column in the database.
										</Tooltip.Content>
									</Tooltip.Root>
								</th>
								<th scope="col" class="px-3 py-3 font-medium">Clicked</th>
								<th scope="col" class="px-5 py-3 text-right font-medium">Event</th>
							</tr>
						</thead>
						<tbody>
							{#each recent as click (click.id)}
								{@const url = splitUrl(click.pageUrl)}
								<tr
									class="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]"
								>
									<td class="max-w-[22rem] px-5 py-3">
										<!-- eslint-disable svelte/no-navigation-without-resolve -- external WordPress page -->
										<a
											href={click.pageUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="group/link flex min-w-0 items-center gap-1.5"
											title={click.pageUrl}
										>
											<span class="min-w-0">
												<span class="block truncate font-medium group-hover/link:underline"
													>{url.path}</span
												>
												<span class="block truncate text-xs text-muted-foreground">{url.host}</span>
											</span>
											<ArrowUpRightIcon
												class="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100"
											/>
										</a>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									</td>
									<td class="px-3 py-3 whitespace-nowrap">
										{#if click.city}{click.city}{:else}<span class="text-muted-foreground">—</span
											>{/if}
									</td>
									<td class="px-3 py-3 whitespace-nowrap">
										{#if click.state}{click.state}{:else}<span class="text-muted-foreground">—</span
											>{/if}
									</td>
									<td class="px-3 py-3 text-muted-foreground">Not collected</td>
									<td class="px-3 py-3 whitespace-nowrap tabular-nums">
										<time datetime={click.clickedAt} title={formatUtc(click.clickedAt)}>
											{formatDateTime(click.clickedAt, data.timeZone)}
										</time>
									</td>
									<td class="px-5 py-3 text-right">
										<code
											class="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
											title={click.id}>{click.id.slice(0, 8)}</code
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Stacked list on phones -->
				<ul class={cn('divide-y divide-border/40 md:hidden', refreshing && 'opacity-60')}>
					{#each recent as click (click.id)}
						{@const url = splitUrl(click.pageUrl)}
						{@const location = [click.city, click.state].filter(Boolean).join(', ')}
						<li class="space-y-1.5 px-5 py-4">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- external WordPress page -->
							<a
								href={click.pageUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="block truncate font-medium hover:underline">{url.path}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<p class="truncate text-xs text-muted-foreground">{url.host}</p>
							<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
								<span>{location || 'Location unknown'}</span>
								<time datetime={click.clickedAt} class="tabular-nums">
									{formatDateTime(click.clickedAt, data.timeZone)}
								</time>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
