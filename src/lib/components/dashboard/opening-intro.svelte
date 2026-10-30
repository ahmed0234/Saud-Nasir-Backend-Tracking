<!--
	Opening animation shown whenever the dashboard is opened or reloaded (and right after signing
	in, where it continues the login page's veil). Pure CSS on server-rendered markup: it starts at
	first paint, hydration keeps the same element so it never restarts, client-side navigation
	inside the dashboard never remounts it, and the dashboard renders underneath the whole time.
	Only transform and opacity are animated, so it stays on the compositor.
-->
<script lang="ts">
	import { SITES } from '#lib/sites.ts';

	const [accentA, accentB, accentC] = SITES.map((site) => site.accent);
</script>

<div
	aria-hidden="true"
	class="intro pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-background"
	style:--accent-a={accentA}
	style:--accent-b={accentB}
	style:--accent-c={accentC}
>
	<div
		class="intro-glow absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--accent-a)_0%,transparent_30%),radial-gradient(circle_at_58%_44%,var(--accent-b)_0%,transparent_26%),radial-gradient(circle_at_44%_58%,var(--accent-c)_0%,transparent_24%)]"
	></div>
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(circle_at_center,black_0%,transparent_45%)] bg-[size:48px_48px] opacity-50"
	></div>

	<div class="intro-ring col-start-1 row-start-1 size-[34vmin]"></div>

	<div class="intro-mark relative col-start-1 row-start-1 flex flex-col items-center gap-4">
		<span
			class="grid size-14 place-items-center rounded-2xl bg-foreground text-background shadow-lg ring-1 ring-foreground/10"
		>
			<svg
				viewBox="0 0 24 24"
				class="size-7"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				shape-rendering="geometricPrecision"
			>
				<path
					class="intro-pulse"
					pathLength="1"
					d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
				/>
			</svg>
		</span>
		<span class="flex flex-col items-center gap-2">
			<span class="text-sm font-semibold tracking-tight">Lead Tracking</span>
			<span class="intro-line h-px w-24 rounded-full"></span>
		</span>
	</div>
</div>

<style>
	/* Timeline (900ms): mark settles in → pulse draws → ring blooms → overlay dissolves. */
	.intro {
		animation: intro-out 320ms cubic-bezier(0.4, 0, 0.2, 1) 580ms forwards;
	}

	.intro-glow {
		opacity: 0;
		animation: intro-glow 900ms ease-out forwards;
	}

	.intro-mark {
		animation:
			intro-mark-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both,
			intro-mark-out 320ms cubic-bezier(0.4, 0, 0.2, 1) 580ms forwards;
	}

	.intro-pulse {
		stroke-dasharray: 1 1.1;
		/* Draws from the path's end (left to right); the extra gap hides the round cap's dot at the start. */
		stroke-dashoffset: -1.05;
		animation: intro-draw 520ms cubic-bezier(0.65, 0, 0.35, 1) 90ms forwards;
	}

	.intro-line {
		background: linear-gradient(to right, var(--accent-a), var(--accent-b), var(--accent-c));
		transform: scaleX(0);
		animation: intro-line 480ms cubic-bezier(0.65, 0, 0.35, 1) 160ms forwards;
	}

	.intro-ring {
		border-radius: 9999px;
		background: conic-gradient(var(--accent-a), var(--accent-b), var(--accent-c), var(--accent-a));
		mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px));
		opacity: 0;
		animation: intro-ring 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 280ms forwards;
	}

	@keyframes intro-out {
		to {
			opacity: 0;
			visibility: hidden;
		}
	}

	@keyframes intro-glow {
		40% {
			opacity: 0.14;
		}
		to {
			opacity: 0.06;
		}
	}

	@keyframes intro-mark-in {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.92);
		}
	}

	@keyframes intro-mark-out {
		to {
			opacity: 0;
			transform: scale(1.06);
		}
	}

	@keyframes intro-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes intro-line {
		to {
			transform: scaleX(1);
		}
	}

	@keyframes intro-ring {
		from {
			transform: scale(0.35);
		}
		25% {
			opacity: 0.9;
		}
		to {
			opacity: 0;
			transform: scale(2.4);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.intro {
			display: none;
		}
	}
</style>
