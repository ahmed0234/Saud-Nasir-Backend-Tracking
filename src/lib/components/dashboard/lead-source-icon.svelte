<script lang="ts">
	import type { LeadSource } from '#lib/traffic-source.ts';
	import LeafIcon from '@lucide/svelte/icons/leaf';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import StarIcon from '@lucide/svelte/icons/star';

	// The glyph for a lead source. Facebook and Instagram are drawn here (Lucide has no brand
	// icons); the rest are Lucide icons. Decorative: the label next to it names the source.
	let { source, class: className }: { source: LeadSource; class?: string } = $props();
</script>

{#if source === 'facebook'}
	<svg viewBox="0 0 24 24" fill="currentColor" class={className} aria-hidden="true">
		<path
			d="M13.6 21v-7.6h2.6l.4-3.1h-3V8.4c0-.9.3-1.5 1.5-1.5h1.6V4.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.9v3.1h2.6V21h3.1Z"
		/>
	</svg>
{:else if source === 'instagram'}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		class={className}
		aria-hidden="true"
	>
		<rect x="3.5" y="3.5" width="17" height="17" rx="5" />
		<circle cx="12" cy="12" r="3.8" />
		<circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
	</svg>
{:else if source === 'yelp'}
	<StarIcon class={className} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
{:else if source === 'google_business_profile'}
	<MapPinIcon class={className} strokeWidth={2.5} aria-hidden="true" />
{:else if source === 'ai'}
	<SparklesIcon class={className} strokeWidth={2.4} aria-hidden="true" />
{:else}
	<LeafIcon class={className} strokeWidth={2.5} aria-hidden="true" />
{/if}
