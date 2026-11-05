<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { createPatternTrain, initialPatternTrain, patternTrainReducer, TRAIN_STAGES, THINKING_DIRECTIONS, findGridPath, sameCell, narrationText, formatNumeral, type ThinkingAgeBand, type ThinkingToken, type PatternTrainAction, type GridDirection } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import Token from './ThinkingToken.svelte';
	import TrainEngine from './TrainEngine.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';
	let { ageBand, onexit }: { ageBand: ThinkingAgeBand; onexit: () => void } = $props();
	let plan = $state(untrack(() => createPatternTrain(ageBand, Date.now() >>> 0)));
	let progress = $state(untrack(() => initialPatternTrain(plan)));
	let scroller = $state<HTMLDivElement>();
	let joke = $state(false);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const n = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const name = (token: ThinkingToken) => `${text(`thinking.color.${token.color}`)} ${text(`thinking.shape.${token.shape}`)}`;
	const kind = $derived(TRAIN_STAGES[progress.stage]!);
	const passenger = $derived(plan.passengers[progress.seated]);
	const nextStep = $derived(progress.hint && progress.stage === 2 ? findGridPath(plan.route, progress.position)?.[0] : undefined);
	const instruction = $derived(progress.stage === 1 && progress.phase === 'play' ? 'train.seats.recall' : `train.instruction.${kind}`);
	const arrows: Record<GridDirection, string> = { up: '↑', down: '↓', left: '←', right: '→' };
	function focusHeading() { void tick().then(() => { scroller?.scrollTo(0, 0); scroller?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); }); }
	function dispatch(action: PatternTrainAction) {
		if ($paused) return;
		const next = patternTrainReducer(plan, progress, action);
		if (next === progress) return;
		const phase = progress.phase; progress = next; say(next.feedbackKey, { interrupt: true });
		if (next.phase !== phase && !['observe', 'play'].includes(next.phase)) focusHeading();
	}
	function replay() { if ($paused) return; stopNarration(); plan = createPatternTrain(ageBand, (plan.seed + 1) >>> 0); progress = initialPatternTrain(plan); joke = false; say(progress.feedbackKey, { interrupt: true }); focusHeading(); }
	function keys(event: KeyboardEvent) { const direction = ({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'} as Record<string,GridDirection>)[event.key]; if (direction) { event.preventDefault(); dispatch({type:'MOVE',direction}); } }
	$effect(() => caption.set(text(progress.feedbackKey)));
	const offPause = paused.subscribe((value) => { if (value) stopNarration(); });
	onMount(() => { say(progress.feedbackKey, { interrupt: true }); focusHeading(); });
	onDestroy(() => { offPause(); stopNarration(); });
</script>

<div class="train-shell">
	<TopBar onreplay={() => say(['intro', 'complete', 'finished'].includes(progress.phase) ? progress.feedbackKey : instruction, { interrupt: true })}/>
	<div class="train-scroll" bind:this={scroller} data-testid="pattern-train">
		<section>
			<div class="navigation"><button data-testid="train-back" onclick={onexit}>← {text('thinking.hub')}</button><span>{n(progress.completed)} / {n(3)} ✓</span></div>
			<h1 tabindex="-1">{text(progress.phase === 'finished' ? 'train.title' : `train.${kind}`)}</h1>
			{#if progress.phase === 'intro'}
				<div class="intro" data-testid="train-intro" data-stage={kind}><TrainEngine size={160}/><p>{text(`train.story.${kind}`)}</p><button class="primary" data-testid="train-begin" disabled={$paused} onclick={() => dispatch({type:'BEGIN'})}>{text('picnic.begin')} →</button></div>
			{:else if progress.phase === 'finished'}
				<div data-testid="train-finale"><div class="conductor"><Mascot state={joke ? 'wave' : 'celebrate'} size={180}/><svg class:tilted={joke} class="ticket" data-testid="train-ticket" viewBox="0 0 120 44" aria-hidden="true"><path d="M4 4 H116 V14 Q100 22 116 30 V40 H4 V30 Q20 22 4 14Z" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4"/><path d="M84 5 V39" stroke="var(--text-primary)" stroke-dasharray="4 4" stroke-width="3"/><path d="M24 15 H68 M24 29 H56" stroke="var(--text-primary)" stroke-width="4"/></svg></div><TrainEngine size={150}/><p role="status">{text(joke ? 'train.joke' : 'train.done')}</p><div class="actions"><button data-testid="train-giggle" disabled={$paused} onclick={() => { joke = !joke; say(joke ? 'train.joke' : 'train.done', {interrupt:true}); }}>{text('train.giggle')}</button><button class="primary" data-testid="train-replay" disabled={$paused} onclick={replay}>{text('train.replay')}</button></div></div>
			{:else}
				<p class="instruction">{text(instruction)}</p>
				{#if progress.phase === 'complete'}<p class="success" role="status" data-testid="train-complete">✓ {text('train.complete')}</p>{/if}
				{#if progress.stage === 0}
					<div class="carriages" data-testid="train-carriages"><TrainEngine size={110}/>{#each plan.carriages as token, index}
						{@const gap = plan.gaps.indexOf(index)}{@const visible = gap < 0 || gap < progress.filled}
						<div class="carriage" class:current={gap === progress.filled} data-carriage={index} data-token={visible ? token.id : undefined} aria-label={`${text('train.carriage')} ${n(index + 1)}: ${visible ? name(token) : text('train.empty')}`}><small>{n(index + 1)}</small>{#if visible}<Token {token} size={54}/>{:else}<b>?</b>{/if}<div class="wheels" aria-hidden="true">●　●</div></div>
					{/each}</div>
					<div class="choices">{#each plan.options as token}<button data-carriage-choice={token.id} class:hinted={progress.hint && token.id === plan.carriages[plan.gaps[progress.filled]!]?.id} disabled={progress.phase !== 'play' || $paused} aria-label={name(token)} onclick={() => dispatch({type:'CARRIAGE',id:token.id})}><Token {token} size={64}/><span>{name(token)}</span></button>{/each}</div>
				{:else if progress.stage === 1}
					{#if progress.phase === 'play' && passenger}<div class="target" data-testid="train-passenger" data-token={passenger.id}><Token token={passenger} size={64}/><strong>{name(passenger)}</strong></div>{/if}
					<div class="seats">{#each plan.seats as token, index}{@const recovered = !!token && plan.passengers.slice(0,progress.seated).some((item) => item.id === token.id)}{@const visible = progress.phase === 'observe' || progress.phase === 'complete' || recovered}
						<button class="seat" data-seat={index} data-token={visible && token ? token.id : undefined} aria-label={`${text('train.seat')} ${n(index + 1)}: ${visible ? token ? name(token) : text('train.empty') : text('train.hidden')}`} disabled={progress.phase !== 'play' || recovered || $paused} onclick={() => dispatch({type:'SEAT',index})}><small>{text('train.seat')} {n(index + 1)}</small>{#if visible && token}<Token {token} size={60}/>{:else}<span aria-hidden="true">{visible ? '—' : '?'}</span>{/if}</button>
					{/each}</div>
					{#if progress.phase === 'observe'}<button class="primary" data-testid="train-hide" disabled={$paused} onclick={() => dispatch({type:'HIDE'})}>{text('train.hide')}</button>{:else if progress.phase === 'play'}<button data-testid="train-peek" disabled={$paused} onclick={() => dispatch({type:'PEEK'})}>{text('train.peek')}</button>{/if}
				{:else}
					<div class="route-workspace"><div class="route-grid" role="grid" tabindex="0" aria-label={text('train.board')} aria-rowcount={plan.route.size} aria-colcount={plan.route.size} aria-activedescendant="train-cell-{progress.position.row}-{progress.position.column}" onkeydown={keys} data-testid="train-route" data-size={plan.route.size}>
						{#each Array(plan.route.size) as _, row}<div role="row" class="route-row" style:grid-template-columns="repeat({plan.route.size},1fr)">{#each Array(plan.route.size) as _, column}
							{@const cell = {row,column}}{@const here = sameCell(progress.position,cell)}{@const rock = plan.route.walls.some((item) => sameCell(item,cell))}{@const station = sameCell(plan.route.goal,cell)}
							<div id="train-cell-{row}-{column}" class="route-cell" class:rock class:hinted={!!nextStep && sameCell(nextStep,cell)} role="gridcell" aria-selected={here} aria-label={`${n(row + 1)}, ${n(column + 1)}: ${text(here ? 'train.here' : rock ? 'train.rock' : station ? 'train.station' : 'train.track')}`} data-row={row} data-column={column} data-train={here} data-rock={rock} data-station={station}>{#if here}<TrainEngine size={52}/>{:else if rock}<span aria-hidden="true">▧</span>{:else if station}<span aria-hidden="true">⚑</span>{:else}<span class="rail" aria-hidden="true">═</span>{/if}</div>
						{/each}</div>{/each}
					</div><div class="directions" role="group" aria-label={text('train.board')}>{#each THINKING_DIRECTIONS as direction}<button data-train-direction={direction} disabled={progress.phase !== 'play' || $paused} aria-label={text(`thinking.${direction}`)} onclick={() => dispatch({type:'MOVE',direction})}><b aria-hidden="true">{arrows[direction]}</b><small>{text(`thinking.${direction}`)}</small></button>{/each}</div></div>
				{/if}
				{#if progress.hint}<p class="hint" role="status" data-testid="train-hint">{text(`train.hint.${kind}`)}</p>{/if}
				<div class="actions">{#if progress.phase === 'complete'}<button class="primary" data-testid="train-next" disabled={$paused} onclick={() => dispatch({type:'NEXT'})}>{text('train.next')} →</button>{:else}<button data-testid="train-reset" disabled={$paused} onclick={() => dispatch({type:'RESET'})}>{text('thinking.restart')}</button>{#if progress.phase === 'play'}<button data-testid="train-help" disabled={$paused} onclick={() => dispatch({type:'HINT'})}>{text('train.help')}</button>{/if}{/if}</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.train-shell { display:flex; flex-direction:column; flex:1; min-height:0; }
	.train-scroll { flex:1; min-height:0; overflow:auto; padding:10px 24px 30px; }
	section { max-width:1000px; margin:auto; text-align:center; }
	.navigation,.actions { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; }
	.navigation { font-size:21px; }
	h1 { font-size:clamp(28px,3vw,40px); margin:16px 0; }
	button { min-height:60px; padding:10px 20px; cursor:pointer; font-size:21px; border:3px solid var(--border-soft); border-radius:20px; background:var(--surface); }
	button:disabled { opacity:.6; cursor:default; }
	.primary { background:var(--text-primary); color:var(--bg-primary); font-weight:700; }
	p { font-size:24px; line-height:1.5; margin:18px auto; max-width:800px; }
	.intro { display:flex; flex-direction:column; align-items:center; padding:20px; }
	.carriages { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:12px; margin:30px auto; padding:14px 0; border-bottom:6px double var(--text-secondary); }
	.carriage { width:82px; padding:6px; border:3px solid var(--learn-blue); border-radius:12px; background:var(--surface); display:flex; flex-direction:column; align-items:center; min-height:116px; }
	small { font-size:17px; }
	.carriage b { height:54px; font-size:38px; }
	.wheels { line-height:1; color:var(--text-primary); font-size:18px; }
	.current,.hinted { outline:4px dashed var(--text-primary); outline-offset:3px; }
	.choices { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; max-width:780px; margin:24px auto; }
	.choices button { display:flex; flex-direction:column; align-items:center; gap:8px; }
	.choices span { font-size:18px; }
	.target { display:flex; align-items:center; justify-content:center; gap:20px; font-size:24px; margin:18px; }
	.seats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); max-width:600px; gap:16px; margin:24px auto; }
	.seat { min-height:126px; display:flex; flex-direction:column; align-items:center; gap:8px; border-bottom:10px solid var(--learn-blue); }
	.seat span { font-size:40px; }
	.route-workspace { display:flex; align-items:center; justify-content:center; gap:30px; margin:24px auto; }
	.route-grid { display:flex; flex-direction:column; gap:8px; }
	.route-row { display:grid; gap:8px; }
	.route-cell { width:64px; height:64px; border:2px solid var(--border-soft); border-radius:12px; background:var(--surface); display:grid; place-items:center; font-size:36px; }
	.route-cell.rock { background:var(--border-soft); }
	.rail { color:var(--text-secondary); }
	.directions { display:grid; grid-template-columns:repeat(2,90px); gap:12px; }
	.directions button { display:flex; flex-direction:column; align-items:center; }
	.directions b { font-size:36px; line-height:1; }
	.actions { justify-content:center; margin:24px 0; }
	.success,.hint { padding:12px; border-radius:18px; background:var(--bg-secondary); }
	.conductor { position:relative; width:180px; margin:24px auto 0; }
	.ticket { position:absolute; top:89px; left:44px; width:94px; transform:rotate(-8deg); }
	.ticket.tilted { transform:rotate(12deg); }
	@media(max-width:600px) { .train-scroll { padding:8px 12px 24px; } .navigation { justify-content:center; } p { font-size:21px; } button { padding:8px 12px; font-size:19px; } .choices { grid-template-columns:repeat(2,minmax(0,1fr)); } .seats { gap:8px; } .seat { padding:8px; } .route-workspace { flex-direction:column; gap:20px; } .route-cell { width:60px; height:60px; } .directions { grid-template-columns:repeat(4,64px); gap:8px; } .directions button { padding:4px; } .directions small { font-size:15px; } }
	@media(max-width:600px) { .train-shell > :global(header) { grid-template-columns:auto 1fr; gap:8px; padding:10px 12px; } .train-shell > :global(header .right) { grid-column:2; grid-row:1; justify-self:end; } .train-shell > :global(header .caption) { grid-column:1 / -1; grid-row:2; font-size:20px; line-height:1.3; } .train-shell > :global(header .icon) { width:56px; height:56px; } }
</style>
