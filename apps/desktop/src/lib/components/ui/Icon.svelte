<script lang="ts" module>
	/** Pictograms for child-facing actions (PR-26): every action is recognizable without reading. */
	export type IconName = 'play' | 'next' | 'replay' | 'choose-game' | 'hint' | 'reset' | 'back';
</script>

<script lang="ts">
	let { name, size = 40 }: { name: IconName; size?: number } = $props();
</script>

<svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" class="icon">
	{#if name === 'play'}
		<path d="M15 9 L39 24 L15 39 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
	{:else if name === 'next'}
		<path d="M8 24 H36 M24 11 L38 24 L24 37" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
	{:else if name === 'replay'}
		<path d="M11 26 A14 14 0 1 0 15 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
		<path d="M9 6 V16 H19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
	{:else if name === 'choose-game'}
		{#each [[8, 8], [26, 8], [8, 26], [26, 26]] as [x, y] (`${x}-${y}`)}
			<rect {x} {y} width="14" height="14" rx="4" fill="currentColor" />
		{/each}
	{:else if name === 'hint'}
		<!-- a pointing hand -->
		<path d="M19 26 V9 a3.5 3.5 0 0 1 7 0 V22 l9 2 a4 4 0 0 1 3 4.4 L36 40 a4 4 0 0 1 -4 3.5 H22 a4 4 0 0 1 -3.2 -1.6 L11 31 a3 3 0 0 1 4.3 -4.2 Z" fill="currentColor" />
	{:else if name === 'reset'}
		<!-- an eraser -->
		<path d="M10 30 L28 12 a3 3 0 0 1 4.2 0 L40 19.8 a3 3 0 0 1 0 4.2 L25 39 H16 L10 33 a2.2 2.2 0 0 1 0 -3 Z" fill="currentColor" />
		<path d="M18 22 L32 36 M25 39 H40" fill="none" stroke="var(--surface)" stroke-width="3" stroke-linecap="round" />
	{:else if name === 'back'}
		<path d="M30 9 L15 24 L30 39" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
	{/if}
</svg>

<style>
	.icon {
		display: block;
		flex: none;
	}
</style>
