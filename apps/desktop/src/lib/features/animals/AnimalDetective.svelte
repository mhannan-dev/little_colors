<script lang="ts">
	/**
	 * Animal Detective: find the named animal among photos, or count how many photos show it.
	 * Rules: no scores/star tallies (PR-07), gentle retry + help after two misses (PR-22),
	 * spoken & repeated instructions and pictogram buttons so non-readers can play (PR-25/26).
	 */
	import { onDestroy, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { asset } from '$app/paths';
	import { DETECTIVE_ANIMALS, createRng, formatNumeral, narrationText, shuffle } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import DetectiveBadge from './DetectiveBadge.svelte';
	import { playFlowerPickupChime as playClueChime } from '#lib/features/garden3d/gardenSfx.ts';
	import { caption, instruct, leaveScreen, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { hideHand, showHand } from '#lib/game/hand.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';

	type Animal = (typeof DETECTIVE_ANIMALS)[number];
	type Mode = 'name' | 'count';
	type Photo = { animal: Animal; src: string };
	type Round = { target: Animal; photos: Photo[]; quantity: number; choices: number[] };

	const COUNTS = [1, 2, 3, 4, 5, 6];
	const HINT_AFTER = 2; // PR-22

	let mode = $state<Mode | null>(null);
	let rounds = $state<Round[]>([]);
	let index = $state(0);
	/** Rounds solved so far; drives progress dots only, never shown as a score. */
	let solvedCount = $state(0);
	let attempts = $state(0);
	let hinted = $state(false);
	let marks = $state<number[]>([]);
	let feedback = $state('');
	let prompt = $state<HTMLHeadingElement>();
	let notebook = $state<HTMLDivElement>();
	let progressTrack = $state<HTMLDivElement>();
	let flyingStar = $state<HTMLSpanElement>();
	let flight: Animation | undefined;
	const systemMotion = new MediaQuery('prefers-reduced-motion: reduce');
	const reducedMotion = $derived($settings.reducedMotion || systemMotion.current);

	const round = $derived(rounds[index]);
	const solved = $derived(solvedCount > index);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const numeral = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const name = (animal: Animal) => ($settings.language === 'bn-BD' ? animal.bn : animal.en);
	const questionKey = $derived(round ? `animals.${mode === 'name' ? 'find' : 'count'}.${round.target.id}` : 'mode.animals');
	const replayKey = $derived(feedback || (!mode ? 'animals.intro' : round ? questionKey : 'animals.done'));
	const isTarget = (photo: Photo) => !!round && photo.animal.id === round.target.id;

	async function focusPrompt() {
		await tick();
		prompt?.focus();
	}

	function start(game: Mode) {
		if ($paused) return;
		const rng = createRng(Date.now() >>> 0);
		const quantities = shuffle(COUNTS, rng);
		const targets = shuffle(DETECTIVE_ANIMALS, rng);
		const photo = (animal: Animal, offset = 0): Photo => {
			const file = animal.photos[offset % animal.photos.length]!;
			return { animal, src: asset(`images/${file}.webp`) };
		};
		rounds = (game === 'name' ? targets : targets.slice(0, COUNTS.length)).map((target, i) => {
			const others = shuffle(DETECTIVE_ANIMALS.filter((animal) => animal.id !== target.id), rng);
			const quantity = game === 'name' ? 1 : quantities[i]!;
			const matches = Array.from({ length: quantity }, (_, offset) => photo(target, i + offset));
			const distractors = others.slice(0, game === 'name' ? 2 : 7 - quantity).map((animal) => photo(animal, i));
			const choices =
				game === 'name' ? [] : shuffle([quantity, ...shuffle(COUNTS.filter((v) => v !== quantity), rng).slice(0, 2)], rng);
			return { target, quantity, photos: shuffle([...matches, ...distractors], rng), choices };
		});
		mode = game;
		index = 0;
		solvedCount = 0;
		presentRound();
	}

	function presentRound() {
		flight?.cancel();
		marks = [];
		feedback = '';
		attempts = 0;
		hinted = false;
		hideHand();
		if (round) {
			instruct(questionKey); // spoken, replayable, repeated when idle (PR-25)
		} else {
			setIdlePrompt(null);
			say('animals.done', { interrupt: true });
		}
		void focusPrompt();
	}

	function celebrateClue(source: EventTarget | null) {
		if ($settings.soundEnabled) playClueChime(index, $settings.volume * 0.25);
		if (reducedMotion || !(source instanceof HTMLElement) || !notebook || !flyingStar) return;
		const target = progressTrack?.children[index];
		if (!target) return;
		const stage = notebook.getBoundingClientRect();
		const zoom = stage.width / notebook.offsetWidth;
		const point = (element: Element): [number, number] => {
			const box = element.getBoundingClientRect();
			return [(box.left + box.width / 2 - stage.left) / zoom, (box.top + box.height / 2 - stage.top) / zoom];
		};
		const [x, y] = point(source);
		const [endX, endY] = point(target);
		flight?.cancel();
		flight = flyingStar.animate([
			{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.7)`, opacity: 1 },
			{ transform: `translate(${(x + endX) / 2}px, ${(y + endY) / 2 - 42}px) translate(-50%, -50%) scale(1.15)`, opacity: 1 },
			{ transform: `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(.55)`, opacity: 0 }
		], { duration: 560, easing: 'ease-out' });
	}

	async function answer(correct: boolean, source: EventTarget | null) {
		if ($paused || solved) return;
		if (correct) {
			celebrateClue(source);
			solvedCount += 1;
			feedback = 'animals.correct';
			hideHand();
			say(feedback, { interrupt: true });
			setIdlePrompt('ui.tap-next');
			await tick();
			notebook?.querySelector<HTMLElement>('[data-action="next"]')?.focus();
		} else {
			attempts += 1;
			feedback = 'animals.retry';
			say(feedback, { interrupt: true });
		}
	}

	/** Help after two misses: outline the right photo(s) and point at one with the hand. */
	function showHelp() {
		if (!round || solved) return;
		hinted = true;
		feedback = 'animals.hint';
		say('animals.hint', { interrupt: true });
		if (mode === 'count') {
			marks = round.photos.flatMap((p, i) => (isTarget(p) ? [i] : []));
		}
		const first = round.photos.findIndex(isTarget);
		if (first >= 0) showHand([`.photos .photo:nth-child(${first + 1})`]);
	}

	function mark(position: number) {
		marks = marks.includes(position) ? marks.filter((m) => m !== position) : [...marks, position];
	}

	function next() {
		index += 1;
		presentRound();
	}

	$effect(() => caption.set(text(replayKey)));
	$effect(() => {
		if (reducedMotion || $paused) flight?.cancel();
	});
	const offPause = paused.subscribe((value) => {
		if (value) stopNarration();
	});
	onDestroy(() => {
		flight?.cancel();
		offPause();
		hideHand();
		leaveScreen();
		caption.set('');
	});
</script>

<TopBar onreplay={() => { if (!$paused) say(replayKey, { interrupt: true }); }} />

<section class="detective" class:playing={!!mode} class:reduced={reducedMotion} aria-labelledby="animal-title">
	<div class="notebook" bind:this={notebook}>
	<span class="flying-star" bind:this={flyingStar} aria-hidden="true">★</span>
	<h1 id="animal-title"><span aria-hidden="true">🔎</span> {text('mode.animals')}</h1>
	{#if !mode}
		<div class="welcome-art"><Mascot state={reducedMotion ? 'rest' : 'wave'} size={130} /></div>
		<p class="intro">{text('animals.intro')}</p>
	{/if}
	<div class="modes" role="group" aria-label={text('mode.animals')}>
		<button aria-pressed={mode === 'name'} disabled={$paused} onclick={() => start('name')}>
			<span class="mode-icon" aria-hidden="true">🔎</span>{text('animals.name')}
		</button>
		<button aria-pressed={mode === 'count'} disabled={$paused} onclick={() => start('count')}>
			<span class="mode-icon" aria-hidden="true">🔢</span>{text('animals.count')}
		</button>
	</div>

	{#if mode}
		<!-- Each marker represents a round, without a numeric rating (PR-07). -->
		<div class="progress" bind:this={progressTrack} aria-hidden="true">
			{#each rounds as r, i (i)}
				<span class="pdot" class:filled={i < solvedCount}>{i < solvedCount ? '★' : '·'}</span>
			{/each}
		</div>
		{#if round}
			<h2 tabindex="-1" bind:this={prompt}>{text(questionKey)}</h2>
			<div class="photos" class:counting={mode === 'count'} role="group" aria-label={text(mode === 'name' ? 'animals.name' : 'animals.count')}>
				{#each round.photos as photo, position (position)}
					<button
						class="photo"
						class:match={solved && isTarget(photo)}
						class:hinted={hinted && !solved && isTarget(photo)}
						aria-label={name(photo.animal)}
						aria-pressed={mode === 'count' ? marks.includes(position) : undefined}
						disabled={$paused || solved}
						onclick={(event) => (mode === 'name' ? answer(isTarget(photo), event.currentTarget) : mark(position))}
					>
						<img src={photo.src} alt="" draggable="false" />
						{#if marks.includes(position) || (solved && isTarget(photo))}
							<span class="check" aria-hidden="true">✓</span>
						{/if}
					</button>
				{/each}
			</div>
			{#if mode === 'count'}
				<div class="numbers">
					{#each round.choices as choice (choice)}
						<button class:match={solved && choice === round.quantity} disabled={$paused || solved} onclick={(event) => answer(choice === round.quantity, event.currentTarget)}>
							<span class="num">{numeral(choice)}</span>
							<span class="dots" aria-hidden="true">{#each Array.from({ length: choice }, (_, i) => i) as i (i)}<span class="dot-mark"></span>{/each}</span>
						</button>
					{/each}
				</div>
			{/if}
			<div class="feedback" role="status">
				{#if solved}<span class="reward" aria-hidden="true">✓</span>{/if}
				{#if feedback}{text(feedback)}{/if}
			</div>
			<div class="actions">
				{#if solved}
					<GameButton action="next" label={text('animals.next')} onclick={next} />
				{:else if attempts >= HINT_AFTER && !hinted}
					<GameButton action="hint" size="small" onclick={showHelp} />
				{/if}
			</div>
		{:else}
			<div class="badge" aria-hidden="true">
				<Mascot state={reducedMotion ? 'rest' : 'celebrate'} size={144} />
				<DetectiveBadge {reducedMotion} />
			</div>
			<h2 tabindex="-1" bind:this={prompt}>{text('animals.done')}</h2>
			<GameButton action="replay" label={text('animals.again')} onclick={() => { if (mode) start(mode); }} />
		{/if}
	{/if}
	</div>
</section>

<style>
	/* A size container, so the photo grid can grow with the space actually available. */
	.detective {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 8px 16px 20px;
		text-align: center;
		container-type: size;
		background: radial-gradient(ellipse at top, #e1f0d8, #f3f6e9 70%);
	}
	.notebook {
		position: relative;
		box-sizing: border-box;
		width: min(1160px, 100%);
		margin: 0 auto;
		padding: 14px 16px 16px;
		border: 1px solid #c6d4b9;
		border-radius: 24px;
		background: #fffdf3;
		box-shadow: 0 5px 0 #cfdbc4, 0 14px 28px #294a301a;
	}
	.welcome-art { display: grid; place-items: center; margin: 12px auto 4px; }
	.intro { font-size: 22px; margin: 4px auto 16px; }
	/* While playing, the title shrinks so the photos get the room. */
	.detective.playing h1 { font-size: clamp(20px, 2.4vw, 28px); margin: 0 0 4px; }
	.detective.playing .modes { margin: 4px 0; }
	h1 { font-size: clamp(30px, 4vw, 48px); margin: 0 0 10px; color: #254a35; }
	h2 { font-size: clamp(20px, 3vw, 30px); margin: 8px 0; }
	.modes, .numbers { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 8px 0; }
	button { min-height: 56px; padding: 6px 16px; border: 3px solid var(--border-soft); border-radius: 14px; background: var(--surface); font-size: 20px; cursor: pointer; }
	button:disabled { cursor: default; }
	button[aria-pressed='true'] { border-color: var(--text-primary); background: var(--bg-secondary); }
	.mode-icon { font-size: 28px; margin-right: 8px; vertical-align: middle; }
	.progress { display: flex; justify-content: center; gap: 7px; margin: 8px 0; }
	.pdot { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #e8efde; color: #4b6648; line-height: 1; }
	.pdot.filled { color: #694318; background: #ffe5a0; }
	.flying-star { position: absolute; z-index: 2; top: 0; left: 0; pointer-events: none; opacity: 0; color: #b67717; font-size: 42px; line-height: 1; }
	/*
	 * Grid width = whatever fits both ways: the container width, and the height left after
	 * the notebook title, buttons, and feedback, turned into width via the 4:3 tiles.
	 * Find: 1 row of 3 tiles  → width ≈ (free height) × 4/3 × 3 = × 4.
	 * Count: 2 rows of 4 tiles → width ≈ (free height) / 2 × 4/3 × 4 ≈ × 2.67.
	 */
	.photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 8px auto; width: min(100%, max(300px, min(1080px, (100cqh - 330px) * 4))); }
	.photos.counting { grid-template-columns: repeat(4, minmax(0, 1fr)); width: min(100%, max(300px, min(1080px, (100cqh - 405px) * 2.67))); }
	.photo { position: relative; overflow: hidden; padding: 0; aspect-ratio: 4 / 3; border-color: #c6d4b9; box-shadow: 0 3px 0 #dfe6d5; }
	.photo img { display: block; width: 100%; height: 100%; object-fit: contain; background: #edf2e6; }
	.check { position: absolute; top: 5px; right: 5px; min-width: 28px; padding: 0 5px; border-radius: 14px; background: #24513b; color: white; font-weight: 800; }
	.match { outline: 3px solid #24513b; outline-offset: 2px; }
	.hinted { outline: 4px dashed var(--learn-green); outline-offset: 2px; animation: pulse 1.2s ease-in-out 3; }
	.numbers button { min-width: 88px; display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
	.num { font-size: 28px; font-weight: 700; line-height: 1; }
	.dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; max-width: 64px; }
	.dot-mark { width: 9px; height: 9px; border-radius: 50%; background: var(--text-secondary); }
	.feedback { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 32px; margin: 8px 0; font-size: 20px; }
	.actions { display: flex; justify-content: center; min-height: 72px; }
	.reward { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 50%; background: #24513b; color: white; font-weight: 800; animation: celebrate 550ms ease-out both; }
	.badge { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
	@keyframes celebrate {
		0% { opacity: 0; transform: scale(.5) rotate(-12deg); }
		65% { opacity: 1; transform: scale(1.18) rotate(8deg); }
		100% { transform: scale(1); }
	}
	@keyframes pulse { 50% { outline-offset: 6px; } }
	.reduced .reward, .reduced .hinted { animation: none; }
	.reduced :global(.rumi), .reduced :global(.rumi *) { animation: none; }
	@media (prefers-reduced-motion: reduce) { .reward, .hinted { animation: none; } }
	@media (max-width: 440px) {
		.photos, .photos.counting { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
	}
</style>
