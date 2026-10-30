<script lang="ts">
	import InstallStatus from '#lib/components/dashboard/install-status.svelte';
	import PageHeader from '#lib/components/dashboard/page-header.svelte';
	import StateMessage from '#lib/components/dashboard/state-message.svelte';
	import { openWebsiteDialog } from '#lib/components/dashboard/website-dialog.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatNumber } from '#lib/format.ts';
	import { SITE_URL_PARAM, WEBSITE_PLATFORMS } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CodeIcon from '@lucide/svelte/icons/code';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const leadCount = (key: string) => data.siteCounts?.find((row) => row.site === key)?.total ?? 0;
	const platformLabel = (value: string) =>
		WEBSITE_PLATFORMS.find((option) => option.value === value)?.label ?? value;
	const dashboardHref = (key: string) =>
		resolve(`?${new URLSearchParams({ [SITE_URL_PARAM]: key })}`);
</script>

<svelte:head>
	<title>Websites · Lead Tracking</title>
</svelte:head>

<div class="space-y-8">
	<PageHeader
		title="Websites"
		description="Every website that sends leads to this dashboard, its tracking code and whether it’s installed."
	>
		{#snippet eyebrow()}
			<span class="font-medium tracking-wider uppercase">Manage</span>
		{/snippet}
		{#snippet actions()}
			<Button onclick={() => openWebsiteDialog({ mode: 'create' })}>
				<PlusIcon />
				Add website
			</Button>
		{/snippet}
	</PageHeader>

	{#if data.websites.length === 0}
		<div class="rounded-2xl glass">
			<StateMessage
				icon={GlobeIcon}
				title="No websites yet"
				description="Add a website to get its tracking code. Leads appear here as soon as it’s installed."
			>
				{#snippet action()}
					<Button onclick={() => openWebsiteDialog({ mode: 'create' })}>
						<PlusIcon />
						Add website
					</Button>
				{/snippet}
			</StateMessage>
		</div>
	{:else}
		<ul class="grid gap-4 md:grid-cols-2" data-stagger>
			{#each data.websites as website (website.key)}
				<li
					class={cn(
						'flex flex-col gap-4 rounded-2xl glass p-5 transition-opacity',
						website.disabled && 'opacity-75'
					)}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 items-start gap-3">
							<span
								class="mt-1.5 size-2.5 shrink-0 rounded-full"
								style:background-color={website.accent}
								style:box-shadow="0 0 12px 1px {website.accent}"
							></span>
							<div class="min-w-0 space-y-1">
								<h2 class="truncate font-medium">{website.name}</h2>
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external client website -->
								<a
									href={website.url}
									target="_blank"
									rel="noopener noreferrer"
									class="group/link inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
								>
									<span class="truncate">{new URL(website.url).host}</span>
									<ArrowUpRightIcon
										class="size-3 shrink-0 opacity-60 group-hover/link:opacity-100"
									/>
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</div>
						</div>
						<InstallStatus {website} timeZone={data.timeZone} class="shrink-0" />
					</div>

					<dl class="grid grid-cols-3 gap-3 text-sm">
						<div class="space-y-0.5">
							<dt class="text-xs text-muted-foreground">Leads</dt>
							<dd class="font-medium tabular-nums">{formatNumber(leadCount(website.key))}</dd>
						</div>
						<div class="space-y-0.5">
							<dt class="text-xs text-muted-foreground">Platform</dt>
							<dd class="truncate font-medium">{platformLabel(website.platform)}</dd>
						</div>
						<div class="min-w-0 space-y-0.5">
							<dt class="text-xs text-muted-foreground">Site key</dt>
							<dd class="truncate font-mono text-xs leading-5" title={website.key}>
								{website.key}
							</dd>
						</div>
					</dl>

					{#if website.domains.length > 1}
						<p class="text-xs text-muted-foreground">
							Also accepts: {website.domains.slice(1).join(', ')}
						</p>
					{/if}

					<div class="mt-auto flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => openWebsiteDialog({ mode: 'install', key: website.key })}
						>
							<CodeIcon />
							Install code
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => openWebsiteDialog({ mode: 'edit', key: website.key })}
						>
							<SettingsIcon />
							Settings
						</Button>
						<Button variant="ghost" size="sm" href={dashboardHref(website.key)} class="ml-auto">
							<LayoutGridIcon />
							Dashboard
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
