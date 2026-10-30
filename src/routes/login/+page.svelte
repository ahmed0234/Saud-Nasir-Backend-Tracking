<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { ACCENT_PALETTE } from '#lib/sites.ts';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { applyAction, enhance } from '$app/forms';
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Long enough for the opening animation in layout.css (login-veil) to cover the screen.
	const OPENING_MS = 650;

	let submitting = $state(false);
	let opening = $state(false);
	let showPassword = $state(false);
	// Bumped on each failed attempt so the card's shake replays even for the same error.
	let attempt = $state(0);
	let passwordInput = $state<HTMLInputElement | null>(null);

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/');
	const [blobA, blobB, blobC] = ACCENT_PALETTE;
</script>

<svelte:head>
	<title>Sign in · Lead Tracking</title>
</svelte:head>

<div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
	<div
		class="login-blob absolute -top-32 -left-24 size-[26rem] opacity-30 dark:opacity-25"
		style:background-color={blobA}
	></div>
	<div
		class="login-blob absolute top-1/3 -right-32 size-[30rem] opacity-25 [animation-delay:-6s] dark:opacity-20"
		style:background-color={blobB}
	></div>
	<div
		class="login-blob absolute -bottom-40 left-1/4 size-[24rem] opacity-25 [animation-delay:-12s] dark:opacity-20"
		style:background-color={blobC}
	></div>
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)] bg-[size:48px_48px] opacity-40"
	></div>
</div>

<main class="grid min-h-svh place-items-center px-4 py-10">
	<div class="w-full max-w-sm">
		{#key attempt}
			<div
				class={[
					'rounded-3xl glass p-6 sm:p-8',
					attempt > 0 && 'login-shake',
					opening && 'login-card-out'
				]}
			>
				<div class="mb-7 flex flex-col items-center gap-3 text-center">
					<span
						class="grid size-11 place-items-center rounded-xl bg-foreground text-background shadow-sm"
					>
						<ActivityIcon class="size-5" />
					</span>
					<div class="space-y-1">
						<h1 class="text-xl font-semibold tracking-tight">Lead Tracking</h1>
						<p class="text-sm text-muted-foreground">Sign in to view your dashboard.</p>
					</div>
				</div>

				<form
					method="POST"
					class="space-y-4"
					use:enhance={() => {
						submitting = true;
						return async ({ result }) => {
							if (result.type === 'redirect') {
								// Signed in: play the opening animation while the dashboard's data loads,
								// then navigate once both are done.
								opening = true;
								await Promise.all([
									preloadData(result.location).catch(() => {}),
									new Promise((done) =>
										setTimeout(done, prefersReducedMotion.current ? 0 : OPENING_MS)
									)
								]);
								try {
									// eslint-disable-next-line svelte/no-navigation-without-resolve -- server-validated same-origin path
									await goto(result.location, { replace: true });
								} catch {
									// The session cookie is already set, so a full page load always gets there.
									location.replace(result.location);
								}
								return;
							}
							submitting = false;
							await applyAction(result);
							if (result.type === 'failure') {
								attempt += 1;
								await tick();
								passwordInput?.focus();
							}
						};
					}}
				>
					<input type="hidden" name="redirectTo" value={redirectTo} />

					<div class="space-y-2">
						<Label for="username">Username</Label>
						<Input
							id="username"
							name="username"
							autocomplete="username"
							autocapitalize="none"
							spellcheck={false}
							required
							value={form?.username ?? ''}
							aria-invalid={form?.message ? true : undefined}
							aria-describedby={form?.message ? 'login-error' : undefined}
							class="h-10 bg-background/60"
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<div class="relative">
							<Input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								autocomplete="current-password"
								required
								bind:ref={passwordInput}
								aria-invalid={form?.message ? true : undefined}
								aria-describedby={form?.message ? 'login-error' : undefined}
								class="h-10 bg-background/60 pr-10"
							/>
							<button
								type="button"
								class="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								aria-pressed={showPassword}
								onclick={() => (showPassword = !showPassword)}
							>
								{#if showPassword}
									<EyeOffIcon class="size-4" />
								{:else}
									<EyeIcon class="size-4" />
								{/if}
							</button>
						</div>
					</div>

					{#if form?.message}
						<p
							id="login-error"
							role="alert"
							class="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20"
						>
							<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
							{form.message}
						</p>
					{:else if !data.configured}
						<p
							role="status"
							class="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground"
						>
							<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
							Sign-in is not set up on the server yet.
						</p>
					{/if}

					<Button type="submit" size="lg" class="w-full" disabled={submitting}>
						{#if opening}
							<CheckIcon class="login-pop" /> Welcome back
						{:else if submitting}
							<Loader2Icon class="animate-spin" /> Signing in…
						{:else}
							<LockIcon /> Sign in
						{/if}
					</Button>
				</form>
			</div>
		{/key}

		<p class="mt-6 text-center text-xs text-muted-foreground">
			Private dashboard · authorized access only
		</p>
	</div>
</main>

{#if opening}
	<!-- Opening animation: an accent ring and a background-coloured disc expand from the centre,
	     and the dashboard then fades in on top of a clean screen. -->
	<div aria-hidden="true" class="pointer-events-none fixed inset-0 z-50 grid place-items-center">
		<div
			class="login-ring col-start-1 row-start-1 size-[40vmax]"
			style:--ring-a={blobA}
			style:--ring-b={blobB}
			style:--ring-c={blobC}
		></div>
		<div class="login-veil col-start-1 row-start-1 size-[12vmax] bg-background"></div>
	</div>
{/if}

<style>
	.login-blob {
		border-radius: 9999px;
		filter: blur(64px);
		will-change: transform;
		animation: login-drift 18s ease-in-out infinite alternate;
	}

	.login-shake {
		animation: login-shake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}

	.login-card-out {
		animation: login-card-out 420ms cubic-bezier(0.4, 0, 0.2, 1) 120ms forwards;
	}

	:global(.login-pop) {
		animation: login-pop 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.login-ring {
		border-radius: 9999px;
		background: conic-gradient(var(--ring-a), var(--ring-b), var(--ring-c), var(--ring-a));
		mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
		opacity: 0;
		animation: login-ring 650ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}

	/* 12vmax scaled 13x covers the viewport diagonal (at most ~142vmax) on any screen. */
	.login-veil {
		border-radius: 9999px;
		transform: scale(0);
		animation: login-veil 540ms cubic-bezier(0.65, 0, 0.35, 1) 110ms forwards;
	}

	@keyframes login-drift {
		to {
			transform: translate3d(3rem, 2rem, 0) scale(1.08);
		}
	}

	@keyframes login-shake {
		20%,
		60% {
			transform: translateX(-6px);
		}
		40%,
		80% {
			transform: translateX(6px);
		}
	}

	@keyframes login-card-out {
		to {
			opacity: 0;
			transform: scale(0.96);
		}
	}

	@keyframes login-pop {
		from {
			transform: scale(0);
		}
	}

	@keyframes login-ring {
		from {
			transform: scale(0.15);
		}
		30% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: scale(2.6);
		}
	}

	@keyframes login-veil {
		to {
			transform: scale(13);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.login-blob,
		.login-shake,
		.login-card-out,
		:global(.login-pop) {
			animation: none;
		}
		.login-ring {
			display: none;
		}
		.login-veil {
			animation: none;
			transform: scale(13);
		}
	}
</style>
