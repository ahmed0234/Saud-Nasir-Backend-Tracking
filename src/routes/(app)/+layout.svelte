<script lang="ts">
	import AppSidebar from '#lib/components/dashboard/app-sidebar.svelte';
	import OpeningIntro from '#lib/components/dashboard/opening-intro.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { getSite, siteFromUrl } from '#lib/sites.ts';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import { afterNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let mobileNavOpen = $state(false);

	const site = $derived(getSite(siteFromUrl(page.url)));
	// Re-run the entrance animation when the website or the view changes, not on filter changes.
	const viewKey = $derived(`${page.url.pathname}|${site?.id ?? 'all'}`);

	afterNavigate(() => {
		mobileNavOpen = false;
	});
</script>

<OpeningIntro />

<div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
	<div
		class="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-foreground/[0.06] blur-3xl"
	></div>
	<!-- Tinted with the selected website's colour; fades between sites. -->
	<div
		class="absolute top-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full opacity-[0.14] blur-3xl transition-[background-color] duration-700 ease-out dark:opacity-[0.16]"
		style:background-color={site?.accent ?? 'var(--foreground)'}
	></div>
	<div
		class="absolute right-[-12rem] bottom-[-16rem] h-[30rem] w-[30rem] rounded-full bg-foreground/[0.05] blur-3xl"
	></div>
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:48px_48px] opacity-40"
	></div>
</div>

<Tooltip.Provider delayDuration={150}>
	<div class="mx-auto flex min-h-svh max-w-[1600px] gap-4 p-3 sm:p-4">
		<!-- Desktop sidebar -->
		<aside
			class="sticky top-4 hidden h-[calc(100svh-2rem)] w-64 shrink-0 overflow-y-auto rounded-3xl glass lg:block"
			aria-label="Sidebar"
		>
			<AppSidebar siteCounts={data.siteCounts} />
		</aside>

		<div class="flex min-w-0 flex-1 flex-col gap-3">
			<!-- Phone and tablet top bar -->
			<header
				class="sticky top-3 z-40 flex items-center gap-3 rounded-2xl glass px-2 py-2 lg:hidden"
			>
				<Sheet.Root bind:open={mobileNavOpen}>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon" aria-label="Open navigation">
								<MenuIcon />
							</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content
						side="left"
						class="w-[18rem] border-border/60 bg-background/80 p-0 backdrop-blur-2xl"
					>
						<Sheet.Header class="sr-only">
							<Sheet.Title>Navigation</Sheet.Title>
							<Sheet.Description>Choose a website and a view.</Sheet.Description>
						</Sheet.Header>
						<AppSidebar siteCounts={data.siteCounts} />
					</Sheet.Content>
				</Sheet.Root>
				<span
					class="grid size-7 place-items-center rounded-md bg-foreground text-background shadow-sm"
				>
					<ActivityIcon class="size-4" />
				</span>
				<span class="min-w-0 truncate text-sm font-medium">{site?.name ?? 'All websites'}</span>
				{#if site}
					<span
						class="size-2 shrink-0 rounded-full"
						style:background-color={site.accent}
						aria-hidden="true"
					></span>
				{/if}
			</header>

			<main
				class="relative flex-1 overflow-hidden rounded-3xl bg-card/25 px-4 py-6 ring-1 ring-foreground/10 sm:px-6 sm:py-8 lg:px-8"
			>
				{#if navigating.to}
					<div
						class="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
						role="progressbar"
						aria-label="Loading"
					>
						<div
							class="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] rounded-full motion-reduce:animate-none"
							style:background-color={site?.accent ?? 'var(--foreground)'}
						></div>
					</div>
				{/if}
				{#key viewKey}
					<div
						in:fly={{
							y: 12,
							duration: prefersReducedMotion.current ? 0 : 320,
							easing: cubicOut
						}}
					>
						{@render children()}
					</div>
				{/key}
			</main>
		</div>
	</div>
</Tooltip.Provider>
