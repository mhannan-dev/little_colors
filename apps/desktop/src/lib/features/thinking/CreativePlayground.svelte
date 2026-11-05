<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import {
		PLAYGROUND_SIZE, PLAYGROUND_COLORS, PLAYGROUND_FOODS, PLAYGROUND_SHAPES,
		createPlaygroundStamp, creativePlaygroundReducer, playgroundNeighbor, playgroundPatternLimit, playgroundTokenKey,
		narrationText, formatNumeral,
		type CreativePlaygroundState, type PlaygroundAction, type ThinkingAgeBand, type ThinkingToken, type GridDirection, type PlaygroundItem, type Color
	} from '@little-colors/core';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import ThinkingTokenView from './ThinkingToken.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';

	let { model = $bindable(), activity = $bindable('arrange'), ageBand, onexit }: { model: CreativePlaygroundState; activity?: 'arrange' | 'pattern'; ageBand: ThinkingAgeBand; onexit: () => void } = $props();
	let theme = $state<'mat' | 'garden'>('mat');
	let category = $state<'food' | 'shapes'>('food');
	let color = $state<Color>('blue');
	let reaction = $state(0);
	let board = $state<HTMLDivElement>();
	type Drag = { kind: 'stamp' | 'item' | 'empty'; pointerId: number; startX: number; startY: number; moved: boolean; token?: ThinkingToken; id?: string; cell?: number };
	let drag = $state<Drag | null>(null);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const numeral = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const name = (token: ThinkingToken) => token.picture ? text(`picnic.item.${token.picture}`) : `${text(`thinking.color.${token.color}`)} ${text(`thinking.shape.${token.shape}`)}`;
	const palette = $derived((category === 'food' ? PLAYGROUND_FOODS : PLAYGROUND_SHAPES).map((kind) => createPlaygroundStamp(kind, color)));
	const selected = $derived(model.items.find((item) => item.id === model.selectedId));
	const chosen = $derived(model.stamp ?? selected?.token);
	const limit = $derived(Math.max(playgroundPatternLimit(ageBand), model.pattern.source.length));

	function dispatch(action: PlaygroundAction) {
		if ($paused) return;
		const next = creativePlaygroundReducer(model, action, ageBand);
		if (next === model) return;
		model = next; say(next.feedbackKey, { interrupt: true });
	}
	function focusSelected() {
		void tick().then(() => {
			const item = model.items.find((item) => item.id === model.selectedId);
			if (item) board?.querySelector<HTMLButtonElement>(`[data-playground-cell="${item.cell}"]`)?.focus({ preventScroll: true });
		});
	}
	function cellPress(cell: number) {
		const item = model.items.find((item) => item.cell === cell);
		if (item) dispatch({ type: 'SELECT', id: item.id });
		else if (model.stamp) dispatch({ type: 'PLACE', cell });
		else if (model.selectedId) dispatch({ type: 'MOVE', id: model.selectedId, cell });
		else say('playground.instruction', { interrupt: true });
	}
	function beginDrag(event: PointerEvent, data: Omit<Drag, 'pointerId' | 'startX' | 'startY' | 'moved'>) {
		if ($paused || !event.isPrimary || event.button !== 0 || drag) return;
		if (data.kind === 'stamp' && data.token) dispatch({ type: 'CHOOSE', token: data.token });
		if (data.kind === 'item' && data.id) dispatch({ type: 'SELECT', id: data.id });
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { ...data, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
	}
	function pointerMove(event: PointerEvent) {
		if (drag?.pointerId !== event.pointerId) return;
		if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 8) drag = { ...drag, moved: true };
	}
	function pointerUp(event: PointerEvent) {
		if (drag?.pointerId !== event.pointerId) return;
		const gesture = drag; drag = null;
		if ($paused) return;
		if (!gesture.moved) { if (gesture.kind === 'empty' && gesture.cell !== undefined) cellPress(gesture.cell); return; }
		const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-playground-cell]');
		if (!target || !board?.contains(target)) return;
		const cell = Number(target.dataset.playgroundCell);
		if (gesture.kind === 'stamp' && gesture.token) { dispatch({ type: 'CHOOSE', token: gesture.token }); dispatch({ type: 'PLACE', cell }); }
		else if (gesture.kind === 'item' && gesture.id) dispatch({ type: 'MOVE', id: gesture.id, cell });
	}
	function boardKeys(event: KeyboardEvent) {
		const directions: Record<string, GridDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
		const direction = directions[event.key];
		const element = (event.target as HTMLElement).closest<HTMLElement>('[data-playground-cell]');
		if (!direction || !element || $paused) return;
		event.preventDefault();
		const cell = Number(element.dataset.playgroundCell);
		if (selected?.cell === cell && !model.stamp) { dispatch({ type: 'NUDGE', direction }); focusSelected(); }
		else { const next = playgroundNeighbor(cell, direction); if (next !== null) board?.querySelector<HTMLButtonElement>(`[data-playground-cell="${next}"]`)?.focus(); }
	}
	function idea(template: 'flower' | 'cat') { theme = 'garden'; category = 'shapes'; dispatch({ type: 'TEMPLATE', name: template }); }
	function giggle() {
		if ($paused) return;
		reaction = (reaction + 1) % 3;
		say(reaction === 1 ? 'playground.rumi.sandwich' : reaction === 2 ? 'playground.rumi.napkin' : 'playground.rumi.wave', { interrupt: true });
	}
	function cellLabel(cell: number, item?: PlaygroundItem) {
		return `${text('playground.position')} ${numeral(Math.floor(cell / PLAYGROUND_SIZE) + 1)}, ${numeral(cell % PLAYGROUND_SIZE + 1)}: ${item ? name(item.token) : text('playground.empty')}`;
	}
	$effect(() => { caption.set(text(model.feedbackKey)); });
	const offPause = paused.subscribe((value) => { if (value) { drag = null; stopNarration(); } });
	onDestroy(() => { offPause(); stopNarration(); });
</script>

<svelte:window onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={(event) => { if (drag?.pointerId === event.pointerId) drag = null; }} onlostpointercapture={(event) => { if (drag?.pointerId === event.pointerId) drag = null; }} />
<section class="creative" data-testid="creative-playground" aria-label={text('playground.title')}>
	<header class="creative-heading">
		<div><div class="heading-line"><button class="back" data-testid="playground-back" onclick={onexit}>← {text('playground.back')}</button><h1 tabindex="-1">{text('playground.title')}</h1></div><p>{text(activity === 'arrange' ? 'playground.instruction' : 'playground.pattern.instruction')}</p></div>
		<button class="rumi-button" data-testid="playground-rumi" aria-label={text('playground.rumi')} disabled={$paused} onclick={giggle}>
			<Mascot state={reaction === 0 ? 'wave' : reaction === 1 ? 'thinking' : 'celebrate'} size={80} />
			{#if reaction > 0}<span class="silly-hat" data-testid="playground-silly-hat"><ThinkingTokenView token={createPlaygroundStamp(reaction === 1 ? 'sandwich' : 'napkin')} size={54} /></span>{/if}
			<small>{text('playground.rumi')}</small>
		</button>
	</header>
	<div class="activity-tabs" role="group" aria-label={text('playground.title')}>
		<button aria-pressed={activity === 'arrange'} data-testid="playground-arrange" onclick={() => { activity = 'arrange'; drag = null; say('playground.instruction', { interrupt: true }); }}>{text('playground.arrange')}</button>
		<button aria-pressed={activity === 'pattern'} data-testid="playground-pattern" onclick={() => { activity = 'pattern'; drag = null; say('playground.pattern.instruction', { interrupt: true }); }}>{text('playground.pattern')}</button>
	</div>
	<div class="editor">
		<aside class="palette" aria-label={text('playground.palette')}>
			<div class="category-tabs" role="group" aria-label={text('playground.palette')}>
				<button aria-pressed={category === 'food'} onclick={() => category = 'food'}>{text('playground.food')}</button>
				<button aria-pressed={category === 'shapes'} data-testid="playground-shapes" onclick={() => category = 'shapes'}>{text('playground.shapes')}</button>
			</div>
			{#if category === 'shapes'}<div class="colors" role="group" aria-label={text('playground.colors')}>{#each PLAYGROUND_COLORS as choice}<button class:chosen={color === choice} aria-pressed={color === choice} aria-label={text(`thinking.color.${choice}`)} style:background="var(--learn-{choice})" onclick={() => color = choice}><span>{text(`thinking.color.${choice}`)}</span></button>{/each}</div>{/if}
			<div class="palette-items">{#each palette as token (token.id)}<button class="stamp" class:chosen={model.stamp?.id === token.id} data-stamp={token.id} aria-pressed={model.stamp?.id === token.id} aria-label={name(token)} disabled={$paused} onpointerdown={(event) => beginDrag(event, { kind: 'stamp', token })} onclick={(event) => { if (event.detail === 0) dispatch({ type: 'CHOOSE', token }); }}><ThinkingTokenView {token} size={56} /><span>{name(token)}</span></button>{/each}</div>
			{#if chosen}<p class="chosen-item" data-testid="playground-chosen">{text('playground.selected')}: <strong>{name(chosen)}</strong></p>{/if}
		</aside>
		<div class="creation-area">
			{#if activity === 'arrange'}
				<div class="theme-tabs" role="group" aria-label={text('playground.arrange')}><button aria-pressed={theme === 'mat'} onclick={() => theme = 'mat'}>{text('playground.mat')}</button><button aria-pressed={theme === 'garden'} data-testid="playground-garden" onclick={() => { theme = 'garden'; category = 'shapes'; }}>{text('playground.garden')}</button></div>
				<div class="canvas" class:garden={theme === 'garden'} class:dragging={drag?.moved} role="grid" tabindex="-1" aria-label={text(theme === 'mat' ? 'playground.mat' : 'playground.garden')} aria-rowcount={4} aria-colcount={4} onkeydown={boardKeys} bind:this={board} data-testid="playground-board">
					{#each Array(PLAYGROUND_SIZE) as _, row}<div class="board-row" role="row">
						{#each Array(PLAYGROUND_SIZE) as _, column}
							{@const cell = row * PLAYGROUND_SIZE + column}
							{@const item = model.items.find((item) => item.cell === cell)}
							<button class="cell" role="gridcell" aria-selected={!!item && item.id === model.selectedId} aria-label={cellLabel(cell, item)} data-playground-cell={cell} data-item-id={item?.id} data-token={item ? playgroundTokenKey(item.token) : undefined} data-rotation={item?.rotation} disabled={$paused} onpointerdown={(event) => beginDrag(event, item ? { kind: 'item', id: item.id, cell } : { kind: 'empty', cell })} onclick={(event) => { if (event.detail === 0) cellPress(cell); }}>
								{#if item}<span class="placed-art" style:transform="rotate({item.rotation}deg)"><ThinkingTokenView token={item.token} size={64} /></span>{:else}<span class="empty-mark" aria-hidden="true">+</span>{/if}
							</button>
						{/each}
					</div>{/each}
				</div>
				<div class="toolbar" role="group" aria-label={text('playground.arrange')}>
					<button data-testid="playground-rotate" disabled={!selected || $paused} onclick={() => dispatch({ type: 'ROTATE' })}>↻ {text('playground.rotate')}</button>
					<button data-testid="playground-remove" disabled={!selected || $paused} onclick={() => dispatch({ type: 'REMOVE' })}>{text('playground.remove')}</button>
					<button data-testid="playground-undo" disabled={!model.history.length || $paused} onclick={() => dispatch({ type: 'UNDO' })}>↶ {text('playground.undo')}</button>
					<button data-testid="playground-clear" disabled={!model.items.length || $paused} onclick={() => dispatch({ type: 'CLEAR' })}>{text('playground.clear')}</button>
				</div>
				{#if theme === 'garden'}<div class="ideas"><button data-testid="playground-flower" disabled={$paused} onclick={() => idea('flower')}>{text('playground.flower')}</button><button data-testid="playground-cat" disabled={$paused} onclick={() => idea('cat')}>{text('playground.cat')}</button></div>{/if}
			{:else}
				<div class="pattern-builder">
					<h2>{text('playground.pattern.source')}</h2>
					<div class="pattern-strip" class:six={limit === 6} data-testid="pattern-source">
						{#each Array(limit) as _, index}{@const token = model.pattern.source[index]}<button class="pattern-slot" data-pattern-token={token ? playgroundTokenKey(token) : undefined} aria-label={`${token ? name(token) : text('playground.empty')} · ${numeral(index + 1)}`} disabled={!token || model.pattern.phase !== 'build' || $paused} onclick={() => dispatch({ type: 'PATTERN_REMOVE', index })}>{#if token}<ThinkingTokenView {token} size={52} />{:else}<span aria-hidden="true">+</span>{/if}</button>{/each}
					</div>
					{#if model.pattern.phase === 'build'}
						<button class="primary" data-testid="pattern-add" disabled={!chosen || model.pattern.source.length >= limit || $paused} onclick={() => dispatch({ type: 'PATTERN_ADD' })}>{text('playground.pattern.add')}</button>
						<p class="pattern-note">{text('playground.pattern.minimum')}</p>
						<div class="pattern-actions"><button data-testid="pattern-rumi" disabled={model.pattern.source.length < 2 || $paused} onclick={() => dispatch({ type: 'PATTERN_START', who: 'rumi' })}>{text('playground.pattern.rumi')}</button><button data-testid="pattern-together" disabled={model.pattern.source.length < 2 || $paused} onclick={() => dispatch({ type: 'PATTERN_START', who: 'together' })}>{text('playground.pattern.together')}</button></div>
					{:else}
						<h2>{text('playground.pattern.copy')}</h2>
						<div class="pattern-strip" class:six={limit === 6} data-testid="pattern-copy">
							{#each Array(model.pattern.source.length) as _, index}{@const token = model.pattern.copy[index]}<div class="pattern-slot" data-pattern-token={token ? playgroundTokenKey(token) : undefined} aria-label={`${token ? name(token) : text('playground.empty')} · ${numeral(index + 1)}`}>{#if token}<ThinkingTokenView {token} size={52} />{:else}<span aria-hidden="true">?</span>{/if}</div>{/each}
						</div>
						{#if model.pattern.phase === 'matched'}<p class="matched" role="status" data-testid="pattern-matched">✓ {text('playground.pattern.matched')}</p>
						{:else if model.pattern.who === 'rumi'}<button class="primary" data-testid="pattern-rumi-next" disabled={$paused} onclick={() => dispatch({ type: 'RUMI_NEXT' })}>{text('playground.pattern.rumi.next')}</button>
						{:else}<button class="primary" data-testid="pattern-copy-add" disabled={!chosen || $paused} onclick={() => dispatch({ type: 'PATTERN_COPY' })}>{text('playground.pattern.copy.add')}</button>{/if}
						<button class="edit-pattern" data-testid="pattern-edit" disabled={$paused} onclick={() => dispatch({ type: 'PATTERN_EDIT' })}>{text('playground.pattern.edit')}</button>
					{/if}
					<button class="clear-pattern" data-testid="pattern-clear" disabled={!model.pattern.source.length || $paused} onclick={() => dispatch({ type: 'PATTERN_CLEAR' })}>{text('playground.pattern.clear')}</button>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.creative { max-width: 1080px; margin: 0 auto; padding: 0 0 24px; }
	.creative-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
	.heading-line { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
	h1 { font-size: clamp(27px, 3vw, 40px); margin: 8px 0; }
	.creative-heading p { margin: 0; max-width: 780px; font-size: 22px; line-height: 1.4; color: var(--text-secondary); }
	button { cursor: pointer; min-height: 56px; border: 3px solid var(--border-soft); border-radius: 18px; background: var(--surface); padding: 8px 14px; font-size: 20px; }
	button:disabled { cursor: default; opacity: 0.5; }
	button[aria-pressed='true'], .chosen, .cell[aria-selected='true'] { border-color: var(--text-primary); background: var(--bg-secondary); }
	.back { font-size: 18px; }
	.rumi-button { border: 0; background: transparent; display: flex; flex-direction: column; align-items: center; position: relative; flex-shrink: 0; min-width: 140px; padding: 0; }
	.rumi-button small { font-size: 17px; }
	.silly-hat { position: absolute; top: 0; left: 42px; transform: rotate(-15deg); pointer-events: none; }
	.activity-tabs, .theme-tabs, .category-tabs, .toolbar, .ideas, .pattern-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
	.activity-tabs { margin: 12px 0; }
	.activity-tabs button { padding: 10px 26px; font-size: 24px; }
	.editor { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 28px; align-items: start; }
	.palette { border: 2px solid var(--border-soft); border-radius: 24px; padding: 12px; background: var(--surface); }
	.category-tabs { gap: 6px; }
	.category-tabs button { font-size: 17px; padding: 6px 10px; }
	.palette-items { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
	.stamp { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 108px; padding: 8px; font-size: 16px; touch-action: none; }
	.colors { display: flex; justify-content: center; gap: 5px; margin-top: 12px; }
	.colors button { flex: 1; min-width: 0; padding: 3px; font-size: 14px; }
	.colors span { background: var(--surface); border-radius: 10px; padding: 1px 4px; }
	.chosen-item { margin: 12px 0 0; font-size: 18px; color: var(--text-secondary); }
	.theme-tabs { margin-bottom: 12px; }
	.canvas { width: 100%; max-width: 400px; margin: 0 auto; padding: 10px; border: 3px solid var(--learn-green); border-radius: 24px; background: var(--bg-secondary); display: flex; flex-direction: column; gap: 6px; }
	.canvas.garden { border-style: dashed; }
	.canvas.dragging { outline: 4px dashed var(--text-secondary); outline-offset: 4px; }
	.board-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
	.cell { aspect-ratio: 1; min-height: 0; min-width: 0; padding: 2px; border: 2px solid var(--border-soft); display: grid; place-items: center; touch-action: none; }
	.empty-mark { color: var(--border-soft); font-size: 24px; }
	.placed-art { display: grid; place-items: center; width: 78%; max-width: 68px; pointer-events: none; }
	.placed-art :global(svg) { width: 100%; height: auto; }
	.toolbar, .ideas { margin-top: 14px; }
	.toolbar button { font-size: 18px; }
	.ideas button { font-size: 18px; }
	.pattern-builder { text-align: center; padding: 16px; border: 2px solid var(--border-soft); border-radius: 24px; background: var(--surface); }
	h2 { font-size: 25px; margin: 0 0 14px; }
	.pattern-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 12px 0 20px; }
	.pattern-strip.six { grid-template-columns: repeat(6, minmax(0, 1fr)); }
	.pattern-slot { min-height: 76px; min-width: 0; border: 2px dashed var(--border-soft); border-radius: 16px; display: grid; place-items: center; padding: 4px; font-size: 28px; }
	.pattern-slot :global(svg) { max-width: 100%; height: auto; }
	.primary { background: var(--text-primary); color: var(--bg-primary); padding: 10px 22px; font-size: 23px; }
	.pattern-note { font-size: 18px; color: var(--text-secondary); }
	.clear-pattern, .edit-pattern { margin: 14px 6px 0; font-size: 18px; }
	.matched { font-size: 23px; color: var(--text-primary); background: var(--bg-secondary); padding: 14px; border-radius: 18px; }
	@media (max-width: 850px) { .editor { grid-template-columns: 200px minmax(0, 1fr); gap: 16px; } .toolbar button { font-size: 16px; padding: 6px 12px; } .palette { padding: 8px; } .creative-heading p { font-size: 20px; } }
	@media (max-width: 600px) { .editor { grid-template-columns: 1fr; } .creative-heading { gap: 8px; } .rumi-button { min-width: 85px; max-width: 85px; } .rumi-button :global(.rumi) { max-width: 75px; height: auto !important; } .rumi-button small { font-size: 14px; } .silly-hat { left: 17px; } .palette-items { grid-template-columns: repeat(4, minmax(0, 1fr)); } .stamp { min-height: 92px; padding: 4px; font-size: 14px; } .stamp :global(svg) { max-width: 100%; } .category-tabs { justify-content: flex-start; } .colors { max-width: 240px; } .chosen-item { font-size: 16px; } .canvas { max-width: 420px; } .pattern-strip.six { grid-template-columns: repeat(3, minmax(0, 1fr)); } .pattern-builder { padding: 12px; } .creative-heading h1 { font-size: 27px; } .creative-heading p { font-size: 18px; } }
</style>
