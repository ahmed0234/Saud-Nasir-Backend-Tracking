<script lang="ts">
	import ThemeToggle from '#lib/components/theme-toggle.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatNumber } from '#lib/format.ts';
	import { SITE_URL_PARAM, SITES, siteFromUrl, type SiteId } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';

	let {
		siteCounts
	}: {
		/** All-time leads per site (null site = other domains); null if the query failed. */
		siteCounts: { site: string | null; total: number; today: number }[] | null;
	} = $props();

	// Each website row is ITEM_HEIGHT tall with ITEM_GAP between rows; the active highlight is one
	// element moved with a transform, so switching sites animates on the compositor.
	const ITEM_HEIGHT = 44;
	const ITEM_GAP = 4;

	const options = [
		{ id: null, name: 'All websites', accent: null },
		...SITES.map((site) => ({ id: site.id, name: site.name, accent: site.accent }))
	];

	const views = [
		{ path: '/', label: 'Overview', icon: LayoutGridIcon },
		{ path: '/analytics', label: 'Analytics', icon: ChartLineIcon }
	] as const;

	const currentSite = $derived(siteFromUrl(page.url));
	const activeIndex = $derived(options.findIndex((option) => option.id === currentSite));
	const pendingSite = $derived(navigating.to ? siteFromUrl(navigating.to.url) : undefined);

	function countFor(id: SiteId | null) {
		if (!siteCounts) return null;
		return id === null
			? siteCounts.reduce((sum, row) => sum + row.total, 0)
			: (siteCounts.find((row) => row.site === id)?.total ?? 0);
	}

	/** Same view and filters, different website. */
	function siteHref(id: SiteId | null) {
		const others = [...page.url.searchParams].filter(([key]) => key !== SITE_URL_PARAM);
		const params = new URLSearchParams(id ? [[SITE_URL_PARAM, id], ...others] : others);
		return href(page.url.pathname === '/analytics' ? '/analytics' : '/', params);
	}

	/** Another view, keeping the selected website. */
	function viewHref(path: '/' | '/analytics') {
		return href(path, new URLSearchParams(currentSite ? { [SITE_URL_PARAM]: currentSite } : {}));
	}

	function href(path: '/' | '/analytics', params: URLSearchParams) {
		if (path === '/analytics') {
			return params.size > 0 ? resolve(`/(app)/analytics?${params}`) : resolve('/(app)/analytics');
		}
		return params.size > 0 ? resolve(`/(app)?${params}`) : resolve('/(app)');
	}
</script>

<div class="flex h-full flex-col gap-7 p-3">
	<a
		href={resolve('/(app)')}
		class="flex items-center gap-2.5 rounded-xl px-2 pt-1 font-semibold tracking-tight"
	>
		<span class="grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm">
			<ActivityIcon class="size-4" />
		</span>
		<span class="leading-tight">
			Lead Tracking
			<span class="block text-xs font-normal text-muted-foreground">3 WordPress websites</span>
		</span>
	</a>

	<nav aria-labelledby="sidebar-websites" class="space-y-2">
		<p
			id="sidebar-websites"
			class="px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
		>
			Websites
		</p>
		<ul class="relative flex flex-col" style:gap="{ITEM_GAP}px">
			{#if activeIndex >= 0}
				<li
					aria-hidden="true"
					class="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-foreground/[0.07] shadow-[0_1px_0_0_inset] ring-1 shadow-white/5 ring-foreground/10 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
					style:height="{ITEM_HEIGHT}px"
					style:transform="translateY({activeIndex * (ITEM_HEIGHT + ITEM_GAP)}px)"
				></li>
			{/if}
			{#each options as option (option.id)}
				{@const active = option.id === currentSite}
				{@const count = countFor(option.id)}
				<li>
					<a
						href={siteHref(option.id)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'group relative flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200',
							active
								? 'font-medium text-foreground'
								: 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
						)}
						style:height="{ITEM_HEIGHT}px"
					>
						{#if option.accent}
							<span
								class="mx-[5px] size-2.5 shrink-0 rounded-full transition-[box-shadow] duration-300"
								style:background-color={option.accent}
								style:box-shadow={active ? `0 0 12px 1px ${option.accent}` : undefined}
							></span>
						{:else}
							<span class="flex w-5 shrink-0 justify-center -space-x-1" aria-hidden="true">
								{#each SITES as site (site.id)}
									<span
										class="size-2 rounded-full ring-1 ring-background"
										style:background-color={site.accent}
									></span>
								{/each}
							</span>
						{/if}
						<span class="min-w-0 flex-1 truncate">{option.name}</span>
						{#if pendingSite === option.id && !active}
							<Loader2Icon class="size-3.5 animate-spin text-muted-foreground" />
						{:else if count !== null}
							<span
								class={cn(
									'rounded-md px-1.5 py-0.5 text-xs tabular-nums transition-colors',
									active ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground'
								)}
								title="Leads, all time">{formatNumber(count)}</span
							>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<nav aria-labelledby="sidebar-views" class="space-y-2">
		<p
			id="sidebar-views"
			class="px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
		>
			Views
		</p>
		<ul class="flex flex-col gap-1">
			{#each views as view (view.path)}
				{@const active = page.url.pathname === view.path}
				<li>
					<a
						href={viewHref(view.path)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200',
							active
								? 'bg-foreground/[0.07] font-medium text-foreground'
								: 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
						)}
					>
						<view.icon class="size-4" />
						{view.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="mt-auto flex items-center justify-between gap-2 px-1">
		<p class="text-xs text-muted-foreground">Read-only analytics</p>
		<div class="flex items-center gap-2">
			<ThemeToggle />
			<!-- A plain form POST: the full page load on sign-out also drops all client-side data. -->
			<form method="POST" action={resolve('/logout')}>
				<Button type="submit" variant="outline" size="icon" aria-label="Sign out" title="Sign out">
					<LogOutIcon />
				</Button>
			</form>
		</div>
	</div>
</div>
