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
	import { instruct, replayInstruction, say, stopNarration } from '#lib/audio/narrator.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

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
				}
				break;
			case 'hint':
				hintId = effect.optionId;
				scheduler.after(2400, () => (hintId = null));
				break;
			case 'celebrate':
				mascot = 'celebrate';
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
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		instruct(activity.instructionKey);
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
		stopNarration();
	});

	const locked = $derived(mState !== 'READY');
	const isChosen = (id: string) => ctx?.chosenId === id && mState !== 'READY';
	const won = (id: string) =>
		ctx?.chosenId === id && (mState === 'CORRECT' || mState === 'CELEBRATING' || mState === 'COMPLETE');
</script>

{#snippet goalArt(o: ChoiceOption)}
	<svg viewBox="0 0 120 100" width="150" height="125" aria-hidden="true">
		<path d="M8 96 V10 H112 V96" fill="none" stroke={o.color ? `var(--learn-${o.color})` : 'var(--text-primary)'} stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M14 34 H106 M14 58 H106 M14 82 H106 M38 14 V96 M60 14 V96 M82 14 V96" stroke="var(--border-soft)" stroke-width="3" />
		{#if o.number !== undefined}
			<circle cx="60" cy="56" r="26" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="4" />
			<text x="60" y="68" text-anchor="middle" font-size="34" font-weight="700" fill="var(--text-primary)">{num(o.number)}</text>
		{/if}
	</svg>
{/snippet}

{#snippet ballArt()}
	<svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
		<circle cx="50" cy="50" r="44" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="4" />
		<polygon points="50,30 63,39 58,54 42,54 37,39" fill="var(--text-primary)" />
		<path d="M50 30 V8 M63 39 L84 30 M58 54 L70 74 M42 54 L30 74 M37 39 L16 30" stroke="var(--text-primary)" stroke-width="3" fill="none" />
	</svg>
{/snippet}

{#snippet carArt(color: string, passengers: number)}
	<svg viewBox="0 0 160 100" width="170" height="106" aria-hidden="true">
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
	<svg viewBox="0 0 140 120" width="170" height="146" aria-hidden="true">
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
	<svg viewBox="0 0 60 50" width="62" height="52" aria-hidden="true">
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
	{#if roundDone}
		<div class="done">
			<Mascot state="celebrate" size={240} />
			<div class="actions">
				<GameButton label={t('replayRound', lang)} onclick={replayRound} />
				<GameButton label={t('chooseGame', lang)} variant="secondary" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else if a && ctx}
		<div class="progress" aria-hidden="true">
			{#each round.activities as x, i (x.id)}
				<span class="pdot" class:filled={i < index || (i === index && mState === 'COMPLETE')}></span>
			{/each}
		</div>

		<div class="field">
			<div class="mascot"><Mascot state={mascot} size={170} /></div>

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
				<GameButton label={t('next', lang)} onclick={next}>
					<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
				</GameButton>
			{:else if ctx.hintEnabled && mState === 'READY'}
				<GameButton label={t('hint', lang)} variant="secondary" size="small" onclick={() => machine?.send({ type: 'HINT' })} />
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
		transition: transform 250ms ease, border-color 250ms ease;
	}
	.option:hover:not([aria-disabled='true']) {
		transform: translateY(-4px);
	}
	.option[aria-disabled='true'] {
		cursor: default;
	}
	.option.chosen {
		border-color: var(--text-secondary);
	}
	.option.won {
		border-color: var(--text-primary);
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
</style>
