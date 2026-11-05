<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { createSillyShop, initialSillyShopProgress, sillyShopReducer, SHOP_STAGES, SHOP_ITEMS, shopShelf, createPlaygroundStamp, narrationText, formatNumeral, type ThinkingAgeBand, type SillyShopAction, type PicnicPicture } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import Token from './ThinkingToken.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';
	let { ageBand, onexit }: { ageBand: ThinkingAgeBand; onexit: () => void } = $props();
	let plan = $state(untrack(() => createSillyShop(ageBand, Date.now() >>> 0)));
	let progress = $state(initialSillyShopProgress());
	let marked = $state<string[]>([]);
	let joke = $state(false);
	let scroller = $state<HTMLDivElement>();
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const n = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const name = (item: PicnicPicture) => text(`picnic.item.${item}`);
	const kind = $derived(SHOP_STAGES[progress.stage]!);
	const instruction = $derived(progress.stage === 0 && progress.phase === 'play' ? 'shop.list.recall' : `shop.instruction.${kind}`);
	const currentItem = $derived(plan.shelves[progress.sorted.length]);
	function focusHeading() { void tick().then(() => { scroller?.scrollTo(0, 0); scroller?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); }); }
	function dispatch(action: SillyShopAction) {
		if ($paused) return;
		const next = sillyShopReducer(plan, progress, action);
		if (next === progress) return;
		const phase = progress.phase; progress = next;
		if (action.type === 'RESET' || action.type === 'NEXT') marked = [];
		say(next.feedbackKey, { interrupt: true });
		if (next.phase !== phase && !['observe', 'play'].includes(next.phase)) focusHeading();
	}
	function replay() { if ($paused) return; stopNarration(); plan = createSillyShop(ageBand, (plan.seed + 1) >>> 0); progress = initialSillyShopProgress(); marked = []; joke = false; say(progress.feedbackKey, { interrupt: true }); focusHeading(); }
	function mark(id: string) { if ($paused || progress.phase !== 'play') return; marked = marked.includes(id) ? marked.filter((key) => key !== id) : [...marked, id]; }
	$effect(() => caption.set(text(progress.feedbackKey)));
	const offPause = paused.subscribe((value) => { if (value) stopNarration(); });
	onMount(() => { say(progress.feedbackKey, { interrupt: true }); focusHeading(); });
	onDestroy(() => { offPause(); stopNarration(); });
</script>

<div class="shop-shell">
	<TopBar onreplay={() => say(['intro', 'complete', 'finished'].includes(progress.phase) ? progress.feedbackKey : instruction, { interrupt: true })}/>
	<div class="shop-scroll" bind:this={scroller} data-testid="silly-shop">
		<section>
			<div class="navigation"><button data-testid="shop-back" onclick={onexit}>← {text('thinking.hub')}</button><span>{n(progress.completed)} / {n(SHOP_STAGES.length)} ✓</span></div>
			<div class="awning" aria-hidden="true"></div>
			<h1 tabindex="-1">{text(progress.phase === 'finished' ? 'shop.title' : `shop.${kind}`)}</h1>
			{#if progress.phase === 'intro'}
				<div class="intro" data-testid="shop-intro" data-stage={kind}><Mascot state="wave" size={120}/><p>{text(`shop.story.${kind}`)}</p><button class="primary" data-testid="shop-begin" disabled={$paused} onclick={() => dispatch({ type: 'BEGIN' })}>{text('picnic.begin')} →</button></div>
			{:else if progress.phase === 'finished'}
				<div data-testid="shop-finale"><div class="puppet-scene"><Mascot state={joke ? 'celebrate' : 'wave'} size={170}/><svg class:talking={joke} data-testid="shop-puppet" viewBox="0 0 130 150" aria-hidden="true"><path d="M35 15 H90 V88 Q127 88 119 116 Q115 138 65 138 H25 Q10 135 17 114 L35 84Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="5"/><path d="M35 36 H90" stroke="var(--surface)" stroke-width="14"/><circle cx="96" cy="96" r="5" fill="var(--text-primary)"/><path d={joke ? 'M91 118 Q103 135 114 117Z' : 'M91 118 Q103 126 114 117'} fill={joke ? 'var(--text-primary)' : 'none'} stroke="var(--text-primary)" stroke-width="4"/></svg></div><p role="status">{text(joke ? 'shop.joke' : 'shop.done')}</p><div class="actions"><button data-testid="shop-giggle" disabled={$paused} onclick={() => { joke = !joke; say(joke ? 'shop.joke' : 'shop.done', { interrupt: true }); }}>{text('shop.giggle')}</button><button class="primary" data-testid="shop-replay" disabled={$paused} onclick={replay}>{text('shop.replay')}</button></div></div>
			{:else}
				<p class="instruction">{text(instruction)}</p>
				{#if progress.phase === 'complete'}<p class="success" role="status" data-testid="shop-complete">✓ {text(progress.stage === 4 ? 'shop.fixed' : 'shop.complete')}</p>{/if}
				{#if progress.stage === 0}
					{#if progress.phase === 'observe' || progress.phase === 'complete'}<div class="order" data-testid="shop-order">{#each plan.order as entry}<div class="order-item" data-order-item={entry.item} data-quantity={entry.quantity}><Token token={createPlaygroundStamp(entry.item)} size={64}/><span>{n(entry.quantity)} × {name(entry.item)}</span></div>{/each}</div>{/if}
					{#if progress.phase === 'observe'}<button class="primary" data-testid="shop-hide" disabled={$paused} onclick={() => dispatch({ type: 'HIDE' })}>{text('shop.hide')}</button>{/if}
					{#if progress.phase === 'play'}<div class="choices">{#each SHOP_ITEMS as item}<button data-shop-item={item} disabled={$paused} aria-label={name(item)} onclick={() => dispatch({ type: 'ADD', item })}><Token token={createPlaygroundStamp(item)} size={64}/><span>{name(item)}</span></button>{/each}</div><button data-testid="shop-peek" disabled={$paused} onclick={() => dispatch({ type: 'PEEK' })}>{text('shop.peek')}</button>{/if}
					<div class="basket" data-testid="shop-basket"><h2>{text('shop.basket')}</h2><div class="basket-items">{#each SHOP_ITEMS.filter((item) => !!progress.basket[item]) as item}<div data-basket-item={item} data-quantity={progress.basket[item]}><Token token={createPlaygroundStamp(item)} size={50}/><span>{n(progress.basket[item]!)} × {name(item)}</span></div>{/each}{#if !Object.keys(progress.basket).length}<span>{text('shop.empty')}</span>{/if}</div></div>
				{:else if progress.stage === 1}
					{#if currentItem}<div class="current" data-testid="shop-current" data-item={currentItem}><Token token={createPlaygroundStamp(currentItem)} size={90}/><strong>{name(currentItem)}</strong></div>{/if}
					<div class="shelves">{#each ['food', 'supplies'] as const as shelf}<button class="shelf" data-shelf={shelf} disabled={progress.phase !== 'play' || $paused} onclick={() => dispatch({ type: 'SHELVE', shelf })}><strong>{text(`shop.${shelf}`)}</strong><div>{#each progress.sorted.filter((item) => shopShelf(item) === shelf) as item}<span data-sorted-item={item}><Token token={createPlaygroundStamp(item)} size={50}/></span>{/each}</div></button>{/each}</div>
				{:else if progress.stage === 2}
					<div class="count-groups">{#each plan.countGroups as quantity, group}<div class="count-group" data-count-group={quantity}>{#each Array(quantity) as _, index}{@const id = `${group}-${index}`}<button class="apple" class:marked={marked.includes(id)} data-count-apple={id} aria-pressed={marked.includes(id)} aria-label={`${text('shop.mark')} ${n(group + 1)}, ${n(index + 1)}`} disabled={progress.phase !== 'play' || $paused} onclick={() => mark(id)}><Token token={createPlaygroundStamp('apple')} size={52}/>{#if marked.includes(id)}<b aria-hidden="true">✓</b>{/if}</button>{/each}</div>{#if group < plan.countGroups.length - 1}<strong class="plus" aria-hidden="true">+</strong>{/if}{/each}</div>
					<div class="actions">{#each plan.countOptions as value}<button class="number" data-count-answer={value} disabled={progress.phase !== 'play' || $paused} onclick={() => dispatch({ type: 'COUNT', value })}>{n(value)}</button>{/each}</div>
				{:else if progress.stage === 3}
					<h2 data-testid="shop-comparison" data-rule={plan.comparison}>{text(`shop.${plan.comparison}`)}</h2><div class="comparison">{#each ['left', 'right'] as const as side}{@const quantity = plan[side]}<button data-compare-side={side} data-quantity={quantity} aria-label={`${text(`shop.${side}`)}: ${n(quantity)} ${name('apple')}`} disabled={progress.phase !== 'play' || $paused} onclick={() => dispatch({ type: 'COMPARE', side })}><strong>{text(`shop.${side}`)}</strong><div class="apples">{#each Array(quantity) as _}<Token token={createPlaygroundStamp('apple')} size={44}/>{/each}</div></button>{/each}</div>
				{:else}
					<div class="lunch" data-testid="shop-lunch">{#each plan.lunch.filter((item) => progress.phase !== 'complete' || item !== 'sock') as item}<button data-lunch-item={item} disabled={progress.phase !== 'play' || $paused} aria-label={name(item)} onclick={() => dispatch({ type: 'FIX', item })}><Token token={createPlaygroundStamp(item)} size={90}/><span>{name(item)}</span></button>{/each}</div>
				{/if}
				{#if progress.hint}<p role="status" class="hint" data-testid="shop-hint">{text(`shop.hint.${kind}`)}</p>{/if}
				<div class="actions">{#if progress.phase === 'complete'}<button class="primary" data-testid="shop-next" disabled={$paused} onclick={() => dispatch({ type: 'NEXT' })}>{text('shop.next')} →</button>{:else}<button data-testid="shop-reset" disabled={$paused} onclick={() => dispatch({ type: 'RESET' })}>{text('thinking.restart')}</button>{#if progress.phase === 'play'}<button data-testid="shop-help" disabled={$paused} onclick={() => dispatch({ type: 'HINT' })}>{text('shop.help')}</button>{/if}{/if}</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.shop-shell { display:flex; flex-direction:column; flex:1; min-height:0; }
	.shop-scroll { overflow:auto; flex:1; min-height:0; padding:10px 24px 30px; }
	section { max-width:1000px; margin:auto; text-align:center; }
	.navigation, .actions { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
	.navigation { font-size:21px; }
	.awning { height:24px; background:repeating-linear-gradient(90deg,var(--learn-orange) 0 40px,var(--surface) 40px 80px); border:3px solid var(--border-soft); border-radius:8px 8px 16px 16px; margin:18px 0; }
	h1 { font-size:clamp(28px,3vw,40px); margin:16px 0; }
	h2 { font-size:25px; }
	button { cursor:pointer; min-height:60px; border:3px solid var(--border-soft); border-radius:20px; background:var(--surface); padding:10px 20px; font-size:21px; }
	button:disabled { cursor:default; opacity:.6; }
	.primary { background:var(--text-primary); color:var(--bg-primary); font-weight:700; }
	p { font-size:24px; line-height:1.5; max-width:800px; margin:18px auto; }
	.intro { display:flex; flex-direction:column; align-items:center; padding:12px; }
	.order, .basket-items, .lunch { display:flex; flex-wrap:wrap; justify-content:center; gap:14px; margin:20px auto; }
	.order-item, .basket-items > div { display:flex; flex-direction:column; align-items:center; gap:8px; font-size:21px; padding:14px; border:2px dashed var(--text-secondary); border-radius:18px; }
	.basket { border:3px solid var(--learn-orange); border-radius:24px; padding:10px; margin:20px auto; max-width:760px; background:var(--bg-secondary); }
	.basket h2 { margin:0; }
	.basket-items > div { padding:8px; font-size:18px; }
	.choices { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; max-width:740px; margin:24px auto; }
	.choices button, .lunch button { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:8px; }
	.choices span, .lunch span { font-size:19px; }
	.current { display:flex; align-items:center; justify-content:center; gap:20px; font-size:24px; margin:20px; }
	.shelves, .comparison { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; max-width:820px; margin:24px auto; }
	.shelf { min-height:160px; border-bottom:10px solid var(--learn-orange); }
	.shelf > div { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; min-height:60px; margin-top:15px; }
	.apples, .count-groups, .count-group { display:flex; justify-content:center; flex-wrap:wrap; align-items:center; gap:12px; }
	.apples { margin:16px 0; }
	.count-groups { margin:24px auto; }
	.count-group { max-width:340px; border:3px solid var(--learn-orange); border-radius:20px; padding:14px; background:var(--bg-secondary); }
	.apple { padding:4px; position:relative; min-width:64px; min-height:64px; }
	.apple.marked { border-color:var(--text-primary); background:var(--bg-secondary); }
	.apple b { position:absolute; right:2px; top:-6px; }
	.plus { font-size:36px; }
	.number { min-width:90px; min-height:90px; font-size:36px; }
	.actions { justify-content:center; margin:24px 0; }
	.success, .hint { padding:12px; border-radius:18px; background:var(--bg-secondary); }
	.puppet-scene { display:flex; align-items:center; justify-content:center; padding:20px 0; }
	.puppet-scene svg { width:130px; transform:rotate(-10deg); }
	.puppet-scene svg.talking { transform:rotate(8deg); }
	@media(max-width:600px) { .shop-scroll { padding:8px 12px 24px; } .navigation { justify-content:center; } .choices { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; } p { font-size:21px; } button { padding:8px 12px; font-size:19px; } .shelves, .comparison { gap:10px; } .shelf { padding:8px; } .count-group { max-width:280px; } .count-groups { gap:8px; } .lunch button { padding:10px; } }
	@media(max-width:600px) { .shop-shell > :global(header) { grid-template-columns:auto 1fr; gap:8px; padding:10px 12px; } .shop-shell > :global(header .right) { grid-column:2; grid-row:1; justify-self:end; } .shop-shell > :global(header .caption) { grid-column:1 / -1; grid-row:2; font-size:20px; line-height:1.3; } .shop-shell > :global(header .icon) { width:56px; height:56px; } }
</style>
