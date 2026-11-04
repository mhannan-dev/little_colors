<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onclick,
		label,
		variant = 'primary',
		size = 'large',
		children
	}: {
		onclick: () => void;
		label: string;
		variant?: 'primary' | 'secondary';
		size?: 'large' | 'small';
		children?: Snippet;
	} = $props();
</script>

<button class="game-button {variant} {size}" aria-label={label} {onclick}>
	{#if children}{@render children()}{/if}
	<span>{label}</span>
</button>

<style>
	.game-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-width: var(--target-min);
		min-height: var(--target-min);
		border: 4px solid transparent;
		border-radius: var(--radius-xl);
		cursor: pointer;
		font-weight: 700;
		transition: transform 150ms ease;
	}
	.game-button:hover {
		transform: translateY(-2px);
	}
	.game-button:active {
		transform: translateY(1px);
	}
	.large {
		min-height: var(--target-game);
		padding: 12px 40px;
		font-size: 32px;
	}
	.small {
		padding: 6px 18px;
		font-size: 20px;
	}
	.primary {
		background: var(--text-primary);
		color: var(--bg-primary);
	}
	.secondary {
		background: var(--surface);
		border-color: var(--border-soft);
		color: var(--text-primary);
	}
</style>
