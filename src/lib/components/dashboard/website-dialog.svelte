<script lang="ts" module>
	export type WebsiteDialogRequest =
		{ mode: 'create' } | { mode: 'edit'; key: string } | { mode: 'install'; key: string };

	// One dialog for the whole dashboard (mounted in the (app) layout); anything can open it.
	let request = $state<(WebsiteDialogRequest & { id: number }) | null>(null);
	let nextId = 0;

	export function openWebsiteDialog(next: WebsiteDialogRequest) {
		request = { ...next, id: ++nextId };
	}
</script>

<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import {
		findWebsite,
		hostKey,
		SITE_URL_PARAM,
		WEBSITE_PLATFORMS,
		type Website,
		type WebsitePlatform
	} from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PowerIcon from '@lucide/svelte/icons/power';
	import { enhance } from '$app/forms';
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { fly } from 'svelte/transition';
	import InstallInstructions from './install-instructions.svelte';
	import InstallStatus from './install-status.svelte';

	type FieldErrors = Partial<Record<'name' | 'domain' | 'extraDomains' | 'platform', string>>;
	type Step = 'form' | 'install';

	const action = (name: 'create' | 'update' | 'setDisabled') =>
		`${resolve('/(app)/websites')}?/${name}`;

	let open = $state(false);
	// What the dialog shows. Kept while it closes, so the content doesn't change mid-animation.
	let mode = $state<WebsiteDialogRequest['mode']>('create');
	let step = $state<Step>('form');
	let key = $state<string | null>(null);

	let name = $state('');
	let domain = $state('');
	let extraDomains = $state('');
	let platform = $state<WebsitePlatform>('wordpress');
	let errors = $state<FieldErrors>({});
	let message = $state<string | null>(null);
	let saving = $state(false);
	let confirmingDisable = $state(false);

	const websites = $derived(page.data.websites ?? []);
	const trackerOrigin = $derived(page.data.trackerOrigin ?? page.url.origin);
	const website = $derived(findWebsite(websites, key));

	$effect(() => {
		if (!request) return;
		const next = request;
		request = null;
		mode = next.mode;
		key = next.mode === 'create' ? null : next.key;
		step = next.mode === 'install' ? 'install' : 'form';
		errors = {};
		message = null;
		confirmingDisable = false;
		const existing = next.mode === 'create' ? undefined : findWebsite(websites, next.key);
		if (next.mode !== 'create' && !existing) return;
		fill(existing);
		open = true;
	});

	function fill(existing: Website | undefined) {
		name = existing?.name ?? '';
		platform = existing?.platform ?? 'wordpress';
		if (existing) {
			const host = new URL(existing.url).hostname;
			domain = host;
			extraDomains = existing.domains.filter((d) => d !== hostKey(host)).join('\n');
		} else {
			domain = '';
			extraDomains = '';
		}
	}

	function viewWebsite(siteKey: string) {
		open = false;
		goto(resolve(`?${new URLSearchParams({ [SITE_URL_PARAM]: siteKey })}`));
	}

	const title = $derived(
		mode === 'create'
			? step === 'form'
				? 'Add a website'
				: 'Install the tracking code'
			: mode === 'edit'
				? 'Website settings'
				: 'Install the tracking code'
	);
	const description = $derived(
		mode === 'create' && step === 'form'
			? 'Track calls, bookings, form leads and CTA clicks from another website.'
			: step === 'install'
				? `Add this code to ${website?.name ?? 'the website'} once. Leads appear in the dashboard as soon as visitors use it.`
				: 'Change how this website is named, where it runs and which domains may send leads.'
	);
</script>

<Dialog.Root bind:open={() => open, (next) => (open = saving ? true : next)}>
	<Dialog.Content
		class={cn(
			'max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto glass bg-popover/85 duration-150',
			step === 'install' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
		)}
		escapeKeydownBehavior={saving ? 'ignore' : 'close'}
		interactOutsideBehavior={saving ? 'ignore' : 'close'}
	>
		<div class="flex items-start gap-3 pr-8">
			<span
				class="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground/[0.06] ring-1 ring-foreground/10"
				style:color={website?.accent}
			>
				{#if step === 'install'}
					<CircleCheckIcon class="size-5" />
				{:else}
					<GlobeIcon class="size-5" />
				{/if}
			</span>
			<Dialog.Header class="gap-1 text-left">
				<Dialog.Title class="text-base">{title}</Dialog.Title>
				<Dialog.Description>{description}</Dialog.Description>
			</Dialog.Header>
		</div>

		{#key step}
			<div in:fly={{ y: 6, duration: 180 }} class="grid gap-5">
				{#if step === 'install' && website}
					<div
						class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foreground/[0.03] px-3 py-2 ring-1 ring-foreground/[0.08]"
					>
						<span class="inline-flex min-w-0 items-center gap-2 text-sm">
							<span class="size-2.5 shrink-0 rounded-full" style:background-color={website.accent}
							></span>
							<span class="truncate font-medium">{website.name}</span>
							<span class="truncate text-muted-foreground">{website.domains[0]}</span>
						</span>
						<span class="inline-flex items-center gap-2">
							<InstallStatus {website} />
							<code
								class="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
								title="Site key">{website.key}</code
							>
						</span>
					</div>
					<InstallInstructions {website} {trackerOrigin} />
					<Dialog.Footer>
						{#if mode === 'create'}
							<Button variant="outline" onclick={() => (open = false)}>I’ll do it later</Button>
							<Button onclick={() => viewWebsite(website.key)}>
								Open website dashboard
								<ArrowRightIcon />
							</Button>
						{:else}
							<Button onclick={() => (open = false)}>Done</Button>
						{/if}
					</Dialog.Footer>
				{:else}
					<form
						method="POST"
						action={action(mode === 'create' ? 'create' : 'update')}
						class="grid gap-5"
						novalidate
						use:enhance={() => {
							saving = true;
							message = null;
							return async ({ result }) => {
								try {
									if (result.type === 'success') {
										errors = {};
										await refreshAll();
										if (mode === 'create') {
											const created = result.data?.website as Website | undefined;
											key = created?.key ?? null;
											step = 'install';
											toast.success(`${created?.name ?? 'Website'} added`);
										} else {
											open = false;
											toast.success('Website saved');
										}
									} else if (result.type === 'failure') {
										errors = (result.data?.errors as FieldErrors | undefined) ?? {};
										message = (result.data?.message as string | undefined) ?? null;
									} else if (result.type === 'error') {
										message = 'Something went wrong. Please try again.';
									}
								} finally {
									saving = false;
								}
							};
						}}
					>
						{#if key}<input type="hidden" name="key" value={key} />{/if}

						<div class="grid gap-1.5">
							<Label for="website-name">Website name</Label>
							<Input
								id="website-name"
								name="name"
								bind:value={name}
								placeholder="Roofing Company"
								maxlength={60}
								autocomplete="off"
								aria-invalid={errors.name ? true : undefined}
								aria-describedby={errors.name ? 'website-name-error' : undefined}
							/>
							{#if errors.name}
								<p id="website-name-error" class="text-xs text-destructive">{errors.name}</p>
							{:else}
								<p class="text-xs text-muted-foreground">
									Shown in the sidebar and in lead emails.
								</p>
							{/if}
						</div>

						<div class="grid gap-1.5">
							<Label for="website-domain">Website address</Label>
							<div
								class={cn(
									'flex h-9 items-center overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
									errors.domain && 'border-destructive ring-3 ring-destructive/20'
								)}
							>
								<span class="pl-3 font-mono text-xs text-muted-foreground select-none"
									>https://</span
								>
								<input
									id="website-domain"
									name="domain"
									bind:value={domain}
									placeholder="www.roofingco.com"
									autocomplete="off"
									autocapitalize="off"
									spellcheck="false"
									inputmode="url"
									class="h-full min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
									aria-invalid={errors.domain ? true : undefined}
									aria-describedby={errors.domain ? 'website-domain-error' : undefined}
								/>
							</div>
							{#if errors.domain}
								<p id="website-domain-error" class="text-xs text-destructive">{errors.domain}</p>
							{:else}
								<p class="text-xs text-muted-foreground">
									Only pages on this domain (with or without www.) can send leads.
								</p>
							{/if}
						</div>

						{#if mode === 'edit'}
							<div class="grid gap-1.5">
								<Label for="website-extra-domains">
									Other domains <span class="font-normal text-muted-foreground">(optional)</span>
								</Label>
								<Textarea
									id="website-extra-domains"
									name="extraDomains"
									bind:value={extraDomains}
									rows={2}
									placeholder="staging.roofingco.com, roofing-co.net"
									class="font-mono text-xs"
									aria-invalid={errors.extraDomains ? true : undefined}
								/>
								{#if errors.extraDomains}
									<p class="text-xs text-destructive">{errors.extraDomains}</p>
								{:else}
									<p class="text-xs text-muted-foreground">
										Separated by commas or new lines, e.g. a staging site.
									</p>
								{/if}
							</div>
						{/if}

						<fieldset class="grid gap-1.5">
							<legend class="mb-1.5 text-sm font-medium">Platform</legend>
							<div class="grid gap-2 sm:grid-cols-3">
								{#each WEBSITE_PLATFORMS as option (option.value)}
									<label
										class={cn(
											'relative grid cursor-pointer gap-0.5 rounded-xl px-3 py-2.5 ring-1 transition-[background-color,box-shadow] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
											platform === option.value
												? 'bg-foreground/[0.06] ring-foreground/40'
												: 'ring-foreground/10 hover:bg-foreground/[0.03]'
										)}
									>
										<input
											type="radio"
											name="platform"
											value={option.value}
											bind:group={platform}
											class="sr-only"
										/>
										<span class="text-sm font-medium">{option.label}</span>
										<span class="text-xs text-muted-foreground">{option.hint}</span>
										{#if platform === option.value}
											<CircleCheckIcon
												class="absolute top-2 right-2 size-3.5 animate-in duration-150 zoom-in-50"
											/>
										{/if}
									</label>
								{/each}
							</div>
							{#if errors.platform}<p class="text-xs text-destructive">{errors.platform}</p>{/if}
						</fieldset>

						{#if message}
							<p
								class="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20"
								role="alert"
							>
								<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
								{message}
							</p>
						{/if}

						<Dialog.Footer>
							<Button variant="outline" onclick={() => (open = false)} disabled={saving}>
								Cancel
							</Button>
							<Button type="submit" disabled={saving} aria-busy={saving}>
								{#if saving}
									<Loader2Icon class="animate-spin" />
									{mode === 'create' ? 'Adding…' : 'Saving…'}
								{:else if mode === 'create'}
									<PlusIcon />
									Add website
								{:else}
									Save changes
								{/if}
							</Button>
						</Dialog.Footer>
					</form>

					{#if mode === 'edit' && website}
						<div class="grid gap-3 border-t border-foreground/10 pt-4">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="space-y-0.5">
									<p class="text-sm font-medium">
										{website.disabled ? 'Tracking is disabled' : 'Disable tracking'}
									</p>
									<p class="text-xs text-muted-foreground">
										{website.disabled
											? 'New events from this website are rejected. Its leads are kept.'
											: 'Stops new leads at once. Existing leads and analytics are kept.'}
									</p>
								</div>
								<form
									method="POST"
									action={action('setDisabled')}
									use:enhance={() => {
										saving = true;
										const disabling = !website.disabled;
										return async ({ result }) => {
											try {
												if (result.type === 'success') {
													await refreshAll();
													confirmingDisable = false;
													toast.success(disabling ? 'Tracking disabled' : 'Tracking enabled');
												} else {
													toast.error('Couldn’t change the website', {
														description:
															result.type === 'failure'
																? String(result.data?.message ?? '')
																: 'Please try again.'
													});
												}
											} finally {
												saving = false;
											}
										};
									}}
								>
									<input type="hidden" name="key" value={website.key} />
									<input type="hidden" name="disabled" value={String(!website.disabled)} />
									{#if website.disabled}
										<Button type="submit" variant="outline" size="sm" disabled={saving}>
											<PowerIcon />
											Enable tracking
										</Button>
									{:else if confirmingDisable}
										<span class="flex items-center gap-1.5">
											<Button
												variant="ghost"
												size="sm"
												onclick={() => (confirmingDisable = false)}
												disabled={saving}>Keep</Button
											>
											<Button type="submit" variant="destructive" size="sm" disabled={saving}>
												{#if saving}<Loader2Icon class="animate-spin" />{:else}<PowerIcon />{/if}
												Confirm disable
											</Button>
										</span>
									{:else}
										<Button
											variant="outline"
											size="sm"
											class="hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
											onclick={() => (confirmingDisable = true)}
										>
											<PowerIcon />
											Disable
										</Button>
									{/if}
								</form>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/key}
	</Dialog.Content>
</Dialog.Root>
