<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { enhance } from '$app/forms';
	import type { ActionResult } from '$app/forms';

	// Asks before a permanent delete, then posts `fields` to the form action `action`. Stays open
	// (and can't be dismissed) while the request runs; `onresult` decides what happens next.
	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Delete',
		action,
		fields,
		onresult
	}: {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		/** Form action URL, e.g. `?/deleteLeads`. */
		action: string;
		/** Hidden form fields; repeated names are allowed. */
		fields: [name: string, value: string][];
		onresult: (result: ActionResult) => void | Promise<void>;
	} = $props();

	let busy = $state(false);
</script>

<Dialog.Root bind:open={() => open, (next) => (open = busy ? true : next)}>
	<Dialog.Content
		showCloseButton={false}
		class="gap-5 glass bg-popover/80 sm:max-w-md"
		escapeKeydownBehavior={busy ? 'ignore' : 'close'}
		interactOutsideBehavior={busy ? 'ignore' : 'close'}
	>
		<div class="flex items-start gap-4">
			<span
				class="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20"
			>
				<Trash2Icon class="size-5" />
			</span>
			<Dialog.Header class="gap-1.5 text-left">
				<Dialog.Title>{title}</Dialog.Title>
				<Dialog.Description>{description}</Dialog.Description>
			</Dialog.Header>
		</div>
		<form
			method="POST"
			{action}
			use:enhance={() => {
				busy = true;
				return async ({ result }) => {
					try {
						await onresult(result);
					} finally {
						busy = false;
					}
				};
			}}
		>
			{#each fields as [name, value], index (index)}
				<input type="hidden" {name} {value} />
			{/each}
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (open = false)} disabled={busy}>Cancel</Button>
				<Button
					type="submit"
					class="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30"
					disabled={busy}
					aria-busy={busy}
				>
					{#if busy}
						<Loader2Icon class="animate-spin" />
						Deleting…
					{:else}
						<Trash2Icon />
						{confirmLabel}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
