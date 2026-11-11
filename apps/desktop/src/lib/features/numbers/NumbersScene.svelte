<script lang="ts">
	/**
	 * Spec 07 — Numbers & Counting screen. Questions, validation, and state come from
	 * Codex's core `countingMachine` (X-01); this component renders and runs effects.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		createCountingMachine,
		createNumbersRound,
		formatNumeral,
		type AnswerOption,
		type CountObject,
		type CountingContext,
		type CountingEffect,
		type CountingMachine,
		type CountingState,
		type CountingStep,
		type NumberQuestion
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import Shape from '#lib/components/shapes/Shape.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { holdIdle, instruct, leaveScreen, replayInstruction, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';
	import ParticleCanvas, { type ParticleCue } from '#lib/components/visuals/ParticleCanvas.svelte';
	import { chime } from '#lib/game/chime.ts';

	const STEP_MS = 650; // NC-13: one number per highlighted object
	const FEEDBACK_MS = 1200;

	const d = durations();
	const scheduler = createScheduler();

	let round = $state(createNumbersRound($settings.difficulty, Date.now() >>> 0));
	let index = $state(0);
	let roundDone = $state(false);

	let machine: CountingMachine | null = null;
	let unsubscribers: (() => void)[] = [];
	let mState = $state<CountingState>('READY');
	let ctx = $state<CountingContext | null>(null);

	let mascot = $state<MascotAnimation>('idle');
	let particles = $state.raw<ParticleCue | null>(null);
	let playEl = $state<HTMLElement | null>(null);
	/** Number shown above each object (taps, hints, explanations). */
	let numbers = $state<Record<string, number>>({});
	let activeObject = $state<string | null>(null);
	let wiggling = $state<string | null>(null);
	let total = $state<number | null>(null);
	let explaining = $state(false);
	let stepsBusy = false;

	const q = $derived<NumberQuestion | undefined>(round.activities[index]);
	const lang = $derived($settings.language);
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const locked = $derived(mState !== 'READY' && mState !== 'COUNTING');

	function clearVisuals() {
		mascot = 'idle';
		numbers = {};
		activeObject = null;
		wiggling = null;
		total = null;
		explaining = false;
		if (stepsBusy) holdIdle(false); // a cancelled count must not leave the idle prompt held
		stepsBusy = false;
	}

	/** Count steps aloud with highlight (hint / explanation), then call done. */
	/**
	 * Count objects one by one with a highlight and number badge (NC-13).
	 * `voice: false` keeps it visual so a result sentence already speaking isn't cut off.
	 */
	function playSteps(steps: CountingStep[], done: () => void, opts: { voice: boolean }) {
		stepsBusy = true;
		holdIdle(true); // the child can't act during the count; don't nag over it
		numbers = {};
		steps.forEach((step, i) => {
			scheduler.after(i * STEP_MS, () => {
				activeObject = step.objectId;
				numbers = { ...numbers, [step.objectId]: step.number };
				if (opts.voice) say(step.key, { interrupt: true });
			});
		});
		scheduler.after(steps.length * STEP_MS + 200, () => {
			activeObject = null;
			stepsBusy = false;
			holdIdle(false);
			done();
		});
	}

	function tryResultShown(m: CountingMachine) {
		if (m.state !== 'CORRECT') return;
		if (stepsBusy || !m.send({ type: 'RESULT_SHOWN' })) scheduler.after(100, () => tryResultShown(m));
	}

	function runEffect(effect: CountingEffect) {
		const m = machine;
		if (!m) return;
		switch (effect.type) {
			case 'counted':
				numbers = { ...numbers, [effect.objectId]: effect.number };
				activeObject = effect.objectId;
				say(effect.key, { interrupt: true });
				break;
			case 'countComplete':
				queueMicrotask(() => m.send({ type: 'COUNT_DONE' }));
				break;
			case 'wiggle':
				wiggling = effect.objectId;
				scheduler.after(500, () => (wiggling = null));
				break;
			case 'total':
				total = effect.number;
				mascot = 'celebrate';
				say(effect.key);
				break;
			case 'highlightAnswer':
				break;
			case 'prepareValidation':
				queueMicrotask(() => m.send({ type: 'ANSWER_READY' }));
				break;
			case 'validate':
				queueMicrotask(() => m.send({ type: 'VALIDATE' }));
				break;
			case 'explain':
				explaining = true;
				mascot = 'celebrate';
				// Visual count only: the result sentence ("দুই আর তিন মিলে পাঁচ!") is narrated
				// right after this effect and must be heard in full.
				playSteps(effect.steps, () => {}, { voice: false });
				break;
			case 'hint': {
				mascot = 'thinking';
				const before = numbers; // the child's own count, restored after the demo
				playSteps(
					effect.steps,
					() => {
						numbers = before;
						mascot = 'idle';
						m.send({ type: 'HINT_DONE' });
					},
					{ voice: true }
				);
				break;
			}
			case 'narrate':
				say(effect.key);
				if (m.state === 'TRY_AGAIN') {
					mascot = 'encourage';
					scheduler.after(FEEDBACK_MS, () => {
						mascot = 'idle';
						m.send({ type: 'FEEDBACK_DONE' });
					});
				}
				break;
			case 'celebrate':
				mascot = 'kick';
				chime('big');
				particles = { kind: 'confetti', anchor: playEl?.querySelector('.answer.right, .objects') ?? playEl, label: lang === 'bn-BD' ? 'ঠিক হয়েছে!' : 'Well done!' };
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'complete':
				mascot = 'celebrate';
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

	function load(question: NumberQuestion) {
		teardown();
		clearVisuals();
		const m = createCountingMachine(question);
		machine = m;
		let prev: CountingState | null = null;
		unsubscribers = [
			m.subscribe((s, c) => {
				mState = s;
				ctx = c;
				if (s === 'CORRECT' && prev !== 'CORRECT') {
					scheduler.after(d.resultMin, () => tryResultShown(m));
				}
				if (s === 'COMPLETE' && prev !== 'COMPLETE') setIdlePrompt('ui.tap-next');
				if (s !== 'READY') hideHand();
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		instruct(question.instructionKey);
		// First counting activity: the ghost hand taps the first objects to show how to count (PR-25).
		if (question.kind === 'count' && firstTime('numbers')) {
			scheduler.after(1400, () => showHand(['button.count-object:nth-child(1)', 'button.count-object:nth-child(2)']));
		}
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	const tapObject = (id: string) => machine?.send({ type: 'TAP_OBJECT', objectId: id });
	const choose = (id: string) => machine?.send({ type: 'SELECT_ANSWER', answerId: id });

	function next() {
		if (index + 1 >= round.activities.length) {
			roundDone = true;
			setIdlePrompt(null);
			mascot = 'celebrate';
			say('feedback.completed', { interrupt: true });
			return;
		}
		index += 1;
		load(round.activities[index]!);
	}

	function replayRound() {
		round = createNumbersRound($settings.difficulty, (Date.now() + 1) >>> 0);
		index = 0;
		roundDone = false;
		load(round.activities[0]!);
	}

	onMount(() => {
		if (q) load(q);
	});

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

	const optionState = (o: AnswerOption) =>
		ctx?.selectedAnswerId === o.id
			? mState === 'TRY_AGAIN'
				? 'retry'
				: mState === 'ANSWER_SELECTED' || mState === 'VALIDATING'
					? 'chosen'
					: 'right'
			: '';
</script>

{#snippet objects(list: CountObject[], size: number, tappable: boolean)}
	<div class="objects" style:--size="{size}px">
		{#each list as o (o.id)}
			{@const n = numbers[o.id]}
			{#if tappable}
				<button
					class="obj count-object"
					class:counted={n !== undefined}
					class:active={activeObject === o.id}
					class:wiggle={wiggling === o.id}
					aria-label={n !== undefined ? num(n) : lang === 'bn-BD' ? 'গুনি' : 'Count me'}
					onclick={() => tapObject(o.id)}
				>
					<Shape shape={o.shape} color={o.color} {size} />
					{#if n !== undefined}<span class="badge">{num(n)}</span>{/if}
				</button>
			{:else}
				<span class="obj" class:active={activeObject === o.id} class:counted={n !== undefined}>
					<Shape shape={o.shape} color={o.color} {size} />
					{#if n !== undefined}<span class="badge">{num(n)}</span>{/if}
				</span>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet dots(n: number)}
	<span class="dots" aria-hidden="true">
		{#each Array.from({ length: n }, (_, i) => i) as i (i)}<span class="dot-mark"></span>{/each}
	</span>
{/snippet}

<TopBar onreplay={replayInstruction} />

<section class="scene" class:paused={$paused} bind:this={playEl}>
	<ParticleCanvas cue={particles} paused={$paused} reducedMotion={d.reduced} />
	<div class="playroom" aria-hidden="true"><span class="window"></span><span class="floor"></span><span class="rug"></span></div>
	{#if roundDone}
		<div class="done">
			<Mascot state="celebrate" size={240} />
			<div class="actions">
				<GameButton action="replay" onclick={replayRound} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else if q && ctx}
		<div class="progress" aria-hidden="true">
			{#each round.activities as a, i (a.id)}
				<span class="pdot" class:filled={i < index || (i === index && mState === 'COMPLETE')}></span>
			{/each}
		</div>

		<div class="field" data-kind={q.kind} data-ask={q.kind === 'compare' ? q.ask : undefined}>
			<div class="mascot"><Mascot state={mascot} size={160} /></div>

			<div class="play">
				{#if q.kind === 'count'}
					{@render objects(q.objects, 112, true)}
					<div class="numeral" class:show={total !== null}>{total !== null ? num(total) : ''}</div>
				{:else if q.kind === 'numeral-to-quantity'}
					<div class="numeral show big" data-testid="target-number">{num(q.quantity)}</div>
					<div class="choices">
						{#each q.options as o (o.id)}
							{@const g = q.groups.find((x) => x.id === o.id)!}
							<button
								class="basket {optionState(o)}"
								data-count={g.objects.length}
								aria-label={lang === 'bn-BD' ? `ঝুড়ি ${o.id}` : `Basket ${o.id}`}
								aria-disabled={locked}
								onclick={() => choose(o.id)}
							>
								{@render objects(g.objects, 56, false)}
							</button>
						{/each}
					</div>
				{:else if q.kind === 'compare'}
					<div class="choices sides">
						{#each [q.left, q.right] as g, i (g.id)}
							{@const o = q.options.find((x) => x.value === (i === 0 ? 'left' : 'right'))!}
							<button
								class="basket side {optionState(o)}"
								data-count={g.objects.length}
								data-side={o.value}
								aria-label={lang === 'bn-BD' ? (i === 0 ? 'বাম দিক' : 'ডান দিক') : i === 0 ? 'Left side' : 'Right side'}
								aria-disabled={locked}
								onclick={() => choose(o.id)}
							>
								{@render objects(g.objects, 66, false)}
							</button>
						{/each}
					</div>
					{#if q.options.some((o) => o.value === 'same')}
						{@const same = q.options.find((o) => o.value === 'same')!}
						<button class="answer same {optionState(same)}" aria-disabled={locked} onclick={() => choose(same.id)}>
							{lang === 'bn-BD' ? 'সমান' : 'Same'}
						</button>
					{/if}
				{:else if q.kind === 'add'}
					<div class="sum" class:together={explaining}>
						<div class="group" data-count={q.left.objects.length}>{@render objects(q.left.objects, 78, false)}</div>
						<span class="op" aria-hidden="true">{q.showPlus ? '+' : ''}</span>
						<div class="group" data-count={q.right.objects.length}>{@render objects(q.right.objects, 78, false)}</div>
					</div>
					<div class="answers">
						{#each q.options as o (o.id)}
							<button class="answer {optionState(o)}" aria-label={num(o.value as number)} aria-disabled={locked} onclick={() => choose(o.id)}>
								<span class="answer-num">{num(o.value as number)}</span>
								{@render dots(o.dots)}
							</button>
						{/each}
					</div>
				{:else if q.kind === 'pattern'}
					<div class="pattern">
						{#each q.pattern.sequence as tok, i (i)}
							<span class="tok" data-token={tok.id}><Shape shape={tok.shape} color={tok.color} size={64} /></span>
						{/each}
						<span class="tok slot" class:filled={mState === 'CORRECT' || mState === 'CELEBRATING' || mState === 'COMPLETE'}>
							{#if mState === 'CORRECT' || mState === 'CELEBRATING' || mState === 'COMPLETE'}
								<Shape shape={q.pattern.answer.shape} color={q.pattern.answer.color} size={64} />
							{:else}?{/if}
						</span>
					</div>
					<div class="answers">
						{#each q.pattern.options as tok (tok.id)}
							{@const o = q.options.find((x) => x.id === tok.id)!}
							<button class="answer token {optionState(o)}" data-token={tok.id} aria-label={tok.id} aria-disabled={locked} onclick={() => choose(o.id)}>
								<Shape shape={tok.shape} color={tok.color} size={72} />
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="bottom">
			{#if mState === 'COMPLETE'}
				<GameButton action="next" onclick={next} />
			{:else if ctx.hintEnabled && mState === 'READY' && !ctx.hinting}
				<GameButton
					action="hint"
					label={lang === 'bn-BD' ? 'চলো একসাথে গুনি' : 'Count with me'}
					size="small"
					onclick={() => machine?.send({ type: 'HINT' })}
				/>
			{/if}
		</div>
	{/if}
</section>

<style>
	.scene {
		position: relative;
		isolation: isolate;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px 24px;
		min-height: 0;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.progress {
		display: flex;
		gap: 12px;
	}
	.pdot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
	}
	.pdot.filled {
		background: var(--text-secondary);
	}
	.field {
		flex: 1;
		width: min(1150px, 100%);
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 24px;
	}
	.mascot {
		align-self: end;
	}
	.play {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}
	/* NC-05: at most two rows of 5 */
	.objects {
		display: grid;
		grid-template-columns: repeat(5, auto);
		justify-content: center;
		gap: 14px;
	}
	.obj {
		position: relative;
		display: grid;
		place-items: center;
		padding: 6px;
		border: 3px solid transparent;
		border-radius: var(--radius-lg);
		background: transparent;
	}
	button.obj {
		cursor: pointer;
		min-width: var(--target-min);
		min-height: var(--target-min);
	}
	.obj.counted {
		border-color: var(--text-secondary);
	}
	.obj.active {
		border-color: var(--text-primary);
		background: var(--surface);
		transform: translateY(-4px);
		transition: transform 200ms ease;
	}
	.wiggle {
		animation: wiggle 500ms ease-in-out;
	}
	.badge {
		position: absolute;
		top: -18px;
		right: -8px;
		min-width: 40px;
		padding: 0 8px;
		border-radius: 20px;
		background: var(--text-primary);
		color: var(--bg-primary);
		font-size: 26px;
		font-weight: 700;
		line-height: 40px;
		text-align: center;
	}
	.numeral {
		min-height: 1.2em;
		font-size: 72px;
		font-weight: 700;
		line-height: 1.1;
		opacity: 0;
		transition: opacity 400ms ease;
	}
	.numeral.show {
		opacity: 1;
	}
	.numeral.big {
		font-size: 96px;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 24px;
	}
	.basket {
		display: grid;
		place-items: center;
		min-width: 200px;
		min-height: 150px;
		padding: 18px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
	}
	.side {
		min-width: 300px;
		min-height: 220px;
	}
	.chosen {
		border-color: var(--text-secondary);
	}
	.right {
		border-color: var(--text-primary);
		border-width: 5px;
	}
	.retry {
		animation: wiggle 500ms ease-in-out;
	}
	.sum {
		display: flex;
		align-items: center;
		gap: 36px;
		transition: gap 600ms ease;
	}
	.sum.together {
		gap: 4px;
	}
	.op {
		font-size: 64px;
		font-weight: 700;
		min-width: 0.5em;
		text-align: center;
	}
	.answers {
		display: flex;
		gap: 24px;
	}
	.answer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-width: 110px;
		min-height: var(--target-game);
		padding: 10px 18px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		font-weight: 700;
	}
	.answer.same {
		font-size: 32px;
		justify-content: center;
	}
	.answer-num {
		font-size: 44px;
		line-height: 1;
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px;
		max-width: 90px;
	}
	.dot-mark {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--text-secondary);
	}
	.pattern {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}
	.tok {
		display: grid;
		place-items: center;
		width: 84px;
		height: 84px;
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	.tok.slot {
		border: 4px dashed var(--text-secondary);
		font-size: 44px;
		font-weight: 700;
		color: var(--text-secondary);
	}
	.tok.slot.filled {
		border-style: solid;
		border-color: var(--text-primary);
	}
	.bottom {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 110px;
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
	@keyframes wiggle {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-4deg); }
		75% { transform: rotate(4deg); }
	}
	@media (max-width: 900px) {
		.field {
			grid-template-columns: 1fr;
		}
		.mascot {
			display: none;
		}
	}
	/* A calm playroom behind the counting table. */
	.playroom {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		overflow: hidden;
		background: linear-gradient(#fdf1e3, #fbe7d3 62%);
	}
	.playroom .window {
		position: absolute;
		top: 10%;
		right: 7%;
		width: 190px;
		height: 150px;
		border: 10px solid #ffffff;
		border-radius: 18px;
		background: radial-gradient(circle at 70% 30%, #fff3b8 0 18px, transparent 19px), linear-gradient(#bfe3f7, #e5f4fc);
		box-shadow: 0 6px 0 #ecd7bf;
	}
	.playroom .window::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent 47%, #ffffff 47% 53%, transparent 53%), linear-gradient(transparent 47%, #ffffff 47% 53%, transparent 53%);
	}
	.playroom .floor {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 38%;
		background: repeating-linear-gradient(90deg, #e9c9a1 0 160px, #e2bf95 160px 164px);
		box-shadow: inset 0 10px 0 #dcb487;
	}
	.playroom .rug {
		position: absolute;
		left: 50%;
		bottom: 6%;
		width: 62%;
		height: 24%;
		transform: translateX(-50%);
		border-radius: 50%;
		background: radial-gradient(ellipse, #f6dbe6 0 45%, #cfe3f4 46% 62%, #d9eccd 63% 80%, #f6e2b2 81%);
		opacity: 0.85;
	}
</style>
