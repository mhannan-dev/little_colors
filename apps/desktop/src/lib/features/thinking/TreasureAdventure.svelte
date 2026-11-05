<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { createTreasureAdventure, initialTreasureProgress, treasureReducer, treasureTarget, TREASURE_STAGES, narrationText, formatNumeral, type ThinkingAgeBand, type ThinkingToken, type TreasureAction } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import Token from './ThinkingToken.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';
	let { ageBand, onexit }: { ageBand: ThinkingAgeBand; onexit: () => void } = $props();
	let plan = $state(untrack(() => createTreasureAdventure(ageBand, Date.now() >>> 0)));
	let progress = $state(initialTreasureProgress());
	let scroller = $state<HTMLDivElement>();
	let joke = $state(false);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const n = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const name = (token: ThinkingToken) => token.picture ? text(`picnic.item.${token.picture}`) : `${text(`thinking.color.${token.color}`)} ${text(`thinking.shape.${token.shape}`)}`;
	const kind = $derived(TREASURE_STAGES[progress.stage]!);
	const target = $derived(treasureTarget(plan, progress));
	const instruction = $derived(progress.stage === 1 && progress.phase === 'play' ? 'treasure.memory.find' : `treasure.instruction.${kind}`);
	function focusHeading() { void tick().then(() => { scroller?.scrollTo(0, 0); scroller?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); }); }
	function dispatch(action: TreasureAction) {
		if ($paused) return;
		const next = treasureReducer(plan, progress, action);
		if (next === progress) return;
		const phase = progress.phase; progress = next;
		say(next.feedbackKey, { interrupt: true });
		if (next.phase !== phase && !['observe', 'play'].includes(next.phase)) focusHeading();
	}
	function replay() { if ($paused) return; stopNarration(); plan = createTreasureAdventure(ageBand, (plan.seed + 1) >>> 0); progress = initialTreasureProgress(); joke = false; say(progress.feedbackKey, { interrupt: true }); focusHeading(); }
	function outlined(token: ThinkingToken) { return progress.hint && (progress.stage === 0 ? token.id === target?.id : progress.stage === 2 ? token.shape === plan.sortShape : token.id === plan.answer.id); }
	$effect(() => caption.set(text(progress.feedbackKey)));
	const offPause = paused.subscribe((value) => { if (value) stopNarration(); });
	onMount(() => { say(progress.feedbackKey, { interrupt: true }); focusHeading(); });
	onDestroy(() => { offPause(); stopNarration(); });
</script>

<div class="treasure-shell">
	<TopBar onreplay={() => say(progress.phase === 'intro' || ['complete', 'chest', 'finished'].includes(progress.phase) ? progress.feedbackKey : instruction, { interrupt: true })} />
	<div class="treasure-scroll" bind:this={scroller} data-testid="treasure-adventure">
		<section>
			<div class="navigation"><button data-testid="treasure-back" onclick={onexit}>← {text('thinking.hub')}</button><span>{text('treasure.keys')}: {n(progress.keys)} / {n(4)} <span aria-hidden="true">⚿</span></span></div>
			<h1 tabindex="-1">{text(['chest', 'finished'].includes(progress.phase) ? 'treasure.title' : `treasure.${kind}`)}</h1>
			<div class="map" aria-hidden="true"><span class:earned={progress.keys > 0}>◇</span><i>···</i><span class:earned={progress.keys > 1}>♧</span><i>···</i><span class:earned={progress.keys > 2}>☆</span><i>···</i><span class:earned={progress.keys > 3}>⚿</span></div>
			{#if progress.phase === 'intro'}
				<div class="intro" data-testid="treasure-intro" data-stage={kind}><Mascot state="thinking" size={140} /><p>{text(`treasure.story.${kind}`)}</p><button class="primary" data-testid="treasure-begin" disabled={$paused} onclick={() => dispatch({ type: 'BEGIN' })}>{text('picnic.begin')} →</button></div>
			{:else if progress.phase === 'chest' || progress.phase === 'finished'}
				<div class="finale" data-testid="treasure-chest" data-open={progress.phase === 'finished'}>
					<div class="chest-art"><svg viewBox="0 0 300 180" role="img" aria-label={text('treasure.open')}><path d={progress.phase === 'finished' ? 'M45 68 L60 12 L245 12 L255 68Z' : 'M45 80 Q45 20 95 20 H205 Q255 20 255 80Z'} fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="6"/><rect x="45" y="80" width="210" height="85" rx="12" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="6"/><path d="M85 82 V163 M215 82 V163" stroke="var(--text-primary)" stroke-width="10"/><rect x="135" y="72" width="30" height="40" rx="6" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="4"/></svg>
						{#if progress.phase === 'finished'}<div class="surprise" data-testid="treasure-banana"><Mascot state={joke ? 'wave' : 'celebrate'} size={150}/><svg class="banana" viewBox="0 0 100 70" aria-hidden="true"><path d="M12 16 Q36 60 88 14 Q80 73 35 56 Q15 48 12 16Z" fill="#f5c442" stroke="var(--text-primary)" stroke-width="4"/><path d="M12 16 L8 8 M88 14 L92 6" stroke="var(--text-primary)" stroke-width="6"/></svg></div>{/if}
					</div>
					<p>{text(progress.phase === 'finished' ? joke ? 'treasure.joke' : 'treasure.surprise' : 'treasure.chest.ready')}</p>
					{#if progress.phase === 'chest'}<button class="primary" data-testid="treasure-open" disabled={$paused} onclick={() => dispatch({ type: 'OPEN' })}>{text('treasure.open')}</button>
					{:else}<p>{text('treasure.done')}</p><div class="actions"><button data-testid="treasure-giggle" disabled={$paused} onclick={() => { joke = !joke; say(joke ? 'treasure.joke' : 'treasure.surprise', { interrupt: true }); }}>{text('treasure.giggle')}</button><button class="primary" data-testid="treasure-replay" disabled={$paused} onclick={replay}>{text('treasure.replay')}</button></div>{/if}
				</div>
			{:else}
				<p class="instruction">{text(instruction)}</p>
				{#if progress.phase === 'complete'}<p role="status" class="success" data-testid="treasure-complete">✓ {text('treasure.complete')}</p>{/if}
				{#if progress.stage === 1}
					{#if target && progress.phase === 'play'}<div class="clue" data-testid="treasure-target" data-token={target.id}><Token token={target} size={70}/><strong>{name(target)}</strong></div>{/if}
					<div class="bushes" data-testid="treasure-bushes">{#each plan.spots as token, cell}
						{@const visible = progress.phase === 'observe' || progress.phase === 'complete' || (token && plan.remembered.slice(0, progress.found).some((item) => item.id === token.id))}
						<button class="bush" data-spot={cell} data-token={visible && token ? token.id : undefined} aria-label={`${text('treasure.bush')} ${n(cell + 1)}${visible && token ? ': ' + name(token) : ''}`} disabled={progress.phase !== 'play' || $paused || !!(visible && token)} onclick={() => dispatch({ type: 'SPOT', cell })}><small>{n(cell + 1)}</small>{#if visible && token}<Token {token} size={64}/>{:else}<span aria-hidden="true">♧</span>{/if}</button>
					{/each}</div>
					{#if progress.phase === 'observe'}<button class="primary" data-testid="treasure-hide" disabled={$paused} onclick={() => dispatch({ type: 'HIDE' })}>{text('treasure.hide')}</button>{:else if progress.phase === 'play'}<button data-testid="treasure-peek" disabled={$paused} onclick={() => dispatch({ type: 'PEEK' })}>{text('treasure.peek')}</button>{/if}
				{:else}
					{#if progress.stage === 0 && target}<div class="clue" data-testid="treasure-target" data-token={target.id}><Token token={target} size={70}/><strong>{name(target)}</strong></div>{/if}
					{#if progress.stage === 2}<div class="clue" data-testid="treasure-sort-shape" data-shape={plan.sortShape}><Token token={{id:'sort-example', shape:plan.sortShape, color:'blue'}} size={64}/><strong>{text(`thinking.shape.${plan.sortShape}`)}</strong></div>{/if}
					{#if progress.stage === 3}<div class="sequence" data-testid="treasure-sequence">{#each plan.sequence as token}<div class="slot" data-token={token.id}><Token {token} size={54}/></div>{/each}<div class="slot">{#if progress.phase === 'complete'}<Token token={plan.answer} size={54}/>{:else}?{/if}</div></div>{/if}
					<div class="choices">{#each progress.stage === 0 ? plan.objects : progress.stage === 2 ? plan.sorting : plan.options as token}
						<button class:hinted={outlined(token)} class:found={progress.selected.includes(token.id)} data-treasure-option={token.id} data-shape={token.shape} aria-label={name(token)} disabled={progress.phase !== 'play' || progress.selected.includes(token.id) || $paused} onclick={() => dispatch({ type: 'PICK', id: token.id })}><Token {token} size={64}/><span>{name(token)}</span>{#if progress.selected.includes(token.id)}<b aria-hidden="true">✓</b>{/if}</button>
					{/each}</div>
				{/if}
				{#if progress.hint}<p role="status" data-testid="treasure-hint">{text(`treasure.hint.${kind}`)}</p>{/if}
				<div class="actions">{#if progress.phase === 'complete'}<button class="primary" data-testid="treasure-next" disabled={$paused} onclick={() => dispatch({ type: 'NEXT' })}>{text('treasure.next')} →</button>{:else}<button data-testid="treasure-reset" disabled={$paused} onclick={() => dispatch({ type: 'RESET' })}>{text('thinking.restart')}</button>{#if progress.phase === 'play'}<button data-testid="treasure-help" disabled={$paused} onclick={() => dispatch({ type: 'HINT' })}>{text('treasure.help')}</button>{/if}{/if}</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.treasure-shell { display:flex; flex-direction:column; flex:1; min-height:0; }
	.treasure-scroll { overflow:auto; flex:1; min-height:0; padding:10px 24px 30px; }
	section { max-width:1000px; margin:auto; text-align:center; }
	.navigation, .actions { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
	.navigation { font-size:21px; }
	h1 { font-size:clamp(28px,3vw,40px); margin:16px 0 8px; }
	button { cursor:pointer; min-height:60px; padding:10px 20px; border:3px solid var(--border-soft); border-radius:20px; background:var(--surface); font-size:21px; }
	button:disabled { cursor:default; opacity:.6; }
	button.found { opacity:1; border-color:var(--learn-green); }
	button.hinted { outline:4px dashed var(--text-primary); outline-offset:3px; }
	.primary { background:var(--text-primary); color:var(--bg-primary); font-weight:700; }
	p { font-size:24px; line-height:1.5; max-width:800px; margin:18px auto; }
	.map { display:flex; justify-content:center; align-items:center; gap:14px; color:var(--text-secondary); margin:12px auto; }
	.map span { border:2px solid var(--border-soft); background:var(--surface); border-radius:50%; width:48px; height:48px; font-size:32px; }
	.map .earned { background:var(--learn-green); color:var(--text-primary); }
	.intro { display:flex; flex-direction:column; align-items:center; padding:12px; }
	.clue { display:flex; justify-content:center; align-items:center; gap:18px; padding:12px; margin:18px auto; border:3px dashed var(--text-secondary); border-radius:20px; max-width:420px; font-size:23px; background:var(--bg-secondary); }
	.choices { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; max-width:740px; margin:24px auto; }
	.choices button { display:flex; align-items:center; justify-content:center; flex-direction:column; position:relative; gap:8px; min-height:130px; }
	.choices span { font-size:18px; }
	.choices b { position:absolute; right:10px; top:6px; }
	.bushes { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); max-width:600px; gap:14px; margin:22px auto; }
	.bush { min-height:120px; display:flex; flex-direction:column; align-items:center; background:var(--bg-secondary); }
	.bush span { color:var(--learn-green); font-size:58px; line-height:1; }
	small { font-size:18px; }
	.sequence { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; margin:20px auto; }
	.slot { width:76px; min-height:80px; border:2px solid var(--border-soft); border-radius:16px; display:grid; place-items:center; font-size:36px; background:var(--surface); }
	.actions { justify-content:center; margin:24px 0; }
	.success { background:var(--bg-secondary); border-radius:18px; padding:12px; }
	.chest-art { position:relative; width:300px; padding-top:130px; margin:auto; }
	.chest-art > svg { width:100%; }
	.surprise { position:absolute; top:0; left:75px; }
	.banana { position:absolute; width:100px; top:-10px; left:25px; transform:rotate(-12deg); }
	@media(max-width:600px) { .treasure-scroll { padding:8px 12px 24px; } .choices { gap:10px; grid-template-columns:repeat(2,minmax(0,1fr)); } .navigation { justify-content:center; } p { font-size:21px; } .map { gap:8px; } .map span { width:40px; height:40px; font-size:26px; } button { font-size:19px; padding:8px 12px; } .bushes { gap:8px; } .bush { min-height:110px; } .slot { width:62px; } }
	@media(max-width:600px) { .treasure-shell > :global(header) { grid-template-columns:auto 1fr; gap:8px; padding:10px 12px; } .treasure-shell > :global(header .right) { grid-column:2; grid-row:1; justify-self:end; } .treasure-shell > :global(header .caption) { grid-column:1 / -1; grid-row:2; font-size:20px; line-height:1.3; } .treasure-shell > :global(header .icon) { width:56px; height:56px; } }
</style>
