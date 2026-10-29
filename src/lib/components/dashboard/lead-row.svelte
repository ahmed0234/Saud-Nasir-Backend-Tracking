<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { formatDateTime, formatUtc, splitUrl } from '#lib/format.ts';
	import type { RecentClick } from '#lib/server/analytics.ts';
	import { buttonTypeLabel, EVENT_TYPE_LABELS, getSite, isEventType } from '#lib/sites.ts';
	import { cn } from '#lib/utils.js';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import type { Component } from 'svelte';

	let {
		lead,
		timeZone,
		showSite
	}: {
		lead: RecentClick;
		timeZone: string;
		/** Show which website the lead came from (when viewing all websites). */
		showSite: boolean;
	} = $props();

	const ICONS: Record<string, Component<{ class?: string }>> = {
		call: PhoneIcon,
		sms: MessageSquareIcon,
		email: MailIcon,
		booking: CalendarCheckIcon
	};

	const isForm = $derived(lead.eventType === 'form_submit');
	const Icon = $derived(
		isForm ? ClipboardListIcon : (ICONS[lead.buttonType ?? ''] ?? MousePointerClickIcon)
	);
	const site = $derived(getSite(lead.site));
	const url = $derived(splitUrl(lead.pageUrl));
	const kind = $derived(isEventType(lead.eventType) ? EVENT_TYPE_LABELS[lead.eventType] : 'Lead');
	const buttonLabel = $derived(buttonTypeLabel(lead.buttonType));
	const title = $derived(lead.buttonText ?? (isForm ? lead.formName : null) ?? buttonLabel ?? kind);
	const location = $derived([lead.city, lead.state].filter(Boolean).join(', '));
</script>

<div
	class="group/lead grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl bg-foreground/[0.025] px-3 py-3 ring-1 ring-foreground/[0.07] transition-[background-color,box-shadow] duration-200 hover:bg-foreground/[0.05] hover:ring-foreground/15 sm:px-4 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto]"
>
	<span
		class={cn(
			'grid size-9 place-items-center rounded-lg ring-1',
			isForm
				? 'bg-foreground text-background ring-foreground'
				: 'bg-foreground/[0.06] text-foreground ring-foreground/10'
		)}
		title={kind}
	>
		<Icon class="size-4" />
	</span>

	<div class="min-w-0 space-y-1">
		<div class="flex min-w-0 items-center gap-2">
			<p class="truncate text-sm font-medium" {title}>{title}</p>
			<Badge
				variant={isForm ? 'default' : 'outline'}
				class="hidden shrink-0 text-[11px] sm:inline-flex">{kind}</Badge
			>
		</div>
		<p class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
			{#if showSite}
				<span
					class="size-1.5 shrink-0 rounded-full"
					style:background-color={site?.accent ?? 'var(--muted-foreground)'}
				></span>
				<span class="shrink-0">{site?.name ?? url.host}</span>
				<span aria-hidden="true">·</span>
			{/if}
			{#if buttonLabel}<span class="shrink-0">{buttonLabel}</span>{/if}
			{#if isForm && lead.formName && lead.formName !== title}
				<span aria-hidden="true">·</span><span class="truncate">{lead.formName}</span>
			{/if}
		</p>
	</div>

	<div class="col-span-2 min-w-0 md:col-span-1">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external WordPress page -->
		<a
			href={lead.pageUrl}
			target="_blank"
			rel="noopener noreferrer"
			title={lead.pageUrl}
			class="group/link flex min-w-0 items-center gap-1 text-sm"
		>
			<span class="truncate font-mono text-xs group-hover/link:underline">
				{lead.pagePath ?? url.path}
			</span>
			<ArrowUpRightIcon
				class="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100"
			/>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{#if !showSite || !site}
			<p class="truncate text-xs text-muted-foreground">{url.host}</p>
		{/if}
	</div>

	<div
		class="col-span-2 flex items-center justify-between gap-3 text-xs text-muted-foreground md:col-span-1 md:flex-col md:items-end md:justify-center md:gap-1"
	>
		<span class="inline-flex items-center gap-1">
			<MapPinIcon class="size-3" />{location || 'Unknown location'}
		</span>
		<time datetime={lead.clickedAt} title={formatUtc(lead.clickedAt)} class="tabular-nums">
			{formatDateTime(lead.clickedAt, timeZone)}
		</time>
	</div>
</div>
