<script lang="ts">
	/**
	 * Animal Detective: find the named animal among photos, or count how many photos show it.
	 * Rules: no scores/star tallies (PR-07), gentle retry + help after two misses (PR-22),
	 * spoken & repeated instructions and pictogram buttons so non-readers can play (PR-25/26).
	 */
	import { onDestroy, tick } from 'svelte';
	import { asset } from '$app/paths';
	import { DETECTIVE_ANIMALS, createRng, formatNumeral, narrationText, shuffle } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
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

	const round = $derived(rounds[index]);
	const solved = $derived(solvedCount > index);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const numeral = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const name = (animal: Animal) => ($settings.language === 'bn-BD' ? animal.bn : animal.en);
	const questionKey = $derived(round ? `animals.${mode === 'name' ? 'find' : 'count'}.${round.target.id}` : 'mode.animals');
	const replayKey = $derived(feedback || (mode && !round ? 'animals.done' : questionKey));
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

	async function answer(correct: boolean) {
		if ($paused || solved) return;
		if (correct) {
			solvedCount += 1;
			feedback = 'animals.correct';
			hideHand();
			say(feedback, { interrupt: true });
			setIdlePrompt('ui.tap-next');
			await tick();
			document.querySelector<HTMLElement>('[data-action="next"]')?.focus();
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
	const offPause = paused.subscribe((value) => {
		if (value) stopNarration();
	});
	onDestroy(() => {
		offPause();
		hideHand();
		leaveScreen();
		caption.set('');
	});
</script>

<TopBar onreplay={() => { if (!$paused) say(replayKey, { interrupt: true }); }} />

<section class="detective" aria-labelledby="animal-title">
	<h1 id="animal-title"><span aria-hidden="true">🔎</span> {text('mode.animals')}</h1>
	<div class="modes" role="group" aria-label={text('mode.animals')}>
		<button aria-pressed={mode === 'name'} disabled={$paused} onclick={() => start('name')}>
			<span class="mode-icon" aria-hidden="true">🔎</span>{text('animals.name')}
		</button>
		<button aria-pressed={mode === 'count'} disabled={$paused} onclick={() => start('count')}>
			<span class="mode-icon" aria-hidden="true">🔢</span>{text('animals.count')}
		</button>
	</div>

	{#if mode}
		<!-- Progress dots, not a score (PR-07). -->
		<div class="progress" aria-hidden="true">
			{#each rounds as r, i (i)}
				<span class="pdot" class:filled={i < solvedCount}></span>
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
						onclick={() => (mode === 'name' ? answer(isTarget(photo)) : mark(position))}
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
						<button class:match={solved && choice === round.quantity} disabled={$paused || solved} onclick={() => answer(choice === round.quantity)}>
							<span class="num">{numeral(choice)}</span>
							<span class="dots" aria-hidden="true">{#each Array.from({ length: choice }, (_, i) => i) as i (i)}<span class="dot-mark"></span>{/each}</span>
						</button>
					{/each}
				</div>
			{/if}
			<div class="feedback" role="status">
				{#if solved}<span class="reward" aria-hidden="true">✨ 🔎 ✨</span>{/if}
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
			<div class="badge reward" aria-hidden="true">🏅</div>
			<h2 tabindex="-1" bind:this={prompt}>{text('animals.done')}</h2>
			<GameButton action="replay" label={text('animals.again')} onclick={() => { if (mode) start(mode); }} />
		{/if}
	{/if}
</section>

<style>
	.detective { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px 24px; text-align: center; }
	h1 { font-size: clamp(30px, 4vw, 48px); margin: 0 0 10px; }
	h2 { font-size: clamp(20px, 3vw, 30px); margin: 8px 0; }
	.modes, .numbers { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 8px 0; }
	button { min-height: 56px; padding: 6px 16px; border: 3px solid var(--border-soft); border-radius: 14px; background: var(--surface); font-size: 20px; cursor: pointer; }
	button:disabled { cursor: default; }
	button[aria-pressed='true'] { border-color: var(--text-primary); background: var(--bg-secondary); }
	.mode-icon { font-size: 28px; margin-right: 8px; vertical-align: middle; }
	.progress { display: flex; justify-content: center; gap: 10px; margin: 8px 0; }
	.pdot { width: 18px; height: 18px; border-radius: 50%; border: 3px solid var(--text-secondary); }
	.pdot.filled { background: var(--text-secondary); }
	.photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 640px; margin: 10px auto; }
	.photos.counting { grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: 540px; }
	.photo { position: relative; overflow: hidden; padding: 0; aspect-ratio: 4 / 3; }
	.photo img { display: block; width: 100%; height: 100%; object-fit: contain; }
	.check { position: absolute; top: 3px; right: 3px; padding: 0 6px; border-radius: 50%; background: var(--surface); color: var(--text-primary); font-weight: 800; }
	.match { outline: 3px solid var(--text-primary); outline-offset: 2px; }
	.hinted { outline: 4px dashed var(--learn-green); outline-offset: 2px; animation: pulse 1.2s ease-in-out 3; }
	.numbers button { min-width: 88px; display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
	.num { font-size: 28px; font-weight: 700; line-height: 1; }
	.dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; max-width: 64px; }
	.dot-mark { width: 9px; height: 9px; border-radius: 50%; background: var(--text-secondary); }
	.feedback { min-height: 1.5em; margin: 8px 0; font-size: 20px; }
	.actions { display: flex; justify-content: center; min-height: 72px; }
	.reward { display: block; font-size: 36px; animation: celebrate 550ms ease-out both; }
	.badge { margin-top: 16px; font-size: 84px; }
	@keyframes celebrate {
		0% { opacity: 0; transform: scale(.5) rotate(-12deg); }
		65% { opacity: 1; transform: scale(1.18) rotate(8deg); }
		100% { transform: scale(1); }
	}
	@keyframes pulse { 50% { outline-offset: 6px; } }
	@media (prefers-reduced-motion: reduce) { .reward, .hinted { animation: none; } }
	@media (max-width: 440px) { .photos.counting { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 280px; } }
</style>
