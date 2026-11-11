<script lang="ts">
	import { onMount } from 'svelte';
	import { isTauri } from '@tauri-apps/api/core';
	import CustomerCard from './CustomerCard.svelte';
	import StationCard from './StationCard.svelte';
	import { kitchen, setKitchenVisible, subscribeToKitchen } from './kitchen';
	import type { Snapshot } from './model';

	let { embedded = false }: { embedded?: boolean } = $props();
	let game = $state<Snapshot>();
	let selectedId = $state<number>();
	let error = $state('');
	let busy = $state(false);
	const selected = $derived(game?.customers.find(customer => customer.id === selectedId) ?? game?.customers[0]);

	function apply(snapshot: Snapshot) {
		if (!game || snapshot.revision > game.revision) game = snapshot;
	}

	onMount(() => {
		if (!isTauri()) {
			error = embedded ? 'Open the Rumi desktop app to play Counter Rush.' : 'Open this kitchen with npm run tauri dev.';
			return;
		}
		let disposed = false;
		let unsubscribe: (() => void) | undefined;
		void (async () => {
			try {
				if (embedded) await setKitchenVisible(true);
				if (disposed) return;
				const stop = await subscribeToKitchen(snapshot => { if (!disposed) apply(snapshot); });
				if (disposed) {
					stop();
					return;
				}
				unsubscribe = stop;
				const snapshot = await kitchen.snapshot();
				if (!disposed) apply(snapshot);
			} catch (cause) {
				if (!disposed) error = String(cause);
			}
		})();
		return () => {
			disposed = true;
			unsubscribe?.();
			if (embedded) void setKitchenVisible(false).catch(() => {});
		};
	});

	async function act(action: () => Promise<Snapshot>) {
		if (busy) return;
		busy = true;
		error = '';
		try {
			apply(await action());
		} catch (cause) {
			error = String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<div class="counter-rush">
	<header>
		<div><p class="eyebrow">Restaurant simulator</p><h1>Counter Rush</h1></div>
		{#if game}
			<div class="wallet" aria-label="Shift totals">
				<strong>🪙 {game.coins} coins</strong>
				<span>{game.served} served · {game.walkedOut} left</span>
			</div>
		{/if}
	</header>

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if !game}
		{#if !error}<p>Connecting to the kitchen…</p>{/if}
	{:else if game.phase !== 'running'}
		<section class="intro">
			<h2>{game.phase === 'idle' ? 'Open for service?' : 'Shift complete'}</h2>
			<p>Prepare burgers and lemonade. Select a customer, then serve each item they ordered before their patience runs out.</p>
			<button class="primary" disabled={busy} onclick={() => act(kitchen.startShift)}>
				{game.phase === 'idle' ? 'Start shift' : 'New shift'}
			</button>
		</section>
	{:else}
		<section aria-labelledby="counter-title">
			<h2 id="counter-title">Customer counter</h2>
			{#if game.customers.length}
				<div class="counter">
					{#each game.customers as customer (customer.id)}
						<CustomerCard {customer} recipes={game.recipes} now={game.nowMs} selected={selected?.id === customer.id}
							onselect={() => { selectedId = customer.id; }} />
					{/each}
				</div>
			{:else}
				<p>The next customer is on the way.</p>
			{/if}
		</section>

		<section aria-labelledby="kitchen-title">
			<h2 id="kitchen-title">Kitchen</h2>
			<div class="stations">
				{#each game.stations as station (station.id)}
					{@const recipe = game.recipes.find(recipe => recipe.stationId === station.id)}
					{#if recipe}
						<StationCard {station} {recipe} now={game.nowMs} customer={selected} {busy}
							oncook={() => act(() => kitchen.cook(station.id, recipe.id))}
							onserve={(id) => act(() => kitchen.serve(id, station.id))}
							ondiscard={() => act(() => kitchen.discard(station.id))} />
					{/if}
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.counter-rush { min-height: 100%; padding: 24px; background: #f3e9d6; color: #263e35; font: 16px/1.45 system-ui, sans-serif; }
	.counter-rush :global(*) { box-sizing: border-box; }
	.counter-rush :global(button) { font: inherit; color: inherit; padding: 9px 14px; border: 2px solid #b7c9bb; border-radius: 9px; background: #f5fbf5; cursor: pointer; }
	.counter-rush :global(button.primary) { background: #14634c; border-color: #14634c; color: white; font-weight: 700; }
	.counter-rush :global(button:disabled) { opacity: .65; cursor: default; }
	.counter-rush :global(:focus-visible) { outline: 3px solid #143baa; outline-offset: 3px; }
	.counter-rush > :global(*) { max-width: 1120px; margin-inline: auto; }
	header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 16px 22px; background: #d7eadc; border-radius: 16px; }
	h1 { margin: 0; font-size: clamp(32px, 5vw, 48px); }
	h2 { margin-bottom: 10px; }
	.eyebrow { margin: 0; font-weight: 650; }
	.wallet { display: grid; }
	.intro { max-width: 580px; margin: 30px auto; padding: 24px; border-radius: 14px; background: #fffaf1; }
	.counter, .stations { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); }
	.stations { grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
	.error { padding: 10px 14px; background: #ffe0d6; color: #6b2415; border-radius: 8px; }
</style>
