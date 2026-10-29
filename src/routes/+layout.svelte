<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import ThemeToggle from '#lib/components/theme-toggle.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { TIME_ZONE_COOKIE } from '#lib/timezone.ts';
	import { cn } from '#lib/utils.js';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';
	import './layout.css';

	let { data, children }: LayoutProps = $props();

	const links = [
		{ href: '/', label: 'Overview' },
		{ href: '/analytics', label: 'Analytics' }
	] as const;

	// Share the browser's time zone with the server so "today" and daily buckets use local days.
	onMount(() => {
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (timeZone && timeZone !== data.timeZone) {
			document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
			refreshAll();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher defaultMode="dark" />
<Toaster position="bottom-right" />

<div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
	<div
		class="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-foreground/[0.06] blur-3xl"
	></div>
	<div
		class="absolute right-[-12rem] bottom-[-16rem] h-[30rem] w-[30rem] rounded-full bg-foreground/[0.05] blur-3xl"
	></div>
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:48px_48px] opacity-40"
	></div>
</div>

<Tooltip.Provider delayDuration={150}>
	<header class="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl">
		<div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
			<a href={resolve('/')} class="flex items-center gap-2 font-semibold tracking-tight">
				<span
					class="grid size-7 place-items-center rounded-md bg-foreground text-background shadow-sm"
				>
					<ActivityIcon class="size-4" />
				</span>
				<span class="hidden sm:inline">CTA Tracking</span>
			</a>
			<nav aria-label="Main" class="flex items-center gap-1">
				{#each links as link (link.href)}
					{@const active = page.url.pathname === link.href}
					<a
						href={resolve(link.href)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'rounded-md px-3 py-1.5 text-sm transition-colors',
							active
								? 'bg-foreground/10 font-medium text-foreground'
								: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
						)}
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto">
				<ThemeToggle />
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
		{@render children()}
	</main>
</Tooltip.Provider>
