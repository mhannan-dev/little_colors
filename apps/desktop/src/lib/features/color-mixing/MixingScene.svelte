<script lang="ts">
	/**
	 * Spec 05 — Color Mixing screen. All rules come from @little-colors/core (AR-01, AR-03):
	 * this component only renders machine state and executes its effect descriptors.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		COLOR_NAMES,
		createMixingMachine,
		createMixingRound,
		recipeForResult,
		type Color,
		type MixingActivity,
		type MixingContext,
		type MixingEffect,
		type MixingMachine,
		type MixingState
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import Football from '#lib/components/football/Football.svelte';
	import PaintContainer from '#lib/components/paint/PaintContainer.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, replayInstruction, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	const LOCKED: MixingState[] = [
		'FIRST_COLOR_SELECTED',
		'SECOND_COLOR_SELECTED',
		'MIXING',
		'RESULT',
		'CELEBRATING'
	];

	const d = durations();
	const scheduler = createScheduler();

	let round = $state(createMixingRound($settings.difficulty, Date.now() >>> 0));
	let index = $state(0);
	let roundDone = $state(false);

	let machine: MixingMachine | null = null;
	let unsubscribers: (() => void)[] = [];

	let mState = $state<MixingState>('READY');
	let ctx = $state<MixingContext | null>(null);

	// Purely visual state driven by effects.
	let mascot = $state<MascotAnimation>('idle');
	let pouring = $state<Color | null>(null);
	let mixTo = $state<Color | null>(null);
	let wrongColor = $state<Color | null>(null);
	let wiggleColor = $state<Color | null>(null);
	let kicked = $state(false);
	let cancelWrongResult: (() => void) | null = null;

	const activity = $derived<MixingActivity | undefined>(round.activities[index]);
	const locked = $derived(LOCKED.includes(mState));
	const lang = $derived($settings.language);

	const ballColor = $derived.by<Color | 'white'>(() => {
		if (wrongColor) return wrongColor;
		if (mixTo) return mixTo;
		if (mState === 'FIRST_COLOR_SELECTED' && ctx?.first) return ctx.first;
		return ctx?.footballColor ?? 'white';
	});

	const ballLabel = $derived(
		ballColor === 'white'
			? lang === 'bn-BD' ? 'সাদা ফুটবল' : 'White football'
			: lang === 'bn-BD'
				? `${COLOR_NAMES[ballColor].bn} ফুটবল`
				: `${COLOR_NAMES[ballColor].en} football`
	);

	const colorName = (c: Color) => (lang === 'bn-BD' ? COLOR_NAMES[c].bn : COLOR_NAMES[c].en);

	function clearVisuals() {
		pouring = null;
		mixTo = null;
		wrongColor = null;
		wiggleColor = null;
		kicked = false;
		mascot = 'idle';
	}

	function runEffect(effect: MixingEffect) {
		const m = machine;
		if (!m) return;
		switch (effect.type) {
			case 'pour':
				// A new pour ends any wrong-result display, so the ball shows the poured colour.
				cancelWrongResult?.();
				cancelWrongResult = null;
				wrongColor = null;
				pouring = effect.color;
				mascot = 'thinking';
				scheduler.after(d.pour, () => {
					pouring = null;
					m.send({ type: 'POUR_DONE' });
				});
				break;
			case 'mix':
				mixTo = effect.to;
				scheduler.after(d.mix, () => {
					m.send({ type: 'MIX_DONE' });
					mixTo = null;
				});
				break;
			case 'narrate':
				say(effect.key);
				break;
			case 'wiggle':
				wiggleColor = effect.color;
				scheduler.after(d.wiggle, () => (wiggleColor = null));
				break;
			case 'showWrongResult':
				wrongColor = effect.color;
				mascot = 'encourage';
				cancelWrongResult = scheduler.after(d.wrongResult, () => {
					cancelWrongResult = null;
					wrongColor = null;
					mascot = 'idle';
				});
				break;
			case 'celebrate':
				mascot = 'kick';
				scheduler.after(d.reduced ? 0 : 350, () => (kicked = true));
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'complete':
				mascot = 'celebrate';
				say('feedback.celebrate');
				break;
			case 'cancelAll':
				scheduler.cancelAll();
				stopNarration();
				clearVisuals();
				break;
			case 'next':
				break;
		}
	}

	function load(a: MixingActivity) {
		teardown();
		clearVisuals();
		const m = createMixingMachine({ offered: a.offered, target: a.target });
		machine = m;
		let prev: MixingState | null = null;
		unsubscribers = [
			m.subscribe((s, c) => {
				mState = s;
				ctx = c;
				if (s === 'READY' && prev !== null && prev !== 'READY' && !wrongColor) mascot = 'idle';
				// RESULT → CELEBRATING after a minimum display time; never waits for narration (CM-14).
				if (s === 'RESULT' && prev !== 'RESULT') {
					mascot = 'celebrate';
					// The machine enforces the minimum display time itself (clock guard);
					// retry briefly if a timer fires a hair early.
					const tryAdvance = () => {
						if (m.state === 'RESULT' && !m.send({ type: 'RESULT_SHOWN' })) {
							scheduler.after(50, tryAdvance);
						}
					};
					scheduler.after(d.resultMin, tryAdvance);
				}
				if (s === 'COMPLETE' && prev !== 'COMPLETE') setIdlePrompt('ui.tap-next');
				if (s !== 'READY' && s !== 'FIRST_COLOR_APPLIED') hideHand();
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		instruct(a.instructionKey);
		// First visit: the ghost hand taps the two pots once to show what to do (PR-25).
		if (firstTime('mixing')) {
			// On Advanced three pots are offered: demonstrate the recipe for the target, not two random pots.
			const pair = a.target ? (recipeForResult(a.target)?.inputs ?? a.offered.slice(0, 2)) : a.offered;
			const pots = pair.map((c) => `.paint[data-color="${c}"]`);
			scheduler.after(1400, () => showHand(pots));
		}
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	function select(color: Color) {
		machine?.send({ type: 'SELECT_COLOR', color });
	}

	function next() {
		if (index + 1 >= round.activities.length) {
			roundDone = true;
			setIdlePrompt(null); // no green arrow on the round-complete screen
			mascot = 'celebrate';
			say('feedback.completed', { interrupt: true });
			return;
		}
		index += 1;
		load(round.activities[index]!);
	}

	function replayRound() {
		round = createMixingRound($settings.difficulty, (Date.now() + 1) >>> 0);
		index = 0;
		roundDone = false;
		load(round.activities[0]!);
	}

	function reset() {
		machine?.send({ type: 'RESET' });
		if (activity) instruct(activity.instructionKey);
	}

	onMount(() => {
		if (activity) load(activity);
	});

	// CM-16 / OF-11: pause freezes timers without changing state.
	const offPause = paused.subscribe((p) => {
		if (p) {
			scheduler.pause();
			stopNarration();
		} else {
			scheduler.resume();
		}
	});

	onDestroy(() => {
		offPause();
		teardown();
		hideHand();
		leaveScreen();
	});
</script>

<TopBar onreplay={replayInstruction} />

<section class="scene" class:paused={$paused}>
	{#if roundDone}
		<div class="done">
			<Mascot state="celebrate" size={240} />
			<div class="actions">
				<GameButton action="replay" onclick={replayRound} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else if activity && ctx}
		<div class="progress" aria-hidden="true">
			{#each round.activities as a, i (a.id)}
				<span class="dot" class:filled={i < index || (i === index && mState === 'COMPLETE')}></span>
			{/each}
		</div>

		<div class="field">
			<div class="mascot"><Mascot state={mascot} size={220} /></div>
			<div class="ball-wrap">
				<Football
					color={ballColor}
					mixing={mixTo !== null}
					{kicked}
					dropColor={pouring}
					transitionMs={mixTo ? d.mix : d.pour}
					label={ballLabel}
				/>
			</div>
			<div class="goal" class:scored={kicked} aria-hidden="true">
				<svg viewBox="0 0 120 140" width="150" height="175">
					<path d="M10 135 V12 H110 V135" fill="none" stroke="var(--text-primary)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M10 40 H110 M10 70 H110 M10 100 H110 M37 12 V135 M63 12 V135 M90 12 V135" stroke="var(--border-soft)" stroke-width="3" />
				</svg>
			</div>
		</div>

		<div class="bottom">
			{#if mState === 'COMPLETE'}
				<GameButton action="next" onclick={next} />
			{:else}
				<div class="paints">
					{#each ctx.offered as c (c)}
						<PaintContainer
							color={c}
							label={colorName(c)}
							used={ctx.first === c || ctx.second === c}
							{locked}
							wiggle={wiggleColor === c}
							pouring={pouring === c}
							onselect={select}
						/>
					{/each}
				</div>
				{#if ctx.first && !locked}
					<GameButton action="reset" size="small" onclick={reset} />
				{/if}
			{/if}
		</div>
	{/if}
</section>

<style>
	.scene {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px 32px;
		min-height: 0;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.progress {
		display: flex;
		gap: 12px;
	}
	.dot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
	}
	.dot.filled {
		background: var(--text-secondary);
	}
	.field {
		flex: 1;
		width: min(1100px, 100%);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		gap: 24px;
		padding-bottom: 12px;
	}
	.mascot {
		justify-self: end;
	}
	.ball-wrap {
		align-self: end;
	}
	.goal {
		justify-self: start;
		transition: transform 400ms ease;
	}
	.goal.scored {
		transform: scale(1.06);
	}
	.bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		min-height: 200px;
		justify-content: center;
	}
	.paints {
		display: flex;
		gap: 32px;
	}
	.done {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32px;
	}
	.actions {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		justify-content: center;
	}
	@media (max-height: 700px) {
		.bottom {
			min-height: 160px;
		}
	}
</style>
