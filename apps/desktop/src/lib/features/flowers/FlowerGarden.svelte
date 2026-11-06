<script lang="ts">
	import { onDestroy } from 'svelte';
	import { LEARNING_FLOWERS, createRng, shuffle, narrationText, formatNumeral } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import FlowerPicture from './FlowerPicture.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';

	type Flower = (typeof LEARNING_FLOWERS)[number];
	type Game = 'name' | 'count';
	type Choice = Flower | number;
	interface Question { flower: Flower; quantity: number; choices: Choice[] }

	let mode = $state<'learn' | Game>('learn');
	let selected = $state<Flower>(LEARNING_FLOWERS[0]);
	let questions = $state<Question[]>([]);
	let index = $state(0);
	let answered = $state(false);
	let hinted = $state(false);
	let marks = $state<number[]>([]);
	let feedback = $state('flower.explore');
	let heading: HTMLHeadingElement;
	const question = $derived(questions[index]);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const name = (flower: Flower) => text(`flower.label.${flower.id}`);
	const numeral = (value: number) => formatNumeral(value, $settings.numeralStyle);

	function announce(key: string) {
		feedback = key;
		say(key, { interrupt: true });
	}

	function start(game: Game) {
		const rng = createRng(Date.now() >>> 0);
		const quantities = [1, 2, 3, 4, 5, 6];
		const counts = shuffle(quantities, rng);
		questions = shuffle(LEARNING_FLOWERS, rng).map((flower, i) => {
			const quantity = counts[i]!;
			const choices = game === 'count'
				? shuffle([quantity, ...shuffle(quantities.filter(n => n !== quantity), rng).slice(0, 2)], rng)
				: shuffle([flower, ...shuffle(LEARNING_FLOWERS.filter(item => item.id !== flower.id), rng).slice(0, 2)], rng);
			return { flower, quantity, choices };
		});
		mode = game;
		index = 0;
		resetQuestion();
	}

	function resetQuestion() {
		answered = false;
		hinted = false;
		marks = [];
		announce(question ? `flower.question.${mode}` : 'flower.done');
		heading.focus();
	}

	function correct(choice: Choice, current: Question) {
		return typeof choice === 'number' ? choice === current.quantity : choice.id === current.flower.id;
	}

	function answer(choice: Choice, current: Question) {
		if ($paused || answered) return;
		answered = correct(choice, current);
		announce(answered ? 'flower.correct' : 'flower.retry');
	}

	function mark(position: number) {
		marks = marks.includes(position) ? marks.filter(marked => marked !== position) : [...marks, position];
	}

	$effect(() => caption.set(text(feedback)));
	const offPause = paused.subscribe(value => { if (value) stopNarration(); });
	onDestroy(() => { offPause(); stopNarration(); caption.set(''); });
</script>

<TopBar onreplay={() => { if (!$paused) say(feedback, { interrupt: true }); }} />

<section aria-labelledby="flower-title" class="garden">
	<h1 id="flower-title" tabindex="-1" bind:this={heading}>{text('flower.title')}</h1>
	<div class="controls" role="group" aria-label={text('flower.title')}>
		<button aria-pressed={mode === 'learn'} disabled={$paused} onclick={() => { mode = 'learn'; announce('flower.explore'); }}>{text('flower.learn')}</button>
		<button aria-pressed={mode === 'name'} disabled={$paused} onclick={() => start('name')}>{text('flower.name')}</button>
		<button aria-pressed={mode === 'count'} disabled={$paused} onclick={() => start('count')}>{text('flower.count')}</button>
	</div>

	{#if mode === 'learn'}
		<div class="preview">
			<FlowerPicture id={selected.id} size={145} />
			<div><h2 lang="bn">{selected.bn}</h2><p lang="en">{selected.en}</p>
				<button disabled={$paused || !$settings.soundEnabled} onclick={() => announce(`flower.label.${selected.id}`)}>♪ {text('flower.listen')}</button>
			</div>
		</div>
		<div class="controls">
			{#each LEARNING_FLOWERS as flower (flower.id)}
				<button class="flower-card" aria-pressed={selected.id === flower.id} disabled={$paused} onclick={() => { selected = flower; announce(`flower.label.${flower.id}`); }}>
					<FlowerPicture id={flower.id} size={85} /><span>{name(flower)}</span>
				</button>
			{/each}
		</div>
	{:else if question}
		<p>{numeral(index + 1)} / {numeral(questions.length)} · {text(`flower.question.${mode}`)}</p>
		{#if mode === 'name'}
			<FlowerPicture id={question.flower.id} size={155} />
		{:else}
			<div class="controls" aria-label={text('flower.count')} role="group">
				{#each Array(question.quantity) as _, position}
					<button class="counter" aria-label={`${name(question.flower)} ${numeral(position + 1)}`} aria-pressed={marks.includes(position)} disabled={$paused || answered} onclick={() => mark(position)}>
						<FlowerPicture id={question.flower.id} size={68} />
						{#if marks.includes(position)}<span aria-hidden="true">✓</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
		<div class="controls answers">
			{#each question.choices as choice}
				<button class:hinted={(hinted || answered) && correct(choice, question)} disabled={$paused || answered} onclick={() => answer(choice, question)}>
					{typeof choice === 'number' ? numeral(choice) : name(choice)}
				</button>
			{/each}
		</div>
		<p role="status">{text(feedback)}</p>
		{#if answered}
			<button disabled={$paused} onclick={() => { index += 1; resetQuestion(); }}>{text('flower.next')} →</button>
		{:else}
			<button disabled={$paused || hinted} onclick={() => { hinted = true; announce('flower.hint'); }}>{text('flower.help')}</button>
		{/if}
	{:else}
		<FlowerPicture id={questions[questions.length - 1]!.flower.id} size={155} />
		<p role="status">{text('flower.done')}</p>
	{/if}
</section>

<style>
	.garden { flex: 1; min-height: 0; overflow: auto; padding: 16px 24px 28px; text-align: center; }
	h1 { font-size: clamp(30px, 4vw, 48px); margin: 0 0 16px; }
	h2 { margin: 0; font-size: 32px; }
	p { font-size: 22px; margin: 14px auto; }
	.controls { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 12px; margin: 12px auto; }
	button { min-height: 52px; padding: 8px 18px; border: 3px solid var(--border-soft); border-radius: 16px; background: var(--surface); font-size: 21px; cursor: pointer; }
	button:disabled { cursor: default; opacity: .65; }
	button[aria-pressed='true'] { background: var(--bg-secondary); border-color: var(--text-primary); }
	.preview { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 26px; margin: 18px auto; }
	.flower-card { display: grid; justify-items: center; gap: 4px; }
	.counter { position: relative; padding: 3px; }
	.counter span { position: absolute; top: 2px; right: 4px; font-size: 24px; font-weight: 700; }
	.answers button { min-width: 95px; font-size: 27px; }
	.answers .hinted { outline: 3px dashed var(--text-primary); outline-offset: 3px; opacity: 1; }
</style>
