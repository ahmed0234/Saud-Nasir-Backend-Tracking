<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { TIME_ZONE_COOKIE } from '#lib/timezone.ts';
	import { refreshAll } from '$app/navigation';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';
	import './layout.css';

	let { data, children }: LayoutProps = $props();

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

{@render children()}
