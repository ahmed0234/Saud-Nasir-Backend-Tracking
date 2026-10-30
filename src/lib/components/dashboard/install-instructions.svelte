<script lang="ts">
	import type { Website } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CodeIcon from '@lucide/svelte/icons/code';
	import { resolve } from '$app/paths';
	import CopyButton from './copy-button.svelte';

	// How to install the tracker on one website: the one-line tag, with steps for WordPress
	// (WPCode), plain HTML, or both, plus the full inline code as a fallback.
	let { website, trackerOrigin }: { website: Website; trackerOrigin: string } = $props();

	const tag = $derived(
		`<script src="${trackerOrigin}/t.js" data-site="${website.key}" defer></` + 'script>'
	);
	const sections = $derived(
		website.platform === 'both' ? (['wordpress', 'html'] as const) : ([website.platform] as const)
	);

	async function loadInlineCode() {
		const response = await fetch(resolve('/(app)/websites/[key]/tracker.js', { key: website.key }));
		if (!response.ok) throw new Error(`Server responded with ${response.status}`);
		return response.text();
	}
</script>

{#snippet codeBlock(code: string, label: string)}
	<div class="overflow-hidden rounded-xl bg-foreground/[0.04] ring-1 ring-foreground/10">
		<div class="flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-1.5">
			<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
				<CodeIcon class="size-3.5" />
				{label}
			</span>
			<CopyButton text={code} class="h-7" />
		</div>
		<pre
			class="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap select-all">{code}</pre>
	</div>
{/snippet}

<div class="grid gap-4">
	{#each sections as section (section)}
		<section
			class="grid gap-3 rounded-2xl bg-foreground/[0.02] p-4 ring-1 ring-foreground/[0.08]"
			aria-label={section === 'wordpress' ? 'WordPress installation' : 'HTML installation'}
		>
			<div class="flex items-center gap-2">
				<span
					class={cn(
						'grid size-6 place-items-center rounded-md text-[11px] font-semibold',
						section === 'wordpress'
							? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
							: 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
					)}
				>
					{section === 'wordpress' ? 'WP' : '</>'}
				</span>
				<h3 class="text-sm font-medium">
					{section === 'wordpress' ? 'WordPress (WPCode plugin)' : 'HTML / custom website'}
				</h3>
			</div>
			{#if section === 'wordpress'}
				<ol
					class="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground marker:text-foreground/40"
				>
					<li>
						In WordPress, open <span class="text-foreground">Code Snippets → + Add Snippet</span>.
					</li>
					<li>
						Choose <span class="text-foreground">HTML Snippet</span> and paste the code below.
					</li>
					<li>
						Set <span class="text-foreground">Location</span> to
						<span class="text-foreground">Site Wide Footer</span>, switch it to
						<span class="text-foreground">Active</span>, and save.
					</li>
					<li>
						Clear any cache plugin. If WP Rocket or LiteSpeed delays JavaScript, exclude <code
							class="font-mono text-xs">t.js</code
						>.
					</li>
				</ol>
			{:else}
				<p class="text-sm text-muted-foreground">
					Paste the code just before the closing <code class="font-mono text-xs text-foreground"
						>&lt;/body&gt;</code
					>
					tag on every page (or in the shared footer template). With Google Tag Manager, add it as a
					<span class="text-foreground">Custom HTML</span> tag that fires on All Pages instead.
				</p>
			{/if}
			{@render codeBlock(tag, section === 'wordpress' ? 'WPCode HTML snippet' : 'Before </body>')}
		</section>
	{/each}

	<details class="group rounded-2xl ring-1 ring-foreground/[0.08]">
		<summary
			class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden"
		>
			<ChevronRightIcon
				class="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
			/>
			Can’t load external scripts? Use the full code
		</summary>
		<div class="grid gap-3 px-4 pb-4 text-sm text-muted-foreground">
			<p>
				Some sites block scripts from other domains. Paste the complete tracker instead, in the same
				place as above. It works the same, but doesn’t update automatically, so prefer the one-line
				code when you can.
			</p>
			<div
				class="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2 ring-1 ring-foreground/10"
			>
				<span class="font-mono text-xs"
					>&lt;script&gt; … full tracker (~25 KB) … &lt;/script&gt;</span
				>
				<CopyButton load={loadInlineCode} label="Copy full code" class="h-7" />
			</div>
		</div>
	</details>

	<p class="text-xs text-muted-foreground">
		After installing, open the website once. Its status changes to
		<span class="font-medium text-emerald-700 dark:text-emerald-300">Active</span> within a minute.
		To see what it records, add <code class="font-mono">?cta_debug=1</code> to a page address and open
		the browser console.
	</p>
</div>
