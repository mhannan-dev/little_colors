<script lang="ts">
	/**
	 * Picture-first choice of what to learn: ABC, অআই or ১২৩. The glyphs are the picture,
	 * and each card says its name on hover/focus, so no reading is needed (PR-26).
	 */
	import { formatNumeral, narrationText, type SymbolSet } from '@little-colors/core';
	import { speakLabel } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';

	let { onpick }: { onpick: (set: SymbolSet) => void } = $props();

	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const cards = $derived<{ set: SymbolSet; glyphs: string; color: string }[]>([
		{ set: 'abc', glyphs: 'ABC', color: 'var(--learn-red)' },
		{ set: 'bangla', glyphs: 'অআই', color: 'var(--learn-blue)' },
		{ set: '123', glyphs: `${num(1)}${num(2)}${num(3)}`, color: 'var(--learn-green)' }
	]);
	const name = (set: SymbolSet) => narrationText(`play3d.set.${set}`, $settings.language, true);

	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	function hover(e: PointerEvent, set: SymbolSet) {
		if (e.pointerType !== 'mouse') return;
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => speakLabel(`play3d.set.${set}`), 600);
	}
	const unhover = () => hoverTimer && clearTimeout(hoverTimer);
</script>

<div class="picker">
	{#each cards as c (c.set)}
		<button
			class="card"
			style:--card={c.color}
			data-set={c.set}
			aria-label={name(c.set)}
			onpointerenter={(e) => hover(e, c.set)}
			onpointerleave={unhover}
			onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel(`play3d.set.${c.set}`)}
			onclick={() => {
				unhover();
				onpick(c.set);
			}}
		>
			<span class="cubes" aria-hidden="true">
				{#each [...c.glyphs] as g, i (i)}
					<span class="cube" style:--i={i}>{g}</span>
				{/each}
			</span>
			<span class="name">{name(c.set)}</span>
		</button>
	{/each}
</div>

<style>
	.picker {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 36px;
		padding: 24px;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		padding: 28px 30px 22px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		transition: transform 250ms ease, border-color 250ms ease;
	}
	.card:hover,
	.card:focus-visible {
		transform: translateY(-6px);
		border-color: var(--card);
	}
	.cubes {
		display: flex;
		gap: 10px;
	}
	.cube {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		border-radius: 16px;
		background: var(--card);
		box-shadow: inset 0 0 0 9px var(--card), inset 0 0 0 40px var(--surface), 0 6px 0 rgba(0, 0, 0, 0.15);
		font-size: 44px;
		font-weight: 700;
		color: var(--text-primary);
		transform: translateY(calc(var(--i) * -6px));
	}
	.name {
		font-size: 26px;
		font-weight: 700;
		color: var(--text-primary);
	}
	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
	}
</style>
