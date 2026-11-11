<script lang="ts">
	import { recipeIcon, type Customer, type Recipe } from './model';

	let { customer, recipes, now, selected, onselect }: {
		customer: Customer; recipes: Recipe[]; now: number; selected: boolean; onselect: () => void;
	} = $props();
	const remaining = $derived(Math.max(0, customer.leavesAtMs - now));
</script>

<button class="customer" aria-pressed={selected} onclick={onselect}>
	<strong>{customer.name}</strong>
	<span class="items">
		{#each customer.order.lines as line (line.recipeId)}
			<span class:served={line.served}>
				{recipeIcon[line.recipeId]} {recipes.find(recipe => recipe.id === line.recipeId)?.name}
				{line.served ? ' ✓' : ''}
			</span>
		{/each}
	</span>
	<progress aria-label={`${customer.name}’s patience`} value={remaining} max={customer.leavesAtMs - customer.arrivedAtMs}></progress>
	<span class="detail">{Math.ceil(remaining / 1000)}s patience · {customer.order.reward} coins</span>
</button>

<style>
	.customer { display: grid; align-content: start; gap: 6px; min-height: 150px; text-align: left; }
	.customer[aria-pressed="true"] { outline: 3px solid #14634c; }
	.items { display: grid; gap: 4px; }
	.served { text-decoration: line-through; color: #53645d; }
	.detail { font-size: .86rem; }
	progress { width: 100%; accent-color: #27785e; }
</style>
