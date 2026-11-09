<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		BLOCK_STYLES, COLOR_BLOCK_LEVELS, COLOR_BLOCK_SIZE, colorBlockHint, formatNumeral,
		narrationText, slideColorBlock, type BlockBoard, type BlockDirection, type BlockId
	} from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import { caption, instruct, leaveScreen, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';

	const size = COLOR_BLOCK_SIZE;
	const cells = Array.from({ length: size * size }, (_, i) => i);
	const ids = Object.keys(BLOCK_STYLES) as BlockId[];
	const arrows = {
		left: { glyph: '←', bn: 'বামে', en: 'Left' },
		up: { glyph: '↑', bn: 'ওপরে', en: 'Up' },
		down: { glyph: '↓', bn: 'নিচে', en: 'Down' },
		right: { glyph: '→', bn: 'ডানে', en: 'Right' }
	} as const;
	const directions = Object.keys(arrows) as BlockDirection[];
	type Drag = { id: BlockId; pointer: number; x: number; y: number; step: number; preview: number };

	let levelIndex = $state(0);
	let board = $state<BlockBoard>(COLOR_BLOCK_LEVELS[0].start);
	let history = $state<BlockBoard[]>([]);
	let selected = $state<BlockId>();
	let drag = $state<Drag>();
	let hint = $state<ReturnType<typeof colorBlockHint>>();
	let feedback = $state('blocks.instruction');
	let finished = $state(false);
	let boardElement = $state<HTMLDivElement>();
	let controls = $state<HTMLDivElement>();
	let title = $state<HTMLHeadingElement>();
	const level = $derived(COLOR_BLOCK_LEVELS[levelIndex]!);
	const cleared = $derived(ids.every(id => board[id] === undefined));
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const copy = (bn: string, en: string) => $settings.language === 'bn-BD' ? bn : en;
	const numeral = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const name = (id: BlockId) => copy(BLOCK_STYLES[id].bn, BLOCK_STYLES[id].en);

	function announce(key: string) {
		feedback = key;
		say(key, { interrupt: true });
	}

	function reset(index: number) {
		if ($paused) return;
		levelIndex = index;
		board = COLOR_BLOCK_LEVELS[index]!.start;
		history = [];
		selected = undefined;
		hint = undefined;
		drag = undefined;
		finished = false;
		feedback = 'blocks.instruction';
		blockedTries = 0;
		instruct(feedback);
		say('blocks.choose');
		void tick().then(() => title?.focus());
	}

	let blockedTries = 0;
	const SHAPE: Record<string, [string, string]> = { '●': ['গোল', 'circle'], '◆': ['হীরা', 'diamond'], '▲': ['ত্রিভুজ', 'triangle'], '★': ['তারা', 'star'] };
	const blockLabel = (id: BlockId) => {
		const s = SHAPE[BLOCK_STYLES[id].symbol];
		return s ? `${name(id)} ${copy(s[0], s[1])}` : name(id);
	};
	function move(id: BlockId, direction: BlockDirection, distance = 1) {
		if ($paused || cleared || finished) return;
		const next = slideColorBlock(level, board, id, direction, distance);
		hint = undefined;
		if (next === board) {
			blockedTries += 1;
			if (blockedTries >= 2) {
				blockedTries = 0;
				help();
			} else announce('blocks.blocked');
			return;
		}
		blockedTries = 0;
		const removed = next[id] === undefined;
		history = [...history, board];
		board = next;
		if (!removed) {
			feedback = 'blocks.instruction';
			return;
		}
		selected = undefined;
		if (cleared) {
			setIdlePrompt('ui.tap-next');
			announce('blocks.clear');
			void tick().then(() => controls?.querySelector('button')?.focus());
		} else {
			announce('blocks.match');
			void tick().then(() => boardElement?.querySelector('button')?.focus());
		}
	}

	function undo() {
		if ($paused || !history.length) return;
		board = history[history.length - 1]!;
		history = history.slice(0, -1);
		selected = undefined;
		hint = undefined;
		drag = undefined;
		feedback = 'blocks.instruction';
		instruct(feedback);
	}

	function help() {
		if ($paused || cleared) return;
		hint = colorBlockHint(level, board);
		if (hint) selected = hint.id;
		announce(hint ? 'blocks.hint' : 'blocks.undoHint');
	}

	function advance() {
		if ($paused) return;
		if (levelIndex + 1 < COLOR_BLOCK_LEVELS.length) {
			reset(levelIndex + 1);
		} else {
			finished = true;
			setIdlePrompt(null);
			announce('blocks.done');
			void tick().then(() => title?.focus());
		}
	}

	function startDrag(event: PointerEvent, id: BlockId) {
		const position = board[id];
		if ($paused || event.button !== 0 || drag || position === undefined || !boardElement) return;
		event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId);
		selected = id;
		drag = {
			id, pointer: event.pointerId, x: event.clientX, y: event.clientY,
			step: boardElement.getBoundingClientRect().width / size, preview: position
		};
	}

	function swipe(event: PointerEvent, start: Drag): { direction: BlockDirection; distance: number } {
		const x = event.clientX - start.x;
		const y = event.clientY - start.y;
		const horizontal = Math.abs(x) >= Math.abs(y);
		const direction = horizontal ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
		return { direction, distance: Math.round(Math.abs(horizontal ? x : y) / start.step) };
	}

	function previewDrag(event: PointerEvent) {
		if (!drag || drag.pointer !== event.pointerId) return;
		const { direction, distance } = swipe(event, drag);
		const preview = slideColorBlock(level, board, drag.id, direction, distance);
		drag.preview = preview[drag.id] ?? level.gates[drag.id]!;
	}

	function endDrag(event: PointerEvent) {
		if (!drag || drag.pointer !== event.pointerId) return;
		const { id } = drag;
		const { direction, distance } = swipe(event, drag);
		drag = undefined;
		if (distance > 0) move(id, direction, distance);
	}

	function cancelDrag(event: PointerEvent) {
		if (drag?.pointer === event.pointerId) drag = undefined;
	}

	function keyMove(event: KeyboardEvent, id: BlockId) {
		const direction = directions.find(dir => event.key === 'Arrow' + dir[0]!.toUpperCase() + dir.slice(1));
		if (!direction) return;
		event.preventDefault();
		selected = id;
		move(id, direction);
	}

	function position(id: BlockId) {
		return drag?.id === id ? drag.preview : board[id]!;
	}

	function gateArrow(cell: number) {
		if (cell < size) return '↑';
		if (cell >= size * (size - 1)) return '↓';
		return cell % size === 0 ? '←' : '→';
	}

	$effect(() => caption.set(text(feedback)));
	onMount(() => {
		instruct(feedback);
		const offPause = paused.subscribe(value => {
			if (!value) return;
			drag = undefined;
			stopNarration();
		});
		return () => {
			offPause();
			leaveScreen();
			caption.set('');
		};
	});
</script>

<TopBar onreplay={() => { if (!$paused) say(feedback, { interrupt: true }); }} />

<section class="workshop" class:reduced={$settings.reducedMotion} aria-labelledby="blocks-title">
	<div class="workbench">
		<h1 id="blocks-title" tabindex="-1" bind:this={title}>{text('mode.color-blocks')}</h1>
		{#if finished}
			<div class="finish">
				<Mascot state={$settings.reducedMotion ? 'rest' : 'celebrate'} size={145} />
				<span class="medal" aria-hidden="true">🏅</span>
				<h2>{text('blocks.done')}</h2>
				<GameButton action="replay" onclick={() => reset(0)} />
			</div>
		{:else}
			<p class="puzzle">{copy('ধাঁধা', 'Puzzle')} {numeral(levelIndex + 1)}</p>
			<div class="layout">
				<div class="board" role="group" aria-label={text('mode.color-blocks')} bind:this={boardElement}>
					{#each cells as cell (cell)}
						{@const gate = ids.find(id => level.gates[id] === cell)}
						<div class="cell" class:wall={level.walls.includes(cell)} class:gate={gate !== undefined}
							data-color={gate ? BLOCK_STYLES[gate].color : undefined} aria-hidden="true">
							{#if gate}<span>{BLOCK_STYLES[gate].symbol}</span><small>{gateArrow(cell)}</small>{/if}
						</div>
					{/each}
					{#each ids as id (id)}
						{#if board[id] !== undefined}
							<button class="block" class:dragging={drag?.id === id} class:hinted={hint?.id === id}
								aria-pressed={selected === id} aria-label={blockLabel(id)} data-block={id}
								data-color={BLOCK_STYLES[id].color} data-cell={board[id]}
								style:left={(position(id) % size) * 100 / size + '%'}
								style:top={Math.floor(position(id) / size) * 100 / size + '%'}
								disabled={$paused} onclick={() => { if (board[id] !== undefined) selected = id; }}
								onkeydown={(event) => keyMove(event, id)} onpointerdown={(event) => startDrag(event, id)}
								onpointermove={previewDrag} onpointerup={endDrag}
								onpointercancel={cancelDrag} onlostpointercapture={cancelDrag}>
								<span aria-hidden="true">{BLOCK_STYLES[id].symbol}</span>
							</button>
						{/if}
					{/each}
				</div>
				<div class="panel" bind:this={controls}>
					<p class="instruction">{text('blocks.instruction')}</p>
					{#if cleared}
						<span class="success" aria-hidden="true">✓</span>
						<GameButton action="next" label={text('blocks.next')} onclick={advance} />
					{:else}
						<p>{text('blocks.choose')}</p>
						<div class="arrows" role="group" aria-label={copy('ব্লক সরাও', 'Move block')}>
							{#each directions as dir (dir)}
								<button class="arrow" class:hinted={hint?.direction === dir} aria-label={copy(arrows[dir].bn, arrows[dir].en)}
									disabled={!selected || $paused} onclick={() => { if (selected) move(selected, dir); }}>
									{arrows[dir].glyph}
								</button>
							{/each}
						</div>
						<div class="tools">
							<button disabled={$paused} onclick={help}>💡 {copy('ইঙ্গিত', 'Hint')}</button>
							<button disabled={!history.length || $paused} onclick={undo}>↶ {copy('চাল ফেরাও', 'Undo')}</button>
							<button disabled={$paused} onclick={() => reset(levelIndex)}>↻ {copy('আবার শুরু', 'Restart')}</button>
						</div>
					{/if}
					<p class="feedback" role="status">{feedback === 'blocks.instruction' ? '' : text(feedback)}</p>
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
	.workshop { flex: 1; overflow: auto; padding: 8px 24px 24px; background: radial-gradient(ellipse at top, #e9f4f7, #f7f1e2 80%); }
	.workbench { max-width: 1050px; margin: auto; text-align: center; }
	h1 { margin: 0; font-size: clamp(34px, 5vw, 54px); color: #214154; }
	.puzzle { margin: 0 0 14px; color: #344b5c; font-weight: 700; }
	.layout { display: flex; justify-content: center; flex-wrap: wrap; gap: 22px; align-items: center; }
	.board {
		position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
		flex: 0 1 455px; aspect-ratio: 1; background: #223747; border-radius: 20px;
		box-shadow: 0 7px 0 #142a3b, 0 15px 32px #284c6130; touch-action: none;
	}
	.cell { margin: 3px; border-radius: 10px; background: #dce9e9; display: grid; place-content: center; line-height: 1; }
	.cell.wall { background: repeating-linear-gradient(135deg, #354c5d 0 9px, #405768 9px 18px); }
	[data-color="red"] { --paint: #ee6c69; --ink: #431212; }
	[data-color="blue"] { --paint: #73baf3; --ink: #102f54; }
	[data-color="green"] { --paint: #7aca9c; --ink: #133e29; }
	[data-color="yellow"] { --paint: #f8d368; --ink: #503605; }
	.gate { background: color-mix(in srgb, var(--paint) 60%, white); color: var(--ink); border: 3px dashed var(--ink); font-size: 30px; }
	.gate small { font-size: 22px; font-weight: 700; }
	.block {
		position: absolute; width: calc(20% - 12px); height: calc(20% - 12px); margin: 6px;
		padding: 0; display: grid; place-items: center; border-radius: 13px; border: 2px solid var(--ink);
		background: var(--paint); color: var(--ink); box-shadow: inset 0 -7px #12283b24, inset 0 3px #ffffff60;
		font-size: clamp(25px, 4vw, 45px); cursor: grab; touch-action: none; transition: top 140ms ease, left 140ms ease;
	}
	.block[aria-pressed="true"] { outline: 3px solid #fff; outline-offset: 1px; z-index: 1; }
	.block:focus-visible { outline: 4px solid #142a3b; outline-offset: 2px; }
	.block.dragging { z-index: 2; cursor: grabbing; transition: none; }
	.panel { flex: 0 1 390px; padding: 20px; border-radius: 22px; background: #fffdf5; box-shadow: 0 5px 0 #dfdac9; }
	.panel p { margin: 0 0 12px; }
	.instruction { font-size: 24px; font-weight: 700; }
	.arrows, .tools { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
	.arrow, .tools button { min-height: 44px; border: 2px solid #b9cbd0; border-radius: 12px; background: #eef6f8; cursor: pointer; }
	.arrow { width: 54px; font-size: 28px; }
	button:disabled { opacity: .65; cursor: default; }
	.hinted, .block.hinted { outline: 4px dashed #163451; outline-offset: 2px; }
	.panel .feedback { min-height: 3em; margin: 0; }
	.success { display: block; margin: 6px auto; font-size: 44px; color: #20583d; }
	.finish { display: grid; place-items: center; gap: 10px; padding: 18px; }
	.finish h2 { margin: 0; }
	.medal { font-size: 52px; animation: reveal 450ms ease-out both; }
	@keyframes reveal { from { transform: scale(.5); opacity: 0; } }
	.reduced .block, .reduced .medal, .reduced :global(.rumi), .reduced :global(.rumi *) { animation: none; transition: none; }
	@media (prefers-reduced-motion: reduce) { .block, .medal { animation: none !important; transition: none !important; } }
</style>
