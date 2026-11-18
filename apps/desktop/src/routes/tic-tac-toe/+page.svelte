<script lang="ts">
	import { onMount } from 'svelte';
	import { formatNumeral, narrationText } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say, setIdlePrompt } from '#lib/audio/narrator.ts';
	import { boardFor, chooseMove, VARIANTS, winningLine, type Difficulty, type Mark, type Move, type Variant } from '#lib/features/tic-tac-toe/board.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';

	const variants = [
		{ id: 'classic', en: 'Classic', bn: 'ক্লাসিক' },
		{ id: 'infinity', en: 'Infinity', bn: 'ইনফিনিটি' },
		{ id: 'five', en: '5×5', bn: '৫×৫' },
		{ id: 'six', en: '6×6', bn: '৬×৬' }
	] as const;
	const levels = [
		{ id: 'easy', en: 'Easy', bn: 'সহজ' },
		{ id: 'medium', en: 'Medium', bn: 'মাঝারি' },
		{ id: 'hard', en: 'Hard', bn: 'কঠিন' }
	] as const;
	let variant = $state<Variant>('classic');
	let difficulty = $state<Difficulty>('easy');
	let opponent = $state<'solo' | 'two'>('solo');
	let moves = $state.raw<Move[]>([]);
	let hint = $state<number>();
	const rules = $derived(VARIANTS[variant]);
	const board = $derived(boardFor(moves, rules));
	const line = $derived(winningLine(board, rules));
	const winner = $derived(line ? board[line[0]] : null);
	const draw = $derived(!winner && board.every(Boolean));
	const turn = $derived<Mark>(moves.length % 2 === 0 ? 'X' : 'O');
	const thinking = $derived(opponent === 'solo' && turn === 'O' && !winner && !draw);
	const playable = $derived(!$paused && !thinking && !winner && !draw);
	const fading = $derived(rules.fading && moves.length >= 6 && !winner ? moves[moves.length - 6].index : undefined);
	const bn = $derived($settings.language === 'bn-BD');
	const statusKey = $derived(winner ? `tic-tac-toe.win-${winner.toLowerCase()}` : draw ? 'tic-tac-toe.draw'
		: thinking ? 'tic-tac-toe.computer-turn' : `tic-tac-toe.turn-${turn.toLowerCase()}`);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const number = (n: number) => formatNumeral(n, $settings.numeralStyle);

	function place(index: number) {
		if ($paused || board[index] !== null || winner || draw) return;
		moves = [...moves, { index, mark: turn }];
		hint = undefined;
		if (winner || draw) {
			setIdlePrompt(null);
			say(statusKey, { interrupt: true });
		}
	}
	function reset() {
		moves = [];
		hint = undefined;
		instruct('tic-tac-toe.intro');
	}
	function undo() {
		if (moves.length === 0) return;
		const count = opponent === 'solo' && moves.at(-1)?.mark === 'O' ? 2 : 1;
		moves = moves.slice(0, -count);
		hint = undefined;
		setIdlePrompt('tic-tac-toe.intro');
	}
	function changeVariant(value: Variant) {
		if (value === variant) return;
		variant = value;
		reset();
	}
	function changeOpponent(value: 'solo' | 'two') {
		if (value === opponent) return;
		opponent = value;
		reset();
	}
	$effect(() => {
		if (!thinking || $paused) return;
		const current = moves;
		const currentVariant = variant;
		const level = difficulty;
		const timer = setTimeout(() => {
			if (!thinking || moves !== current) return;
			const index = chooseMove(current, currentVariant, 'O', level);
			if (index !== undefined) place(index);
		}, $settings.reducedMotion ? 0 : 360);
		return () => clearTimeout(timer);
	});
	onMount(() => {
		instruct('tic-tac-toe.intro');
		return leaveScreen;
	});
</script>

<svelte:head><title>Tic-Tac-Toe · Rumi Learning Adventures</title></svelte:head>
<div class="game">
	<TopBar onreplay={() => instruct('tic-tac-toe.intro')} />
	<section class="arena">
		<aside class="summary">
			<div class="brand"><h1>{text('mode.tic-tac-toe')}</h1><span>{bn ? 'আল্টিমেট' : 'ULTIMATE'}</span></div>
			<div class="players">
				<div class="player" class:current={!winner && !draw && turn === 'X'}><strong class="mark-x" aria-hidden="true">×</strong>{opponent === 'solo' ? (bn ? 'তুমি' : 'You') : (bn ? 'খেলোয়াড় ১' : 'Player 1')}</div>
				<div class="player" class:current={!winner && !draw && turn === 'O'}><strong class="mark-o" aria-hidden="true">○</strong>{opponent === 'solo' ? (bn ? 'কম্পিউটার' : 'Computer') : (bn ? 'খেলোয়াড় ২' : 'Player 2')}</div>
			</div>
			<p class="status" aria-live="polite">{text(statusKey)}</p>
			<div class="actions">
				<button class="hint-button" disabled={!playable} onclick={() => hint = chooseMove(moves, variant, turn, 'hard')}><span aria-hidden="true">✦</span> {bn ? 'ইঙ্গিত' : 'Hint'}</button>
				<button disabled={moves.length === 0} onclick={undo}><span aria-hidden="true">↶</span> {bn ? 'ফিরিয়ে নাও' : 'Undo'}</button>
				<button class="reset" onclick={reset}><span aria-hidden="true">↻</span> {bn ? 'আবার খেলি' : 'Play again'}</button>
			</div>
		</aside>
		<div class="board-area">
			<div class="board" style:--size={rules.size} role="group" aria-label={bn ? 'টিক-ট্যাক-টো বোর্ড' : 'Tic-Tac-Toe board'}>
				{#each board as cell, index (index)}
					<button class="cell" class:mark-x={cell === 'X'} class:mark-o={cell === 'O'} class:win={line?.includes(index)}
						class:fading={fading === index} class:suggested={hint === index}
						aria-disabled={!!cell || !playable}
						aria-label={bn ? `${number(index + 1)} নম্বর ঘর, ${cell ?? 'খালি'}` : `Square ${number(index + 1)}, ${cell ?? 'empty'}`}
						onclick={() => { if (playable) place(index); }}>
						{#if cell === 'X'}
							<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 16l32 32m0-32L16 48" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" /></svg>
						{:else if cell === 'O'}
							<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="19" fill="none" stroke="currentColor" stroke-width="8" /></svg>
						{/if}
					</button>
				{/each}
			</div>
			<p class="rule" aria-live="polite">{hint !== undefined
				? (bn ? `${number(hint + 1)} নম্বর ঘরটি চেষ্টা করো।` : `Try square ${number(hint + 1)}.`)
				: rules.fading ? (bn ? 'চতুর্থ চিহ্ন বসালে সবচেয়ে পুরোনোটি মুছে যায়।' : 'Your fourth mark replaces your oldest.')
				: (bn ? `এক সারিতে ${number(rules.run)}টি চিহ্ন মেলাও।` : `Get ${number(rules.run)} in a row to win.`)}</p>
		</div>
		<aside class="options">
			<p class="label">{bn ? 'খেলার ধরন' : 'MODE'}</p>
			<div class="variants" role="group" aria-label={bn ? 'খেলার ধরন' : 'Board mode'}>
				{#each variants as item (item.id)}
					<button aria-pressed={variant === item.id} onclick={() => changeVariant(item.id)}>{bn ? item.bn : item.en}</button>
				{/each}
			</div>
			<p class="label">{bn ? 'কার সঙ্গে খেলবে' : 'PLAY AGAINST'}</p>
			<div class="segmented" role="group" aria-label={bn ? 'প্রতিপক্ষ' : 'Opponent'}>
				<button aria-pressed={opponent === 'solo'} onclick={() => changeOpponent('solo')}>{bn ? 'কম্পিউটার' : 'Vs. computer'}</button>
				<button aria-pressed={opponent === 'two'} onclick={() => changeOpponent('two')}>{bn ? 'দুজন' : 'Two players'}</button>
			</div>
			{#if opponent === 'solo'}
				<p class="label">{bn ? 'কঠিনতার মাত্রা' : 'LEVEL'}</p>
				<div class="segmented" role="group" aria-label={bn ? 'কঠিনতার মাত্রা' : 'Difficulty'}>
					{#each levels as item (item.id)}
						<button aria-pressed={difficulty === item.id} onclick={() => difficulty = item.id}>{bn ? item.bn : item.en}</button>
					{/each}
				</div>
			{/if}
		</aside>
	</section>
</div>

<style>
	.game { --hud-surface: #241538; --hud-ink: #faf2ff; }
	.options { padding: 18px; border: 1px solid #72518d66; border-radius: 22px; background: linear-gradient(150deg, #302044b3, #160e2be6); box-shadow: 0 16px 36px #07031b40; }
	.player { box-shadow: inset 0 1px 0 #ffffff12, 0 5px 12px #07031b30; }
	.variants button { min-height: 54px; }
	.game { display: flex; flex: 1; flex-direction: column; min-height: 100%; color: #faf2ff; background: radial-gradient(ellipse at 10% 0%, #42205a, transparent 58%), radial-gradient(ellipse at 85% 100%, #152f54, transparent 45%), #130d2b; }
	.game > :global(header .icon), .game > :global(header .language-switcher) { background: #241538; border-color: #624783; }
	.game > :global(header .language-switcher button) { background: #241538; }
	.game > :global(header button[aria-pressed='true']) { background: #462762; border-color: #bd8ee8; }
	.arena { flex: 1; display: grid; grid-template-columns: minmax(155px, 205px) minmax(0, 530px) minmax(165px, 225px); justify-content: center; align-items: start; gap: clamp(12px, 2vw, 26px); padding: 14px 20px 24px; }
	.summary, .options { display: flex; flex-direction: column; gap: 12px; }
	.brand { text-align: center; margin: 0 0 7px; }
	h1 { margin: 0 0 4px; font-size: clamp(22px, 2.6vw, 34px); line-height: 1.15; text-shadow: 0 0 16px #ee63da9c; }
	.brand span { display: inline-block; border: 1px solid #65e4f4; border-radius: 8px; padding: 2px 9px; color: #9af3ff; font-size: 12px; font-weight: 700; letter-spacing: .2em; }
	.players { display: flex; flex-direction: column; gap: 8px; }
	.player { display: flex; align-items: center; gap: 10px; padding: 6px 11px; min-height: 52px; font-size: 18px; font-weight: 700; background: #170d2a; border: 2px solid #4c3568; border-radius: 13px; }
	.player.current { border-color: #b68af4; box-shadow: 0 0 12px #a875e14d; }
	.player strong { font: 700 35px/1 system-ui, sans-serif; }
	.status { margin: 0; min-height: 1.35em; font-size: clamp(20px, 2.5vw, 29px); font-weight: 700; line-height: 1.2; text-align: center; }
	.actions, .segmented { display: flex; gap: 7px; }
	.actions { flex-wrap: wrap; }
	.actions button, .segmented button { flex: 1; }
	.actions .reset { flex-basis: 100%; }
	button { min-height: 44px; padding: 6px 9px; color: inherit; border: 2px solid #65477f; border-radius: 12px; background: #25153c; font-size: 16px; font-weight: 700; cursor: pointer; touch-action: manipulation; }
	button:not(:disabled):hover { border-color: #c8a0f8; }
	button:focus-visible { outline: 3px solid #ffe681; outline-offset: 2px; }
	button:disabled { opacity: .45; cursor: default; }
	button.hint-button { background: #ffdc85; border-color: #ffdc85; color: #2f2040; }
	.board-area { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
	.board { display: grid; grid-template-columns: repeat(var(--size), minmax(0, 1fr)); gap: 3px; width: min(100%, 510px, calc(100dvh - 165px)); padding: 12px; background: #8050b1; border: 2px solid #aa77de; border-radius: 21px; box-shadow: 0 0 22px #b85af451; }
	.cell { display: grid; place-items: center; min-height: 0; padding: 0; border: 2px solid #24123e; border-radius: 7px; background: radial-gradient(ellipse at center, #35205a, #24123e); aspect-ratio: 1; }
	.cell[aria-disabled='true'] { cursor: default; }
	.cell svg { display: block; width: 74%; height: 74%; filter: drop-shadow(0 0 6px currentColor); }
	.mark-x { color: #ff82dc; }
	.mark-o { color: #6defff; }
	.cell.fading svg { opacity: .44; }
	.cell.win { background: #493067; border-color: #f0dcff; }
	.cell.suggested { border: 3px dashed #ffe681; background: #473257; }
	.rule { margin: 0; color: #dbc8ef; font-size: 16px; text-align: center; }
	.label { margin: 0; color: #dbb8ff; font-size: 13px; letter-spacing: .09em; font-weight: 700; }
	.variants { display: grid; gap: 7px; }
	.variants button[aria-pressed='true'] { background: linear-gradient(135deg, #b035a2, #6933bd); border-color: #f0a0ff; box-shadow: 0 0 14px #e255d651; }
	.segmented button { font-size: 14px; padding-inline: 4px; }
	.segmented button[aria-pressed='true'] { background: #b0e9fa; border-color: #b0e9fa; color: #181530; }
	@media (max-width: 700px) {
		.arena { display: flex; flex-direction: column; align-items: stretch; gap: 13px; padding: 4px 12px 20px; }
		.summary, .options { gap: 7px; }
		.players { flex-direction: row; }
		.player { flex: 1; justify-content: center; min-height: 42px; font-size: 16px; }
		.actions { justify-content: center; }
		.actions .reset { flex-basis: auto; }
		.board { width: min(100%, 430px); padding: 8px; }
		.variants { grid-template-columns: repeat(4, minmax(0, 1fr)); }
		.game > :global(header) { grid-template-columns: auto 1fr; gap: 8px; padding: 8px 12px; }
		.game > :global(header .right) { grid-column: 2; grid-row: 1; justify-self: end; gap: 5px; }
		.game > :global(header .caption) { grid-column: 1 / -1; grid-row: 2; font-size: 18px; }
		.game > :global(header .icon) { width: 44px; height: 44px; }
	}
</style>
