<script lang="ts">
	/**
	 * Rumi's Kitchen — a no-lose cooking game (inspired by the Counter Rush starter, rebuilt for
	 * ages 3–6). One animal friend at a time asks for food in pictures and numbers; Rumi says it.
	 * Tap a station to make food (it never burns), tap food on the plate to take it off, then serve.
	 * No clock, no coins, nobody leaves (PR-07). A plate that isn't right yet stays on the counter
	 * and the friend says what they wanted (PR-08); after two tries the right foods glow (PR-22).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		checkTray,
		createKitchenRound,
		formatNumeral,
		FOODS,
		FRIENDS,
		friendWantsKey,
		itemKey,
		narrationText,
		STATIONS,
		TRAY_MAX,
		type FoodId,
		type Order,
		type StationId
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instructAll, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import ParticleCanvas, { type ParticleCue } from '#lib/components/visuals/ParticleCanvas.svelte';
	import { chime } from '#lib/game/chime.ts';

	const d = durations();
	const scheduler = createScheduler();
	const THANKS_MS = 2200;

	// svelte-ignore state_referenced_locally
	let round = $state(createKitchenRound($settings.difficulty, Date.now() >>> 0));
	let index = $state(0);
	let roundDone = $state(false);
	/** Each plate item has its own id, so taking one off doesn't re-animate the rest. */
	let tray = $state<{ id: number; food: FoodId }[]>([]);
	let nextItemId = 1;
	const trayFoods = $derived(tray.map((t) => t.food));
	let making = $state<Partial<Record<StationId, FoodId>>>({});
	let misses = $state(0);
	/** 'checking': a short pause after a miss so a double-tap can't count as two tries. */
	let phase = $state<'order' | 'checking' | 'thanks'>('order');
	let served = $state<Order[]>([]);
	let mascot = $state<MascotAnimation>('idle');
	let bump = $state<StationId | null>(null);
	let particles = $state.raw<ParticleCue | null>(null);

	const order = $derived<Order | undefined>(round.orders[index]);
	const bn = $derived($settings.language === 'bn-BD');
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const foodName = (f: FoodId) => (bn ? FOODS[f].bn : FOODS[f].en);
	const busy = $derived(Object.values(making).some(Boolean));
	const hint = $derived(misses >= 2);
	const missing = $derived(order ? checkTray(order, trayFoods).missing.map((m) => m.food) : []);
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	/** "বিড়াল খেতে চায়…" + "দুটো আপেল" + "আর" + "একটা দুধ". */
	const orderKeys = (o: Order) => [friendWantsKey(o.friend), ...o.lines.flatMap((l, i) => (i > 0 ? ['kitchen.and', itemKey(l.food, l.count)] : [itemKey(l.food, l.count)]))];
	function speakOrder(o: Order, interrupt = false) {
		if (interrupt) stopNarration();
		instructAll(orderKeys(o));
	}

	function load(i: number) {
		scheduler.cancelAll();
		hideHand();
		tray = [];
		making = {};
		misses = 0;
		phase = 'order';
		mascot = 'idle';
		const o = round.orders[i]!;
		speakOrder(o, true);
		if (firstTime('kitchen')) {
			scheduler.after(d.reduced ? 1200 : 3200, () => showHand([`[data-food="${o.lines[0]!.food}"]`, '[data-testid="serve"]']));
		}
	}

	function tapFood(food: FoodId) {
		if (phase !== 'order' || !order) return;
		const f = FOODS[food];
		if (making[f.station]) {
			bump = f.station;
			scheduler.after(400, () => (bump = null));
			return;
		}
		if (tray.length + Object.values(making).filter(Boolean).length >= TRAY_MAX) {
			say('kitchen.plate-full', { interrupt: true });
			return;
		}
		hideHand();
		speakLabel(`kitchen.food.${food}`);
		if (f.makeMs === 0) {
			tray = [...tray, { id: nextItemId++, food }];
			return;
		}
		making = { ...making, [f.station]: food };
		scheduler.after(d.reduced ? 400 : f.makeMs, () => {
			making = { ...making, [f.station]: undefined };
			tray = [...tray, { id: nextItemId++, food }];
		});
	}

	function takeOff(id: number) {
		if (phase !== 'order') return;
		tray = tray.filter((t) => t.id !== id);
	}

	function serve() {
		if (phase !== 'order' || !order || busy || tray.length === 0) return;
		hideHand();
		const check = checkTray(order, trayFoods);
		if (check.match) {
			phase = 'thanks';
			mascot = 'celebrate';
			served = [...served, order];
			say('kitchen.thanks', { interrupt: true });
			chime();
			particles = { kind: 'confetti', anchor: document.querySelector('.friend-face'), label: bn ? 'ধন্যবাদ!' : 'Thank you!' };
			setIdlePrompt(null);
			scheduler.after(d.reduced ? 900 : THANKS_MS, next);
			return;
		}
		misses += 1;
		mascot = 'encourage';
		phase = 'checking';
		scheduler.after(1200, () => phase === 'checking' && (phase = 'order'));
		say(check.extra.length > 0 ? 'kitchen.too-many' : 'kitchen.not-yet', { interrupt: true });
		o_repeat(order);
		if (misses >= 2) {
			const need = checkTray(order, trayFoods).missing[0]?.food;
			if (need) scheduler.after(1500, () => phase === 'order' && showHand([`[data-food="${need}"]`]));
		}
		scheduler.after(1600, () => phase === 'order' && (mascot = 'idle'));
	}
	/** After a gentle "not yet", say the order again so a non-reader knows what to fix. */
	function o_repeat(o: Order) {
		for (const k of orderKeys(o)) say(k);
	}

	function next() {
		if (index + 1 >= round.orders.length) {
			roundDone = true;
			mascot = 'celebrate';
			setIdlePrompt(null);
			say('kitchen.done', { interrupt: true });
			chime('big');
			particles = { kind: 'stars', anchor: null };
			return;
		}
		index += 1;
		load(index);
	}

	function replayRound() {
		round = createKitchenRound($settings.difficulty, (Date.now() + 1) >>> 0);
		index = 0;
		served = [];
		roundDone = false;
		load(0);
	}

	onMount(() => load(0));

	const offPause = paused.subscribe((p) => {
		if (p) {
			scheduler.pause();
			stopNarration();
		} else scheduler.resume();
	});

	onDestroy(() => {
		offPause();
		scheduler.cancelAll();
		hideHand();
		leaveScreen();
	});
</script>

<TopBar onreplay={() => order && !roundDone && speakOrder(order, true)} />

<ParticleCanvas cue={particles} paused={$paused} reducedMotion={d.reduced} />
<section class="kitchen" class:paused={$paused} data-phase={roundDone ? 'done' : phase} data-index={index}>
	{#if roundDone}
		<div class="finale">
			<div class="table" aria-label={label('kitchen.done')}>
				{#each served as o (o.id)}
					<span class="guest" aria-hidden="true">{FRIENDS[o.friend].icon}<small>{o.lines.map((l) => FOODS[l.food].icon).join('')}</small></span>
				{/each}
			</div>
			<Mascot state="celebrate" size={200} />
			<div class="actions">
				<GameButton action="replay" onclick={replayRound} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else if order}
		<div class="progress" aria-hidden="true">
			{#each round.orders as o, i (o.id)}
				<span class="pdot" class:filled={i < index || (i === index && phase === 'thanks')}></span>
			{/each}
		</div>

		<div class="counter">
			<div class="friend" class:happy={phase === 'thanks'}>
				<span class="friend-face" role="img" aria-label={bn ? FRIENDS[order.friend].bn : FRIENDS[order.friend].en}>{FRIENDS[order.friend].icon}</span>
				<div class="bubble" role="img" data-order={order.lines.map((l) => `${l.food}:${l.count}`).join(',')} aria-label={order.lines.map((l) => label(itemKey(l.food, l.count))).join(', ')}>
					{#if phase === 'thanks'}
						<span class="heart" aria-hidden="true">💛</span>
					{:else}
						{#each order.lines as l (l.food)}
							<span class="want" aria-hidden="true">
								<span class="count">{num(l.count)}</span>
								{#each Array.from({ length: l.count }, (_, i) => i) as i (i)}<span class="icon">{FOODS[l.food].icon}</span>{/each}
							</span>
						{/each}
					{/if}
				</div>
			</div>

			<div class="plate-area">
				<div class="plate" role="group" aria-label={bn ? 'প্লেট' : 'Plate'} data-tray={trayFoods.join(',')}>
					{#each tray as t (t.id)}
						<button class="on-plate" aria-label={bn ? `${foodName(t.food)} সরাই` : `Take off ${foodName(t.food)}`} onclick={() => takeOff(t.id)}>{FOODS[t.food].icon}</button>
					{/each}
				</div>
				<button class="serve" data-testid="serve" disabled={tray.length === 0 || busy || phase !== 'order'} aria-label={label('kitchen.serve')} onfocus={() => speakLabel('kitchen.serve')} onclick={serve}>
					<span aria-hidden="true">🍽️</span> {label('kitchen.serve')}
				</button>
			</div>
			<div class="rumi"><Mascot state={mascot} size={140} /></div>
		</div>

		<div class="stations">
			{#each STATIONS as s (s.id)}
				<div class="station" class:bump={bump === s.id} data-station={s.id}>
					<h3>{bn ? s.bn : s.en}</h3>
					<div class="foods">
						{#each s.foods as f (f)}
							<button
								class="food"
								class:glow={hint && missing.includes(f)}
								data-food={f}
								aria-label={foodName(f)}
								disabled={phase !== 'order'}
								onclick={() => tapFood(f)}
							>
								<span aria-hidden="true">{FOODS[f].icon}</span>
							</button>
						{/each}
					</div>
					{#if making[s.id]}
						<div class="making" aria-live="polite" style:--ms="{d.reduced ? 400 : FOODS[making[s.id]!].makeMs}ms">
							<span class="steam" aria-hidden="true">♨️</span> {label('kitchen.making')}
							<span class="bar"><span></span></span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.kitchen {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 0 24px 18px;
		min-height: 0;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.progress {
		display: flex;
		gap: 12px;
	}
	.pdot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
	}
	.pdot.filled {
		background: var(--text-secondary);
	}
	.counter {
		flex: 1;
		width: min(1150px, 100%);
		display: grid;
		grid-template-columns: 1fr 1.1fr auto;
		align-items: center;
		gap: 24px;
		min-height: 0;
	}
	.friend {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.friend-face {
		font-size: 110px;
		line-height: 1;
		transition: transform 300ms ease;
	}
	.friend.happy .friend-face {
		animation: hop 600ms ease-out 2;
	}
	.bubble {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 150px;
		padding: 14px 18px;
		border: 4px solid var(--border-soft);
		border-radius: 26px;
		background: var(--surface);
	}
	.bubble::before {
		content: '';
		position: absolute;
		left: -16px;
		top: 50%;
		border: 12px solid transparent;
		border-right-color: var(--border-soft);
		transform: translateY(-50%);
	}
	.want {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 46px;
	}
	.count {
		display: grid;
		place-items: center;
		min-width: 46px;
		height: 46px;
		border-radius: 50%;
		background: var(--bg-secondary);
		font-size: 30px;
		font-weight: 700;
	}
	.heart {
		font-size: 56px;
		text-align: center;
	}
	.plate-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.plate {
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		justify-content: center;
		gap: 4px;
		width: 280px;
		height: 180px;
		padding: 18px;
		border-radius: 50%;
		background: radial-gradient(circle, #ffffff 55%, #e9eef2 56%, #ffffff 70%);
		box-shadow: 0 8px 0 #d6dde3;
	}
	.on-plate {
		font-size: 44px;
		line-height: 1;
		padding: 2px;
		border: 0;
		background: transparent;
		cursor: pointer;
		animation: land 300ms ease-out;
	}
	.serve {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--target-game);
		padding: 10px 28px;
		border: 4px solid #2f6f49;
		border-radius: var(--radius-xl);
		background: #3f8f5f;
		color: #ffffff;
		font-size: 26px;
		font-weight: 700;
		cursor: pointer;
	}
	.serve:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.stations {
		display: flex;
		gap: 22px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.station {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 16px 16px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
	}
	.station.bump {
		animation: wiggle 400ms ease-in-out;
	}
	.station h3 {
		margin: 0;
		font-size: 20px;
		color: var(--text-secondary);
	}
	.foods {
		display: flex;
		gap: 10px;
	}
	.food {
		display: grid;
		place-items: center;
		width: 84px;
		height: 84px;
		border: 3px solid var(--border-soft);
		border-radius: 22px;
		background: var(--bg-primary);
		font-size: 50px;
		cursor: pointer;
		transition: transform 150ms ease;
	}
	.food:active:not(:disabled) {
		transform: scale(0.92);
	}
	.food.glow {
		animation: glow 1.2s ease-in-out infinite;
		border-color: #d9b23c;
	}
	.making {
		position: absolute;
		inset: auto 10px -14px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 2px 10px;
		border-radius: 12px;
		background: #fff3c4;
		font-size: 15px;
		font-weight: 600;
	}
	.bar {
		width: 60px;
		height: 8px;
		border-radius: 4px;
		background: #e8dcae;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: #d9a23c;
		animation: fill var(--ms) linear forwards;
	}
	.finale {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 24px;
	}
	.table {
		display: flex;
		gap: 18px;
		padding: 18px 28px;
		border-radius: 30px;
		background: #f6e3cf;
		box-shadow: 0 10px 0 #e3c8a8;
	}
	.guest {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 70px;
		line-height: 1;
		animation: hop 900ms ease-in-out infinite alternate;
	}
	.guest small {
		font-size: 32px;
	}
	.actions {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		justify-content: center;
	}
	@keyframes hop {
		from { transform: translateY(0); }
		to { transform: translateY(-12px); }
	}
	@keyframes land {
		from { transform: translateY(-24px) scale(0.6); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}
	@keyframes wiggle {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-3deg); }
		75% { transform: rotate(3deg); }
	}
	@keyframes glow {
		0%, 100% { box-shadow: 0 0 0 0 transparent; }
		50% { box-shadow: 0 0 0 8px #f2c94c88; }
	}
	@keyframes fill {
		from { width: 0; }
		to { width: 100%; }
	}
	@media (prefers-reduced-motion: reduce) {
		.friend.happy .friend-face, .guest, .on-plate, .food.glow, .station.bump { animation: none; }
	}
	/* Small windows (800x600): everything stays on screen. */
	@media (max-height: 700px) {
		.kitchen { gap: 8px; }
		.friend-face { font-size: 76px; }
		.want { font-size: 34px; }
		.plate { width: 220px; height: 130px; }
		.on-plate { font-size: 34px; }
		.serve { min-height: 64px; font-size: 22px; }
		.food { width: 64px; height: 64px; font-size: 38px; }
		.station { padding: 8px 10px 12px; }
	}
	@media (max-width: 1000px) {
		.counter { grid-template-columns: 1fr 1fr; }
		.stations { gap: 10px; }
		.rumi { display: none; }
	}
</style>
