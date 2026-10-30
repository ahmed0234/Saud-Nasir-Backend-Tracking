<script lang="ts" module>
	// One pop at a time for the whole dashboard; showing a new one replays the animation.
	let pop = $state<{ id: number; detail: string } | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	/** Plays the centred "Deleted" confirmation after a successful delete. */
	export function showDeleted(count: number) {
		clearTimeout(hideTimer);
		pop = {
			id: (pop?.id ?? 0) + 1,
			detail: `${count.toLocaleString('en-US')} ${count === 1 ? 'lead' : 'leads'} removed`
		};
		hideTimer = setTimeout(() => (pop = null), 1700);
	}
</script>

<!--
	Mounted once in the (app) layout. CSS-only (transform/opacity, plus the check's stroke), never
	blocks clicks, and only fades under prefers-reduced-motion.
-->
<div class="sr-only" role="status" aria-live="polite">{pop ? `Deleted. ${pop.detail}.` : ''}</div>

{#if pop}
	{#key pop.id}
		<div
			class="pointer-events-none fixed inset-0 z-[60] grid place-items-center p-4"
			aria-hidden="true"
		>
			<div class="deleted-pop flex flex-col items-center gap-3 rounded-3xl glass px-10 py-7">
				<div class="relative grid size-16 place-items-center">
					<span class="deleted-pop-ring absolute inset-0 rounded-full ring-2 ring-foreground/30"
					></span>
					<span
						class="deleted-pop-badge grid size-16 place-items-center rounded-full bg-foreground text-background shadow-lg"
					>
						<svg viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor">
							<path
								class="deleted-pop-check"
								d="M5 12.5l4.5 4.5L19 7.5"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								pathLength="1"
							/>
						</svg>
					</span>
				</div>
				<div class="text-center">
					<p class="text-lg font-semibold tracking-tight">Deleted</p>
					<p class="text-sm text-muted-foreground">{pop.detail}</p>
				</div>
			</div>
		</div>
	{/key}
{/if}

<style>
	.deleted-pop {
		animation:
			deleted-pop-in 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
			deleted-pop-out 320ms ease-in 1380ms forwards;
	}
	.deleted-pop-badge {
		animation: deleted-pop-badge 560ms cubic-bezier(0.34, 1.56, 0.64, 1) 60ms both;
	}
	.deleted-pop-check {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: deleted-pop-draw 360ms cubic-bezier(0.65, 0, 0.35, 1) 260ms forwards;
	}
	.deleted-pop-ring {
		opacity: 0;
		animation: deleted-pop-ring 700ms cubic-bezier(0.16, 1, 0.3, 1) 220ms;
	}

	@keyframes deleted-pop-in {
		from {
			opacity: 0;
			transform: scale(0.7) translateY(8px);
		}
	}
	@keyframes deleted-pop-out {
		to {
			opacity: 0;
			transform: scale(0.94);
		}
	}
	@keyframes deleted-pop-badge {
		from {
			transform: scale(0.4) rotate(-20deg);
		}
	}
	@keyframes deleted-pop-draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes deleted-pop-ring {
		from {
			opacity: 0.9;
			transform: scale(0.9);
		}
		to {
			opacity: 0;
			transform: scale(1.7);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.deleted-pop {
			animation:
				deleted-pop-fade 150ms linear both,
				deleted-pop-fade 200ms linear 1400ms reverse forwards;
		}
		.deleted-pop-badge,
		.deleted-pop-ring {
			animation: none;
		}
		.deleted-pop-check {
			animation: none;
			stroke-dashoffset: 0;
		}
		@keyframes deleted-pop-fade {
			from {
				opacity: 0;
			}
		}
	}
</style>
