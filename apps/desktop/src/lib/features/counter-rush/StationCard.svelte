<script lang="ts">
	import { recipeIcon, type Customer, type Recipe, type Station } from './model';

	let { station, recipe, now, customer, busy, oncook, onserve, ondiscard }: {
		station: Station; recipe: Recipe; now: number; customer?: Customer; busy: boolean;
		oncook: () => void; onserve: (customerId: number) => void; ondiscard: () => void;
	} = $props();

	const ready = $derived(station.item !== null && now >= station.item.readyAtMs);
	const canServe = $derived(ready && !!customer?.order.lines.some(line => !line.served && line.recipeId === recipe.id));
</script>

<article>
	<h3>{recipeIcon[recipe.id]} {station.id === 'grill' ? 'Grill' : 'Drink machine'}</h3>
	{#if station.item}
		<p>{ready ? `${recipe.name} is ready` : `Preparing ${recipe.name.toLowerCase()}…`}</p>
		<progress aria-label={`${recipe.name} progress`}
			value={Math.min(recipe.cookMs, Math.max(0, now - station.item.startedAtMs))} max={recipe.cookMs}></progress>
		<div class="actions">
			<button class="primary" disabled={busy || !canServe} onclick={() => { if (customer) onserve(customer.id); }}>
				{canServe && customer ? `Serve ${customer.name}` : 'Serve'}
			</button>
			<button disabled={busy} onclick={ondiscard}>Discard</button>
		</div>
	{:else}
		<p>{recipe.cookMs / 1000}s prep · {recipe.coins} coins</p>
		<button class="primary" disabled={busy} onclick={oncook}>
			{station.id === 'grill' ? 'Grill burger' : 'Pour lemonade'}
		</button>
	{/if}
</article>

<style>
	article { background: #fffaf1; border: 2px solid #dac6a7; border-radius: 14px; padding: 18px; min-height: 190px; }
	h3 { margin: 0 0 10px; }
	p { margin: 0 0 10px; }
	progress { width: 100%; accent-color: #ad541f; }
	.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
</style>
