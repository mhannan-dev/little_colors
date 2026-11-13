<script lang="ts">
	/**
	 * Simple Math (সহজ অঙ্ক): count apples to add or take away, up to 10 or 20 (started by Codex,
	 * finished by Claude). Tap the number. A wrong number gently wobbles and Rumi says "not yet,
	 * let's count again" (PR-08); after two tries the right number glows (PR-22). No stars, score
	 * or clock (PR-07): five dots only show where we are in the little set, which always ends
	 * with a celebration. Rumi reads every sum aloud (numbers up to 10).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createMathQuestion, formatNumeral, narrationText, type MathLimit, type MathMode } from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import ParticleCanvas, { type ParticleCue } from '#lib/components/visuals/ParticleCanvas.svelte';
	import { instruct, instructAll, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { chime } from '#lib/game/chime.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';

	const SET = 5;
	const d = durations();
	const scheduler = createScheduler();
	let mode = $state<MathMode>('add');
	let limit = $state<MathLimit>(10);
	let question = $state(createMathQuestion('add', 10));
	let done = $state(0);
	let solved = $state(false);
	let tries = $state(0);
	let wobble = $state<number | null>(null);
	let mascot = $state<MascotAnimation>('wave');
	let particles = $state.raw<ParticleCue | null>(null);
	const finished = $derived(done >= SET);
	const glow = $derived(!solved && tries >= 2);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const number = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const MODES: MathMode[] = ['add', 'subtract', 'mixed'];
	const MODE_SYMBOL: Record<MathMode, string> = { add: '+', subtract: '−', mixed: '+ −' };

	/** "3 plus 2 — how many is that?" (number words exist up to 10). */
	function speakSum() {
		const q = question;
		const parts = [`number.${q.left}`, q.operation === 'add' ? 'simple-math.plus' : 'simple-math.minus', `number.${q.right}`, 'simple-math.how-many'];
		if (q.left >= 1 && q.left <= 10 && q.right >= 1 && q.right <= 10) instructAll(parts);
		else instruct('simple-math.how-many');
		setIdlePrompt('simple-math.how-many');
	}

	function next() {
		scheduler.cancelAll();
		question = createMathQuestion(mode, limit);
		solved = false;
		tries = 0;
		wobble = null;
		mascot = 'idle';
		speakSum();
	}
	function restart() {
		done = 0;
		next();
	}
	function setMode(m: MathMode) {
		mode = m;
		speakLabel(`simple-math.${m}`);
		restart();
	}
	function setLimit(l: MathLimit) {
		limit = l;
		speakLabel(`simple-math.up-to-${l}`);
		restart();
	}

	function answer(value: number) {
		if (solved || finished) return;
		if (value !== question.answer) {
			tries += 1;
			wobble = value;
			mascot = 'encourage';
			scheduler.after(600, () => (wobble = null));
			say('simple-math.retry', { interrupt: true });
			return;
		}
		solved = true;
		done += 1;
		mascot = 'celebrate';
		chime(done >= SET ? 'big' : 'success');
		particles = { kind: done >= SET ? 'confetti' : 'stars', anchor: document.querySelector('[data-testid="math-equation"]') };
		setIdlePrompt(null);
		if (question.answer >= 1 && question.answer <= 10) say(`number.${question.answer}`, { interrupt: true });
		say(done >= SET ? 'simple-math.complete' : 'simple-math.correct');
	}

	onMount(() => {
		instruct('simple-math.intro');
		scheduler.after(d.reduced ? 1500 : 3800, speakSum);
	});
	const offPause = paused.subscribe((p) => {
		if (p) {
			scheduler.pause();
			stopNarration();
		} else scheduler.resume();
	});
	onDestroy(() => {
		offPause();
		scheduler.cancelAll();
		leaveScreen();
	});
</script>

<TopBar onreplay={speakSum} />

<ParticleCanvas cue={particles} paused={$paused} reducedMotion={d.reduced} />
<section class="math" class:paused={$paused} data-done={done} data-tries={tries} data-finished={finished}>
	<div class="options">
		<div class="seg" role="group" aria-label={text('mode.simple-math')}>
			{#each MODES as m (m)}
				<button class="opt" data-math-mode={m} aria-pressed={mode === m} onclick={() => setMode(m)}>
					<b aria-hidden="true">{MODE_SYMBOL[m]}</b> {text(`simple-math.${m}`)}
				</button>
			{/each}
		</div>
		<div class="seg" role="group" aria-label={text('simple-math.up-to-20')}>
			{#each [10, 20] as const as l (l)}
				<button class="opt" data-limit={l} aria-pressed={limit === l} onclick={() => setLimit(l)}>{text(`simple-math.up-to-${l}`)}</button>
			{/each}
		</div>
	</div>

	<div class="progress" aria-hidden="true">
		{#each Array.from({ length: SET }, (_, i) => i) as i (i)}<span class="pdot" class:filled={i < done}></span>{/each}
	</div>

	{#if finished}
		<div class="finale" aria-live="polite">
			<Mascot state="celebrate" size={190} />
			<h2>{text('simple-math.complete')}</h2>
			<div class="actions">
				<GameButton action="replay" onclick={restart} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else}
		<div class="board">
			<div class="problem">
				<div class="equation" data-testid="math-equation" aria-live="polite">
					{number(question.left)} {question.operation === 'add' ? '+' : '−'} {number(question.right)} = <span class="ans" class:shown={solved}>{solved ? number(question.answer) : '?'}</span>
				</div>
				<div class="counters" aria-hidden="true">
					{#if question.operation === 'add'}
						{#each [question.left, question.right] as count, group (group)}
							{#if group === 1}<strong class="sign">+</strong>{/if}
							<div class="group" class:pile={limit === 20}>
								{#each Array.from({ length: count }, (_, i) => i) as i (i)}<span class="apple" class:hop={solved} style:--i={i}>🍎</span>{/each}
								{#if count === 0}<span class="zero">{number(0)}</span>{/if}
							</div>
						{/each}
					{:else}
						<div class="group" class:pile={limit === 20}>
							{#each Array.from({ length: question.left }, (_, i) => i) as i (i)}
								<span class="apple" class:removed={i >= question.answer} class:hop={solved && i < question.answer} style:--i={i}>🍎</span>
							{/each}
						</div>
					{/if}
				</div>
				<div class="answers" role="group" aria-label={text('simple-math.how-many')}>
					{#each question.choices as choice (choice)}
						<button
							class="choice"
							class:correct={solved && choice === question.answer}
							class:glow={glow && choice === question.answer}
							class:wobble={wobble === choice}
							data-choice={choice}
							disabled={solved}
							onclick={() => answer(choice)}
						>{number(choice)}</button>
					{/each}
				</div>
			</div>
			<div class="side">
				<Mascot state={mascot} size={140} />
				{#if solved}
					<GameButton action="next" onclick={next} />
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.math {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 0 24px 18px;
		min-height: 0;
		overflow-y: auto;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		justify-content: center;
	}
	.seg {
		display: flex;
		gap: 6px;
		padding: 5px;
		border-radius: 999px;
		background: var(--bg-secondary);
	}
	.opt {
		min-height: 52px;
		padding: 6px 18px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-primary);
		font-size: 19px;
		font-weight: 700;
		cursor: pointer;
	}
	.opt b {
		font-size: 22px;
	}
	.opt[aria-pressed='true'] {
		background: var(--surface);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
	}
	.opt:focus-visible,
	.choice:focus-visible {
		outline: 4px solid var(--text-primary);
		outline-offset: 3px;
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
	.board {
		flex: 1;
		width: min(1100px, 100%);
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 20px;
		min-height: 0;
	}
	.problem {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		padding: 22px;
		border: 4px solid var(--border-soft);
		border-radius: 30px;
		background: var(--surface);
	}
	.equation {
		font-size: clamp(44px, 7vw, 72px);
		font-weight: 800;
		color: var(--text-primary);
	}
	.ans.shown {
		color: #267344;
		display: inline-block;
		animation: pop 400ms cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.counters {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 18px;
		min-height: 90px;
	}
	.sign {
		font-size: 48px;
		color: var(--text-secondary);
	}
	.group {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		max-width: 380px;
	}
	.apple {
		position: relative;
		font-size: 44px;
		line-height: 1;
	}
	.pile .apple {
		font-size: 32px;
	}
	.apple.hop {
		animation: hop 500ms ease-out calc(var(--i) * 60ms);
	}
	.apple.removed {
		opacity: 0.3;
	}
	.apple.removed::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 48%;
		height: 4px;
		border-radius: 2px;
		background: var(--text-primary);
		transform: rotate(-40deg);
	}
	.zero {
		font-size: 40px;
		font-weight: 800;
		color: var(--text-secondary);
	}
	.answers {
		display: grid;
		grid-template-columns: repeat(4, minmax(90px, 1fr));
		gap: 14px;
		width: min(560px, 100%);
	}
	.choice {
		min-height: var(--target-game);
		border: 4px solid var(--border-soft);
		border-radius: 24px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 40px;
		font-weight: 800;
		cursor: pointer;
		transition: transform 150ms ease;
	}
	.choice:hover:not(:disabled) {
		transform: translateY(-3px);
	}
	.choice.correct {
		border-color: #267344;
		background: #e1f4df;
		color: #173d22;
	}
	.choice.glow {
		border-color: #ffd84d;
		box-shadow: 0 0 0 6px rgba(255, 216, 77, 0.5);
		animation: breathe 1.2s ease-in-out infinite;
	}
	.choice.wobble {
		animation: wobble 500ms ease-in-out;
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.finale {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 18px;
	}
	.finale h2 {
		margin: 0;
		font-size: 32px;
		color: var(--text-primary);
	}
	.actions {
		display: flex;
		gap: 22px;
	}
	@keyframes pop {
		from {
			transform: scale(0.4);
		}
	}
	@keyframes hop {
		40% {
			transform: translateY(-14px);
		}
	}
	@keyframes wobble {
		25% {
			transform: rotate(-6deg);
		}
		75% {
			transform: rotate(6deg);
		}
	}
	/* Glow pulses in colour only (the button itself stays still, easy to tap). */
	@keyframes breathe {
		50% {
			box-shadow: 0 0 0 12px rgba(255, 216, 77, 0.25);
		}
	}
	@media (max-width: 760px) {
		.board {
			grid-template-columns: 1fr;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.math :global(*) {
			animation: none !important;
		}
	}
</style>
