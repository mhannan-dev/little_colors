<script lang="ts">
	/**
	 * Football, Garage, and Birds mini-games. Rules and rounds come from
	 * @little-colors/core (choiceMachine + generators); this component renders the
	 * playfield for each game and runs the machine's effects. Placeholder art (AS-20).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		COLOR_NAMES,
		createChoiceMachine,
		createMiniGameRound,
		formatNumeral,
		type BirdsData,
		type ChoiceActivity,
		type ChoiceContext,
		type ChoiceEffect,
		type ChoiceMachine,
		type ChoiceOption,
		type ChoiceState,
		type FootballData,
		type GarageData,
		type MiniGame
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, replayInstruction, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';
	import ParticleCanvas, { type ParticleCue } from '#lib/components/visuals/ParticleCanvas.svelte';
	import { chime } from '#lib/game/chime.ts';

	let { game }: { game: MiniGame } = $props();

	const ANIM_MS = 950;
	const FEEDBACK_MS = 1100;
	const d = durations();
	const scheduler = createScheduler();

	// svelte-ignore state_referenced_locally
	let round = $state(createMiniGameRound(game, $settings.difficulty, Date.now() >>> 0));
	let index = $state(0);
	let roundDone = $state(false);

	let machine: ChoiceMachine | null = null;
	let unsubscribers: (() => void)[] = [];
	let mState = $state<ChoiceState>('READY');
	let ctx = $state<ChoiceContext | null>(null);

	let mascot = $state<MascotAnimation>('idle');
	/** Confetti on a right answer, stars when Rumi celebrates (shared particle layer). */
	let particles = $state.raw<ParticleCue | null>(null);
	let mascotEl = $state<HTMLElement | null>(null);
	let hintId = $state<string | null>(null);
	/** Moving piece (ball / car) offset toward the chosen option. */
	let moveX = $state(0);
	let moveY = $state(0);
	let moveMode = $state<'' | 'hit' | 'miss' | 'back'>('');
	let mover = $state<HTMLElement | null>(null);

	const a = $derived<ChoiceActivity | undefined>(round.activities[index]);
	const lang = $derived($settings.language);
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const colorName = (c: keyof typeof COLOR_NAMES) => (lang === 'bn-BD' ? COLOR_NAMES[c].bn : COLOR_NAMES[c].en);

	function optionLabel(o: ChoiceOption): string {
		if (game === 'birds') return num(o.number!);
		const noun = game === 'football' ? (lang === 'bn-BD' ? 'গোল' : 'goal') : lang === 'bn-BD' ? 'গ্যারেজ' : 'garage';
		if (o.color) return lang === 'bn-BD' ? `${colorName(o.color)} ${noun}` : `${colorName(o.color)} ${noun}`;
		return lang === 'bn-BD' ? `${num(o.number!)} নম্বর ${noun}` : `${noun} ${num(o.number!)}`;
	}

	function clearVisuals() {
		mascot = 'idle';
		hintId = null;
		moveX = moveY = 0;
		moveMode = '';
	}

	/** Offset from the moving piece to the chosen option's centre (accounts for UI zoom). */
	function aimAt(optionId: string) {
		const target = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`);
		if (!mover || !target) return;
		const zoom = Number(getComputedStyle(document.querySelector('main')!).zoom) || 1;
		const m = mover.getBoundingClientRect();
		const t = target.getBoundingClientRect();
		moveX = (t.left + t.width / 2 - (m.left + m.width / 2)) / zoom;
		moveY = (t.top + t.height / 2 - (m.top + m.height / 2)) / zoom;
	}

	function runEffect(effect: ChoiceEffect) {
		const m = machine;
		if (!m) return;
		switch (effect.type) {
			case 'animate':
				hintId = null;
				if (game !== 'birds') {
					mascot = game === 'football' ? 'kick' : 'thinking';
					aimAt(effect.optionId);
					moveMode = effect.correct ? 'hit' : 'miss';
				}
				scheduler.after(d.reduced ? 300 : ANIM_MS, () => m.send({ type: 'ANIM_DONE' }));
				break;
			case 'narrate':
				say(effect.key);
				if (m.state === 'TRY_AGAIN') {
					mascot = 'encourage';
					moveMode = 'back';
					moveX = moveY = 0;
					scheduler.after(FEEDBACK_MS, () => {
						mascot = 'idle';
						moveMode = '';
						m.send({ type: 'FEEDBACK_DONE' });
					});
				} else if (m.state === 'CORRECT') {
					mascot = 'celebrate';
					chime();
					particles = {
						kind: 'confetti',
						anchor: document.querySelector(`[data-option-id="${m.context.chosenId}"]`),
						label: lang === 'bn-BD' ? 'দারুণ!' : 'Great!'
					};
				}
				break;
			case 'hint':
				hintId = effect.optionId;
				showHand([`[data-option-id="${effect.optionId}"]`]);
				scheduler.after(2400, () => (hintId = null));
				break;
			case 'celebrate':
				mascot = 'celebrate';
				particles = { kind: 'stars', anchor: mascotEl };
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'cancelAll':
				scheduler.cancelAll();
				stopNarration();
				clearVisuals();
				break;
			case 'complete':
			case 'next':
				break;
		}
	}

	function tryResultShown(m: ChoiceMachine) {
		if (m.state === 'CORRECT' && !m.send({ type: 'RESULT_SHOWN' })) {
			scheduler.after(100, () => tryResultShown(m));
		}
	}

	function load(activity: ChoiceActivity) {
		teardown();
		clearVisuals();
		const m = createChoiceMachine(activity);
		machine = m;
		let prev: ChoiceState | null = null;
		unsubscribers = [
			m.subscribe((s, c) => {
				mState = s;
				ctx = c;
				if (s === 'CORRECT' && prev !== 'CORRECT') scheduler.after(d.resultMin, () => tryResultShown(m));
				if (s === 'COMPLETE' && prev !== 'COMPLETE') setIdlePrompt('ui.tap-next');
				if (s !== 'READY') hideHand();
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		instruct(activity.instructionKey);
		// First visit: the ghost hand taps the right answer once to show how to play (PR-25).
		if (firstTime(game)) scheduler.after(1400, () => showHand([`[data-option-id="${activity.answerId}"]`]));
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	const choose = (id: string) => machine?.send({ type: 'CHOOSE', optionId: id });

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
		round = createMiniGameRound(game, $settings.difficulty, (Date.now() + 1) >>> 0);
		index = 0;
		roundDone = false;
		load(round.activities[0]!);
	}

	onMount(() => {
		if (a) load(a);
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

	const locked = $derived(mState !== 'READY');
	const isChosen = (id: string) => ctx?.chosenId === id && mState !== 'READY';
	const won = (id: string) =>
		ctx?.chosenId === id && (mState === 'CORRECT' || mState === 'CELEBRATING' || mState === 'COMPLETE');
</script>

{#snippet goalArt(o: ChoiceOption)}
	<svg viewBox="0 0 120 100" width="230" height="192" aria-hidden="true">
		<path d="M8 96 V10 H112 V96" fill="none" stroke={o.color ? `var(--learn-${o.color})` : 'var(--text-primary)'} stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M14 34 H106 M14 58 H106 M14 82 H106 M38 14 V96 M60 14 V96 M82 14 V96" stroke="var(--border-soft)" stroke-width="3" />
		{#if o.number !== undefined}
			<circle cx="60" cy="56" r="26" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="4" />
			<text x="60" y="68" text-anchor="middle" font-size="34" font-weight="700" fill="var(--text-primary)">{num(o.number)}</text>
		{/if}
	</svg>
{/snippet}

{#snippet ballArt()}
	<svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true">
		<circle cx="50" cy="50" r="44" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="4" />
		<polygon points="50,30 63,39 58,54 42,54 37,39" fill="var(--text-primary)" />
		<path d="M50 30 V8 M63 39 L84 30 M58 54 L70 74 M42 54 L30 74 M37 39 L16 30" stroke="var(--text-primary)" stroke-width="3" fill="none" />
	</svg>
{/snippet}

{#snippet carArt(color: string, passengers: number)}
	<svg viewBox="0 0 160 100" width="250" height="156" aria-hidden="true">
		<path d="M14 66 Q14 50 30 48 L46 46 L62 24 Q66 20 72 20 H106 Q114 20 118 28 L128 46 L140 48 Q150 50 150 64 V72 Q150 78 144 78 H20 Q14 78 14 72 Z" fill={`var(--learn-${color})`} stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
		<path d="M66 28 H86 V46 H54 Z M92 28 H110 L120 46 H92 Z" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3" stroke-linejoin="round" />
		{#each Array.from({ length: passengers }, (_, i) => i) as i (i)}
			<circle cx={34 + i * 22} cy="62" r="7" fill="var(--mascot-fur-light)" stroke="var(--text-primary)" stroke-width="2.5" />
		{/each}
		<circle cx="44" cy="80" r="14" fill="var(--text-primary)" />
		<circle cx="44" cy="80" r="5" fill="var(--border-soft)" />
		<circle cx="120" cy="80" r="14" fill="var(--text-primary)" />
		<circle cx="120" cy="80" r="5" fill="var(--border-soft)" />
	</svg>
{/snippet}

{#snippet garageArt(o: ChoiceOption)}
	<svg viewBox="0 0 140 120" width="232" height="199" aria-hidden="true">
		<path d="M8 50 L70 8 L132 50 V114 H8 Z" fill={o.color ? `var(--learn-${o.color})` : 'var(--surface)'} fill-opacity={o.color ? 0.85 : 1} stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
		<rect x="28" y="58" width="84" height="56" rx="4" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="4" />
		<path d="M28 72 H112 M28 86 H112 M28 100 H112" stroke="var(--border-soft)" stroke-width="3" />
		{#if o.number !== undefined}
			<circle cx="70" cy="36" r="18" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="3.5" />
			<text x="70" y="45" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text-primary)">{num(o.number)}</text>
		{/if}
	</svg>
{/snippet}

{#snippet birdArt(color: string)}
	<svg viewBox="0 0 60 50" width="90" height="75" aria-hidden="true">
		<ellipse cx="28" cy="30" rx="20" ry="15" fill={`var(--learn-${color})`} stroke="var(--text-primary)" stroke-width="3" />
		<circle cx="44" cy="18" r="10" fill={`var(--learn-${color})`} stroke="var(--text-primary)" stroke-width="3" />
		<circle cx="47" cy="16" r="2.5" fill="var(--text-primary)" />
		<path d="M53 18 L60 21 L53 23 Z" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="2" stroke-linejoin="round" />
		<path d="M14 26 Q24 18 32 30" fill="none" stroke="var(--text-primary)" stroke-width="3" stroke-linecap="round" />
		<path d="M24 45 V49 M32 45 V49" stroke="var(--text-primary)" stroke-width="3" stroke-linecap="round" />
	</svg>
{/snippet}

<TopBar onreplay={replayInstruction} />

<section class="scene {game}" class:paused={$paused}>
	<ParticleCanvas cue={particles} paused={$paused} reducedMotion={d.reduced} />
	<div class="backdrop {game}" aria-hidden="true">
		<span class="sun"></span>
		{#if game === 'birds'}
			<span class="cloud c1"></span><span class="cloud c2"></span><span class="cloud c3"></span>
			<span class="hill h1"></span><span class="hill h2"></span>
			<span class="trunk"></span>
		{:else if game === 'garage'}
			<span class="cloud c1"></span><span class="cloud c2"></span>
			<svg class="city" viewBox="0 0 1200 220" preserveAspectRatio="none">
				<path d="M0 220V120h70V70h60v50h40V40h80v80h50V90h70v130zM400 220V100h60V60h90v60h40V30h70v90h60V80h80v140zM900 220V110h50V60h80v50h40V20h70v100h60v100z" fill="#c9d6e3" />
				<path d="M0 220V160h90v-30h70v30h60v-50h80v50h70v-20h90v40h80v-60h70v60h90v-40h80v40h70v-30h90v30h80v-50h80v70z" fill="#b3c4d4" />
			</svg>
			<span class="sidewalk"></span>
			<span class="road"></span>
		{:else}
			<span class="cloud c1"></span><span class="cloud c2"></span>
			<span class="treeline"></span>
			<span class="pitch"><span class="lines"></span></span>
		{/if}
	</div>
	{#if roundDone}
		<div class="done">
			<Mascot state="celebrate" size={240} />
			<div class="actions">
				<GameButton action="replay" onclick={replayRound} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else if a && ctx}
		<div class="progress game-progress" aria-hidden="true">
			{#each round.activities as x, i (x.id)}
				<span class="pdot" class:filled={i < index || (i === index && mState === 'COMPLETE')}></span>
			{/each}
		</div>

		<div class="field">
			<div class="mascot" bind:this={mascotEl}><Mascot state={mascot} size={190} /></div>

			{#if game === 'football'}
				{@const fd = a.data as FootballData}
				<div class="play">
					<div class="targets">
						{#each a.options as o (o.id)}
							<button class="option goal" class:hinted={hintId === o.id} class:won={won(o.id)} class:chosen={isChosen(o.id)} data-option-id={o.id} data-by={fd.by} aria-label={optionLabel(o)} aria-disabled={locked} onclick={() => choose(o.id)}>
								{@render goalArt(o)}
							</button>
						{/each}
					</div>
					<div class="mover ball {moveMode}" bind:this={mover} style:transform="translate({moveX}px, {moveY}px) {moveMode === 'hit' ? 'scale(0.6) rotate(540deg)' : ''}" role="img" aria-label={lang === 'bn-BD' ? 'ফুটবল' : 'Football'}>
						{@render ballArt()}
					</div>
				</div>
			{:else if game === 'garage'}
				{@const gd = a.data as GarageData}
				<div class="play">
					<div class="mover car {moveMode}" bind:this={mover} style:transform="translate({moveX}px, {moveY}px) {moveMode === 'hit' ? 'scale(0.7)' : ''}" role="img" data-passengers={gd.by === 'count' ? gd.passengers : undefined} aria-label={gd.by === 'count' ? (lang === 'bn-BD' ? `গাড়িতে ${num(gd.passengers)} জন যাত্রী` : `Car with ${gd.passengers} passengers`) : (lang === 'bn-BD' ? `${colorName(gd.carColor)} গাড়ি` : `${colorName(gd.carColor)} car`)}>
						{@render carArt(gd.carColor, gd.by === 'count' ? gd.passengers : 0)}
					</div>
					<div class="targets">
						{#each a.options as o (o.id)}
							<button class="option garage" class:hinted={hintId === o.id} class:won={won(o.id)} class:chosen={isChosen(o.id)} data-option-id={o.id} aria-label={optionLabel(o)} aria-disabled={locked} onclick={() => choose(o.id)}>
								{@render garageArt(o)}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{@const bd = a.data as BirdsData}
				<div class="play">
					<div class="branches" class:sing={mState === 'CORRECT' || mState === 'CELEBRATING'}>
						{#each bd.branches as count, b (b)}
							<div class="branch" data-count={count}>
								<div class="flock">
									{#each Array.from({ length: count }, (_, i) => i) as i (i)}
										<span class="bird" style:animation-delay="{i * 90}ms">{@render birdArt(bd.color)}</span>
									{/each}
								</div>
								<svg class="wood" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 Q200 2 400 14 L400 22 Q200 12 0 22 Z" fill="var(--mascot-stripe)" /></svg>
							</div>
							{#if bd.branches.length > 1 && b === 0}<span class="plus" aria-hidden="true">{lang === 'bn-BD' ? 'আর' : 'and'}</span>{/if}
						{/each}
					</div>
					<div class="answers">
						{#each a.options as o (o.id)}
							<button class="option answer" class:hinted={hintId === o.id} class:won={won(o.id)} class:retry={isChosen(o.id) && mState === 'TRY_AGAIN'} class:chosen={isChosen(o.id)} data-option-id={o.id} aria-label={optionLabel(o)} aria-disabled={locked} onclick={() => choose(o.id)}>
								<span class="answer-num">{num(o.number!)}</span>
								<span class="dots" aria-hidden="true">{#each Array.from({ length: o.number! }, (_, i) => i) as i (i)}<span class="dot-mark"></span>{/each}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="bottom">
			{#if mState === 'COMPLETE'}
				<GameButton action="next" onclick={next} />
			{:else if ctx.hintEnabled && mState === 'READY'}
				<GameButton action="hint" size="small" onclick={() => machine?.send({ type: 'HINT' })} />
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
		gap: 40px;
	}
	.targets,
	.answers {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 28px;
	}
	.option {
		display: grid;
		place-items: center;
		padding: 12px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		box-shadow: var(--control-shadow), inset 0 2px 0 #ffffffa3;
		transition: transform 250ms ease, border-color 250ms ease;
	}
	.option:hover:not([aria-disabled='true']) {
		transform: translateY(-4px);
	}
	.option[aria-disabled='true'] {
		cursor: default;
	}
	.option.chosen {
		border-color: var(--focus);
	}
	.option.won {
		border-color: var(--learn-green);
		background: color-mix(in srgb, var(--learn-green) 10%, var(--surface));
		border-width: 5px;
		animation: pop 500ms ease-out;
	}
	.option.retry {
		animation: wiggle 500ms ease-in-out;
	}
	.option.hinted {
		animation: glow 1.2s ease-in-out 2;
	}
	.mover {
		position: relative;
		z-index: 5;
		transition: transform 900ms cubic-bezier(0.3, 0.6, 0.3, 1);
	}
	.mover.miss {
		/* heads toward the wrong target, then 'back' returns it gently */
		transition: transform 700ms ease-out;
	}
	.mover.back {
		transition: transform 500ms ease-in-out;
	}
	.answers .answer {
		min-width: 120px;
		min-height: var(--target-game);
		gap: 6px;
		font-weight: 700;
	}
	.answer-num {
		font-size: 48px;
		line-height: 1;
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px;
		max-width: 92px;
	}
	.dot-mark {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--text-secondary);
	}
	.branches {
		display: flex;
		align-items: end;
		gap: 24px;
	}
	.branch {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 220px;
	}
	.flock {
		display: grid;
		grid-template-columns: repeat(5, auto);
		gap: 6px;
		justify-content: center;
		margin-bottom: -6px;
	}
	.bird {
		display: block;
		animation: land 600ms ease-out backwards;
	}
	.sing .bird {
		animation: bob 500ms ease-in-out 3 alternate;
	}
	.wood {
		width: 100%;
		height: 22px;
	}
	.plus {
		align-self: center;
		font-size: 30px;
		font-weight: 700;
		color: var(--text-secondary);
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
	@keyframes pop {
		0% { transform: scale(1); }
		50% { transform: scale(1.08); }
		100% { transform: scale(1); }
	}
	@keyframes wiggle {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-4deg); }
		75% { transform: rotate(4deg); }
	}
	@keyframes glow {
		0%, 100% { box-shadow: 0 0 0 0 transparent; }
		50% { box-shadow: 0 0 0 10px var(--border-soft); }
	}
	@keyframes land {
		from { transform: translateY(-40px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	@keyframes bob {
		from { transform: translateY(0); }
		to { transform: translateY(-8px); }
	}
	@media (max-width: 900px) {
		.field {
			grid-template-columns: 1fr;
		}
		.mascot {
			display: none;
		}
	}

	/* ── Scenery (decorative, behind everything; calm, no flashing) ── */
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		background: linear-gradient(#cfe9fb 0%, #eaf6fd 46%, #fff9f0 100%);
	}
	.sun {
		position: absolute;
		top: 7%;
		right: 9%;
		width: 86px;
		height: 86px;
		border-radius: 50%;
		background: radial-gradient(circle, #fff6c9 0 55%, #ffe58f 56% 100%);
		box-shadow: 0 0 0 18px #fff1b455, 0 0 0 40px #fff1b422;
	}
	.cloud {
		position: absolute;
		width: 170px;
		height: 46px;
		border-radius: 30px;
		background: #ffffff;
		opacity: 0.92;
		animation: drift 60s linear infinite;
	}
	.cloud::before,
	.cloud::after {
		content: '';
		position: absolute;
		border-radius: 50%;
		background: #ffffff;
	}
	.cloud::before { width: 70px; height: 70px; left: 26px; top: -34px; }
	.cloud::after { width: 54px; height: 54px; left: 86px; top: -22px; }
	.c1 { top: 15%; left: 6%; }
	.c2 { top: 9%; left: 46%; transform: scale(0.75); animation-duration: 80s; }
	.c3 { top: 24%; left: 70%; transform: scale(0.6); animation-duration: 95s; }
	/* Football: a striped pitch with field lines and a treeline. */
	.backdrop.football .treeline {
		position: absolute;
		left: -5%;
		right: -5%;
		bottom: 70%;
		height: 60px;
		background: radial-gradient(circle at 20px 60px, #5fa86e 0 34px, transparent 35px) 0 0 / 70px 60px repeat-x;
	}
	.backdrop.football .pitch {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 72%;
		background: repeating-linear-gradient(90deg, #8fcf72 0 90px, #84c567 90px 180px);
		box-shadow: inset 0 14px 22px #5b8f4c40;
	}
	.backdrop.football .lines {
		position: absolute;
		inset: 8% 6% -10% 6%;
		border: 5px solid #ffffffb3;
		border-radius: 6px;
	}
	.backdrop.football .lines::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 38%;
		width: 170px;
		height: 170px;
		border: 5px solid #ffffffb3;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}
	/* Garage: a little town street. */
	.backdrop.garage .city {
		position: absolute;
		left: 0;
		bottom: 34%;
		width: 100%;
		height: 30%;
	}
	.backdrop.garage .sidewalk {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 26%;
		height: 9%;
		background: repeating-linear-gradient(90deg, #e3ddd2 0 120px, #d7d0c3 120px 124px);
	}
	.backdrop.garage .road {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 27%;
		background: repeating-linear-gradient(90deg, #f4f4f0 0 70px, transparent 70px 140px) 0 50% / 100% 8px no-repeat, #6c737b;
		box-shadow: inset 0 8px 0 #565c63;
	}
	/* Birds: hills, a big tree trunk, drifting clouds. */
	.backdrop.birds .hill {
		position: absolute;
		bottom: -40%;
		border-radius: 50%;
	}
	.backdrop.birds .h1 { left: -10%; width: 70%; height: 70%; background: #a7d88c; }
	.backdrop.birds .h2 { right: -15%; width: 75%; height: 62%; background: #94cc7a; }
	.backdrop.birds .trunk {
		position: absolute;
		right: 6%;
		bottom: 0;
		width: 70px;
		height: 78%;
		border-radius: 30px 30px 0 0;
		background: linear-gradient(90deg, #8a6a52, #a07c60 60%, #8a6a52);
	}
	.backdrop.birds .trunk::before {
		content: '';
		position: absolute;
		top: -120px;
		left: -120px;
		width: 310px;
		height: 220px;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 40%, #6fbf73, #4e9f68 70%);
	}
	/* Gentle idle life so the scene never looks frozen. */
	.mover.ball:not(.hit):not(.miss):not(.back) {
		animation: idle-bounce 1.6s ease-in-out infinite;
	}
	.mover.car:not(.hit):not(.miss):not(.back) {
		animation: idle-rumble 0.9s ease-in-out infinite;
	}
	.bird {
		animation: land 600ms ease-out backwards, breathe 2.4s ease-in-out 600ms infinite;
	}
	@keyframes drift {
		from { translate: 0 0; }
		to { translate: 110vw 0; }
	}
	@keyframes idle-bounce {
		0%, 100% { translate: 0 0; }
		50% { translate: 0 -10px; }
	}
	@keyframes idle-rumble {
		0%, 100% { translate: 0 0; }
		50% { translate: 0 -2px; }
	}
	@keyframes breathe {
		0%, 100% { scale: 1; }
		50% { scale: 1.04; }
	}
	@media (prefers-reduced-motion: reduce) {
		.cloud, .mover.ball, .mover.car, .bird { animation: none !important; }
	}
</style>
