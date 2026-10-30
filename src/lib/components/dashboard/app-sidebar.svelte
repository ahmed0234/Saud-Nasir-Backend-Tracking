<script lang="ts">
	import ThemeToggle from '#lib/components/theme-toggle.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatNumber } from '#lib/format.ts';
	import { SITE_URL_PARAM, siteFromUrl, type Website } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';
	import { openWebsiteDialog } from './website-dialog.svelte';

	let {
		siteCounts,
		websites,
		onAddWebsite
	}: {
		/** All-time leads per site (null site = other domains); null if the query failed. */
		siteCounts: { site: string | null; total: number; today: number }[] | null;
		/** Registered websites, oldest first. */
		websites: Website[];
		/** Called before the add-website dialog opens (the mobile sheet closes itself). */
		onAddWebsite?: () => void;
	} = $props();

	// Each website row is ITEM_HEIGHT tall with ITEM_GAP between rows (views: VIEW_HEIGHT, same gap);
	// each list's highlight is one element moved with a transform, so it animates on the compositor.
	const ITEM_HEIGHT = 44;
	const ITEM_GAP = 4;
	const VIEW_HEIGHT = 40;

	const options = $derived([
		{ id: null, name: 'All websites', accent: null, website: null },
		...websites.map((website) => ({
			id: website.key,
			name: website.name,
			accent: website.accent,
			website
		}))
	]);

	const views = [
		{ path: '/', label: 'Overview', icon: LayoutGridIcon },
		{ path: '/analytics', label: 'Analytics', icon: ChartLineIcon },
		{ path: '/websites', label: 'Websites', icon: GlobeIcon }
	] as const;

	const currentSite = $derived(siteFromUrl(page.url));
	const pendingSite = $derived(navigating.to ? siteFromUrl(navigating.to.url) : undefined);
	// The highlights follow a click immediately, while the next view loads; aria-current keeps
	// describing the page that is actually shown.
	const selectedSite = $derived(pendingSite === undefined ? currentSite : pendingSite);
	const selectedPath = $derived((navigating.to?.url ?? page.url).pathname);
	const activeIndex = $derived(options.findIndex((option) => option.id === selectedSite));
	const viewIndex = $derived(views.findIndex((view) => view.path === selectedPath));

	function countFor(id: string | null) {
		if (!siteCounts) return null;
		return id === null
			? siteCounts.reduce((sum, row) => sum + row.total, 0)
			: (siteCounts.find((row) => row.site === id)?.total ?? 0);
	}

	/** Same view and filters, different website. */
	function siteHref(id: string | null) {
		const others = [...page.url.searchParams].filter(([key]) => key !== SITE_URL_PARAM);
		const params = new URLSearchParams(id ? [[SITE_URL_PARAM, id], ...others] : others);
		return href(page.url.pathname === '/analytics' ? '/analytics' : '/', params);
	}

	/** Another view, keeping the selected website. */
	function viewHref(path: '/' | '/analytics' | '/websites') {
		if (path === '/websites') return resolve('/(app)/websites');
		return href(path, new URLSearchParams(currentSite ? { [SITE_URL_PARAM]: currentSite } : {}));
	}

	// URLs with a query use resolve()'s pathname form (no leading slash). The route-ID form only
	// drops the `(app)` group when it is a whole segment, so `/(app)?site=x` stayed in the URL (404).
	function href(path: '/' | '/analytics', params: URLSearchParams) {
		if (path === '/analytics') {
			return params.size > 0 ? resolve(`analytics?${params}`) : resolve('/(app)/analytics');
		}
		return params.size > 0 ? resolve(`?${params}`) : resolve('/(app)');
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
			<span class="block text-xs font-normal text-muted-foreground"
				>{websites.length} {websites.length === 1 ? 'website' : 'websites'}</span
			>
		</span>
	</a>

	<nav aria-labelledby="sidebar-websites" class="space-y-2">
		<div class="flex items-center justify-between pr-1 pl-3">
			<p
				id="sidebar-websites"
				class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
			>
				Websites
			</p>
			<button
				type="button"
				onclick={() => {
					onAddWebsite?.();
					openWebsiteDialog({ mode: 'create' });
				}}
				class="group/add grid size-6 place-items-center rounded-lg text-muted-foreground ring-1 ring-foreground/10 transition-[background-color,color,transform] duration-200 hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-90"
				aria-label="Add a website"
				title="Add a website"
			>
				<PlusIcon
					class="size-3.5 transition-transform duration-300 group-hover/add:rotate-90 motion-reduce:transition-none"
				/>
			</button>
		</div>
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
				{@const selected = option.id === selectedSite}
				{@const count = countFor(option.id)}
				<!-- Added and deleted websites slide in and out (not on first render). -->
				<li
					in:slide={{ duration: prefersReducedMotion.current ? 0 : 260, easing: cubicOut }}
					out:slide={{ duration: prefersReducedMotion.current ? 0 : 320, easing: cubicOut }}
				>
					<a
						href={siteHref(option.id)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'group relative flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200',
							selected
								? 'font-medium text-foreground'
								: 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
						)}
						style:height="{ITEM_HEIGHT}px"
					>
						{#if option.accent}
							<span
								class="mx-[5px] size-2.5 shrink-0 rounded-full transition-[box-shadow] duration-300"
								style:background-color={option.accent}
								style:box-shadow={selected ? `0 0 12px 1px ${option.accent}` : undefined}
							></span>
						{:else}
							<span class="flex w-5 shrink-0 justify-center -space-x-1" aria-hidden="true">
								{#each websites.slice(0, 3) as site (site.key)}
									<span
										class="size-2 rounded-full ring-1 ring-background"
										style:background-color={site.accent}
									></span>
								{/each}
							</span>
						{/if}
						<span class={cn('min-w-0 flex-1 truncate', option.website?.disabled && 'opacity-60')}
							>{option.name}</span
						>
						{#if option.website?.disabled}
							<span
								class="rounded px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-foreground/10"
								title="Tracking is disabled">Off</span
							>
						{:else if option.website && !option.website.lastSeenAt}
							<span
								class="relative flex size-1.5"
								title="Waiting for installation"
								aria-label="Waiting for installation"
							>
								<span
									class="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:animate-none"
								></span>
								<span class="relative inline-flex size-1.5 rounded-full bg-amber-500"></span>
							</span>
						{/if}
						{#if pendingSite === option.id && !active}
							<Loader2Icon class="size-3.5 animate-spin text-muted-foreground" />
						{:else if count !== null}
							<span
								class={cn(
									'rounded-md px-1.5 py-0.5 text-xs tabular-nums transition-colors',
									selected ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground'
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
		<ul class="relative flex flex-col" style:gap="{ITEM_GAP}px">
			{#if viewIndex >= 0}
				<li
					aria-hidden="true"
					class="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-foreground/[0.07] shadow-[0_1px_0_0_inset] ring-1 shadow-white/5 ring-foreground/10 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
					style:height="{VIEW_HEIGHT}px"
					style:transform="translateY({viewIndex * (VIEW_HEIGHT + ITEM_GAP)}px)"
				></li>
			{/if}
			{#each views as view (view.path)}
				{@const active = page.url.pathname === view.path}
				{@const selected = selectedPath === view.path}
				<li>
					<a
						href={viewHref(view.path)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'relative flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200',
							selected
								? 'font-medium text-foreground'
								: 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
						)}
						style:height="{VIEW_HEIGHT}px"
					>
						<view.icon class="size-4" />
						{view.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="mt-auto flex items-center justify-between gap-2 px-1">
		<p class="text-xs text-muted-foreground">Lead tracking</p>
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
