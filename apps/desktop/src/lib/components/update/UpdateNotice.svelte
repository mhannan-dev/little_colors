<script lang="ts">
	/**
	 * Shown on the home screen only when a new version exists (never during a game).
	 * A grown-up confirms by pressing and holding for 2 seconds, so a child's tap cannot
	 * start a download. No internet means this never appears (OF-06).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { availableUpdate, checkForUpdateQuietly, installUpdate, updateDismissed, updatePhase } from '#lib/platform/updates.ts';
	import { settings } from '#lib/stores/settings.ts';

	const HOLD_MS = 2000;
	const bn = $derived($settings.language === 'bn-BD');

	let holding = $state(0);
	const phase = $derived($updatePhase);
	let progress = $state(0);
	let raf = 0;
	let holdStart = 0;

	function startHold(e: PointerEvent | KeyboardEvent) {
		if (phase !== 'offer') return;
		// One hold at a time: a second finger or Enter during a mouse hold must not start another timer.
		if (e instanceof PointerEvent && !e.isPrimary) return;
		if (holding > 0) return;
		if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
		if (e instanceof KeyboardEvent && e.repeat) return;
		e.preventDefault();
		holdStart = performance.now();
		const step = () => {
			holding = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
			if (holding >= 1) {
				void install();
				return;
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}
	function stopHold() {
		cancelAnimationFrame(raf);
		raf = 0;
		if (phase === 'offer') holding = 0;
	}
	async function install() {
		cancelAnimationFrame(raf);
		if (phase !== 'offer') return;
		progress = 0;
		await installUpdate((f) => (progress = f));
	}

	onMount(() => {
		// Look a little after start-up so it never slows the first screen.
		const t = setTimeout(() => void checkForUpdateQuietly(), 3000);
		if (import.meta.env.DEV) {
			// Lets e2e tests show the notice without a real release.
			(window as unknown as { __lcFakeUpdate?: (fail?: boolean) => void }).__lcFakeUpdate = (fail = false) =>
				availableUpdate.set({
					version: '9.9.9',
					notes: '',
					install: async (onProgress) => {
						onProgress(0.5);
						if (fail) throw new Error('download failed');
						onProgress(1);
					}
				});
		}
		return () => clearTimeout(t);
	});
	onDestroy(() => cancelAnimationFrame(raf));
</script>

{#if $availableUpdate && !$updateDismissed}
	<div class="update" role="region" aria-label={bn ? 'নতুন আপডেট' : 'New update'} data-testid="update-notice">
		<span class="gift" aria-hidden="true">🎁</span>
		<div class="text">
			<strong>{bn ? 'নতুন খেলা এসেছে!' : 'New games are here!'}</strong>
			<small>
				{#if phase === 'downloading'}
					{bn ? 'আপডেট নামছে… শেষ হলে অ্যাপ আবার খুলবে।' : 'Downloading… the app will restart when done.'}
				{:else if phase === 'failed'}
					{bn ? 'এখন আপডেট হলো না। পরে আবার চেষ্টা করবো।' : 'The update did not finish. We will try again later.'}
				{:else}
					{bn ? `ভার্সন ${$availableUpdate.version} · বড়রা বোতামটা চেপে ধরে রাখুন` : `Version ${$availableUpdate.version} · Grown-ups: press and hold`}
				{/if}
			</small>
			{#if phase === 'downloading'}
				<div class="bar" aria-hidden="true"><span style:width="{Math.round(progress * 100)}%"></span></div>
			{/if}
		</div>
		{#if phase === 'offer'}
			<button
				class="hold"
				data-testid="update-hold"
				style:--hold={holding}
				aria-label={bn ? 'আপডেট করি (চেপে ধরে রাখুন)' : 'Update (press and hold)'}
				onpointerdown={startHold}
				onpointerup={stopHold}
				onpointerleave={stopHold}
				onpointercancel={stopHold}
				onkeydown={startHold}
				onkeyup={stopHold}
			>
				<span class="fill" aria-hidden="true"></span>
				<span class="label">⬇ {bn ? 'আপডেট করি' : 'Update'}</span>
			</button>
		{/if}
		{#if phase !== 'downloading'}
			<button class="later" onclick={() => updateDismissed.set(true)}>{bn ? 'পরে' : 'Later'}</button>
		{/if}
	</div>
{/if}

<style>
	.update {
		position: fixed;
		right: 20px;
		bottom: 20px;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: min(560px, calc(100vw - 40px));
		padding: 12px 14px;
		border: 2px solid #c9d8c2;
		border-radius: 18px;
		background: var(--surface);
		box-shadow: 0 10px 30px #0002;
	}
	.gift {
		font-size: 30px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	strong {
		font-size: 18px;
	}
	small {
		font-size: 14px;
		color: var(--text-secondary);
	}
	.bar {
		height: 8px;
		margin-top: 6px;
		border-radius: 4px;
		background: #dfe8da;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: #3f8f5f;
		transition: width 200ms linear;
	}
	button {
		min-height: 48px;
		padding: 6px 14px;
		border: 2px solid var(--border-soft);
		border-radius: 13px;
		background: var(--surface);
		font-weight: 600;
		font-size: 16px;
		cursor: pointer;
	}
	.hold {
		position: relative;
		overflow: hidden;
		border-color: #2f6f49;
		color: #ffffff;
		background: #3f8f5f;
		touch-action: none;
		user-select: none;
	}
	.hold .fill {
		position: absolute;
		inset: 0;
		background: #2a6b44;
		transform-origin: left;
		transform: scaleX(var(--hold));
	}
	.hold .label {
		position: relative;
	}
</style>
