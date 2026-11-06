<script lang="ts">
	/**
	 * Flag picture mode (PR-27): Rumi asks "বাংলাদেশের পতাকা কোনটা?" and the child taps one of
	 * three flag pictures. No reading needed: the question is spoken and repeated when idle
	 * (PR-25), wrong taps get a gentle retry, help appears after two misses (PR-22).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { narrationText } from '@little-colors/core';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import { caption, instruct, leaveScreen, say, setIdlePrompt } from '#lib/audio/narrator.ts';
	import { hideHand, showHand } from '#lib/game/hand.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { createPictureQuiz, flagCountry, flagQuizReducer, pictureChoices, type FlagQuizAction } from './flagGame.ts';
	import { flagUrl } from './flagAssets.ts';

	let quiz = $state(createPictureQuiz(Date.now() >>> 0));
	const currentId = $derived(quiz.deck[quiz.index]!);
	const options = $derived(pictureChoices(quiz));
	const questionKey = $derived(`flags.find.${currentId}`);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const name = (id: string) => {
		const c = flagCountry(id);
		return $settings.language === 'bn-BD' ? c.label.bn : c.label.en;
	};

	function present() {
		hideHand();
		if (quiz.phase === 'finished') {
			setIdlePrompt(null);
			say('flags.done', { interrupt: true });
		} else {
			instruct(questionKey);
		}
	}

	function dispatch(action: FlagQuizAction) {
		if ($paused) return;
		const before = quiz;
		const next = flagQuizReducer(quiz, action, pictureChoices);
		if (next === before) return;
		quiz = next;
		if (action.type === 'ANSWER') {
			if (next.phase === 'correct') {
				hideHand();
				say('flags.correct', { interrupt: true });
				setIdlePrompt('ui.tap-next');
			} else if (next.hint && !before.hint) {
				// The quiz reducer turns help on by itself after two misses (PR-22): point at the
				// answer and repeat the question instead of making the child find a button.
				showHelp();
			} else {
				say('feedback.try-again', { interrupt: true });
			}
		} else if (action.type === 'HINT') {
			showHelp();
		} else if (action.type === 'NEXT') {
			present();
		}
	}

	function showHelp() {
		say(questionKey, { interrupt: true });
		showHand([`[data-flag-picture="${currentId}"]`]);
	}

	function replay() {
		quiz = createPictureQuiz((quiz.seed + 1) >>> 0);
		present();
	}

	onMount(present);
	onDestroy(() => {
		hideHand();
		leaveScreen();
	});

	// Re-speak in the new language when the language switches mid-question.
	let lastLang = $settings.language;
	$effect(() => {
		if ($settings.language !== lastLang) {
			lastLang = $settings.language;
			if (quiz.phase === 'play') caption.set(text(questionKey));
		}
	});
</script>

<div class="pictures" data-testid="flag-pictures">
	<div class="progress" aria-hidden="true">
		{#each quiz.deck as id, i (id)}
			<span class="pdot" class:filled={i < quiz.index || (i === quiz.index && quiz.phase !== 'play')}></span>
		{/each}
	</div>

	{#if quiz.phase === 'finished'}
		<div class="done">
			<div class="badge" aria-hidden="true">🏳️ 🏅</div>
			<p class="prompt">{text('flags.done')}</p>
			<GameButton action="replay" onclick={replay} />
		</div>
	{:else}
		<p class="prompt" data-testid="flag-picture-prompt">{text(questionKey)}</p>
		<div class="options" role="group" aria-label={text(questionKey)}>
			{#each options as option (option.id)}
				{@const isAnswer = option.id === currentId}
				<button
					class="option"
					class:correct={quiz.phase === 'correct' && isAnswer}
					class:hinted={quiz.hint && quiz.phase === 'play' && isAnswer}
					data-flag-picture={option.id}
					aria-label={name(option.id)}
					disabled={quiz.phase !== 'play' || $paused}
					onclick={() => dispatch({ type: 'ANSWER', id: option.id })}
				>
					<img src={flagUrl(option.id)} alt="" draggable="false" />
					{#if quiz.phase === 'correct' && isAnswer}<span class="tick" aria-hidden="true">✓</span>{/if}
				</button>
			{/each}
		</div>
		<p class="feedback" role="status">
			{#if quiz.phase === 'correct'}{text('flags.correct')}{:else if quiz.attempts}{text('feedback.try-again')}{/if}
		</p>
		<div class="actions">
			{#if quiz.phase === 'correct'}
				<GameButton action="next" onclick={() => dispatch({ type: 'NEXT' })} />
			{:else if quiz.attempts >= 1 && !quiz.hint}
				<!-- Help is offered after the first miss; after the second it appears by itself. -->
				<GameButton action="hint" size="small" onclick={() => dispatch({ type: 'HINT' })} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.pictures {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		width: 100%;
	}
	.progress {
		display: flex;
		gap: 10px;
	}
	.pdot {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
	}
	.pdot.filled {
		background: var(--text-secondary);
	}
	.prompt {
		margin: 4px 0;
		font-size: clamp(24px, 3.2vw, 36px);
		font-weight: 700;
	}
	.options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		width: min(100%, 960px);
	}
	.option {
		position: relative;
		display: grid;
		place-items: center;
		padding: 14px;
		aspect-ratio: 4 / 3;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		transition: transform 200ms ease, border-color 200ms ease;
	}
	.option:hover:not(:disabled) {
		transform: translateY(-4px);
	}
	.option:disabled {
		cursor: default;
	}
	.option img {
		max-width: 100%;
		max-height: 100%;
		border-radius: 6px;
		box-shadow: 0 2px 6px rgb(0 0 0 / 18%);
	}
	.option.correct {
		border-color: var(--learn-green);
		border-width: 6px;
	}
	.option.hinted {
		border: 5px dashed var(--learn-green);
		animation: pulse 1.2s ease-in-out 3;
	}
	.tick {
		position: absolute;
		top: 8px;
		right: 10px;
		padding: 0 8px;
		border-radius: 50%;
		background: var(--learn-green);
		color: #fff;
		font-size: 22px;
		font-weight: 800;
	}
	.feedback {
		min-height: 1.4em;
		margin: 0;
		font-size: 22px;
	}
	.actions {
		display: flex;
		justify-content: center;
		min-height: 72px;
	}
	.done {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.badge {
		font-size: 72px;
	}
	@keyframes pulse {
		50% { transform: scale(1.03); }
	}
	@media (prefers-reduced-motion: reduce) {
		.option.hinted { animation: none; }
	}
	@media (max-width: 560px) {
		.options { gap: 10px; }
		.option { padding: 8px; }
	}
</style>
